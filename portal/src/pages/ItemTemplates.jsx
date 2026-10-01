import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Plus, Trash2, Pencil, X, Save, Layers } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const emptyItem = () => ({ description: '', quantity: 1, unit_price: 0 });
const emptyForm = () => ({ name: '', items: [emptyItem()] });

export default function ItemTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    try {
      const res = await api.entities.ItemTemplate.filter({}, { sort: 'name', limit: 200 });
      setTemplates(res.items || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setForm(emptyForm());
    setEditing('new');
  };

  const startEdit = (t) => {
    setForm({
      name: t.name,
      items: t.items?.length ? t.items.map((i) => ({ ...i })) : [emptyItem()],
    });
    setEditing(t.id);
  };

  const cancel = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, emptyItem()] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      items: form.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
      })),
    };
    try {
      if (editing === 'new') {
        await api.entities.ItemTemplate.create(payload);
      } else {
        await api.entities.ItemTemplate.update(editing, payload);
      }
      cancel();
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const remove = async (id) => {
    try {
      await api.entities.ItemTemplate.delete(id);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const total = (t) => (t.items || []).reduce((s, i) => s + (Number(i.quantity) * Number(i.unit_price)), 0);
  const formTotal = form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unit_price)), 0);

  return (
    <div className="p-10 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Line Item Templates</h1>
          <p className="text-sm text-neutral-500 mt-1">Save reusable groups of line items to apply to new invoices</p>
        </div>
        {editing !== 'new' && (
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition"
          >
            <Plus size={18} /> New Template
          </button>
        )}
      </div>

      {editing && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <input
              autoFocus
              type="text"
              placeholder="Template name (e.g. Monthly Retainer)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm font-medium focus:outline-none focus:border-neutral-900"
            />
            <button
              onClick={save}
              disabled={!form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm disabled:opacity-50"
            >
              <Save size={16} /> {editing === 'new' ? 'Save' : 'Update'}
            </button>
            <button onClick={cancel} className="p-2 text-neutral-400 hover:text-neutral-900">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 text-xs uppercase tracking-wider text-neutral-400 px-1">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-6">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-right focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Unit price"
                    value={item.unit_price}
                    onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-right focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="col-span-1 flex items-center justify-end py-2 text-sm font-medium text-neutral-900">
                  {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="p-1.5 text-neutral-300 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900">
              <Plus size={16} /> Add item
            </button>
            <div className="text-sm text-neutral-500">
              Template total: <span className="font-semibold text-neutral-900">{formatCurrency(formTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-sm text-neutral-400">Loading...</div>
      ) : templates.length === 0 && !editing ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-16 text-center">
          <Layers size={32} className="mx-auto text-neutral-300 mb-3" />
          <p className="text-sm text-neutral-400 mb-4">No templates yet</p>
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm"
          >
            <Plus size={16} /> Create your first template
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">{t.name}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {t.items?.length || 0} item{(t.items?.length || 0) !== 1 ? 's' : ''} · {formatCurrency(total(t))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(t)} className="p-1.5 text-neutral-400 hover:text-neutral-900">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove(t.id)} className="p-1.5 text-neutral-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {t.items?.length > 0 && (
                <div className="border-t border-neutral-100 pt-3 space-y-1.5">
                  {t.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-neutral-600">{i.description || '—'}</span>
                      <span className="text-neutral-500">
                        {i.quantity} × {formatCurrency(i.unit_price)} ={' '}
                        <span className="font-medium text-neutral-900">
                          {formatCurrency((Number(i.quantity) || 0) * (Number(i.unit_price) || 0))}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}