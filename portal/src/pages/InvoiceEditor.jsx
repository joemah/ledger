import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Plus, Trash2, ArrowLeft, Save, X } from 'lucide-react';
import { formatCurrency, CURRENCIES, STATUS_STYLES } from '@/lib/format';

function deriveBrandCode(name) {
  if (!name) return 'CONS';
  const words = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  }
  return words[0].toUpperCase().slice(0, 4) || 'CONS';
}

export default function InvoiceEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [tplName, setTplName] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 30);

  const [form, setForm] = useState({
    invoice_number: '',
    status: 'draft',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: defaultDue.toISOString().slice(0, 10),
    client_id: '',
    currency: 'EUR',
    tax_rate: 0,
    discount_type: 'none',
    discount_value: 0,
    amount_paid: 0,
    notes: '',
    payment_terms: 'Payment due within 30 days.',
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
    is_recurring: false,
    recurring_frequency: 'none',
    recurring_interval: 1,
    next_invoice_date: '',
    recurring_end_date: '',
    late_fee_type: 'none',
    late_fee_value: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [clientRes, tplRes] = await Promise.all([
          api.entities.Client.filter({}, { sort: 'name', limit: 200 }),
          api.entities.ItemTemplate.filter({}, { sort: 'name', limit: 200 }),
        ]);
        setClients(clientRes.items || []);
        setTemplates(tplRes.items || []);

        if (isEdit) {
          const inv = await api.entities.Invoice.get(id);
          setForm({
            ...inv,
            discount_type: inv.discount_type || 'none',
            discount_value: inv.discount_value || 0,
            amount_paid: inv.amount_paid || 0,
            is_recurring: inv.is_recurring || false,
            recurring_frequency: inv.recurring_frequency || 'none',
            recurring_interval: inv.recurring_interval || 1,
            next_invoice_date: inv.next_invoice_date || '',
            recurring_end_date: inv.recurring_end_date || '',
            late_fee_type: inv.late_fee_type || 'none',
            late_fee_value: inv.late_fee_value || 0,
            // Null columns crash controlled inputs; normalise to ''.
            status: inv.status || 'draft',
            currency: inv.currency || 'EUR',
            notes: inv.notes || '',
            payment_terms: inv.payment_terms || '',
            issue_date: inv.issue_date || '',
            due_date: inv.due_date || '',
            items: inv.items?.length ? inv.items : [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
          });
        } else {
          const year = new Date().getFullYear();
          const [companyRes, yearCount] = await Promise.all([
            api.entities.Company.filter({}, { limit: 1 }),
            api.entities.Invoice.count({
              issue_date: { $gte: `${year}-01-01`, $lt: `${year + 1}-01-01` },
            }),
          ]);
          const comp = companyRes.items[0];
          const prefix = (comp?.invoice_prefix || deriveBrandCode(comp?.name)).toUpperCase();
          setForm((f) => ({
            ...f,
            invoice_number: `${prefix}-${year}-${String(yearCount + 1).padStart(4, '0')}`,
          }));
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [id]);

  const subtotal = form.items.reduce((s, item) => s + (Number(item.quantity) * Number(item.unit_price)), 0);
  const discountAmount =
    form.discount_type === 'percent'
      ? subtotal * (Number(form.discount_value) / 100)
      : form.discount_type === 'amount'
      ? Number(form.discount_value)
      : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = discountedSubtotal * (Number(form.tax_rate) / 100);
  const total = discountedSubtotal + taxAmount;
  const balance = Math.max(0, total - Number(form.amount_paid));

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    items[index].total = Number(items[index].quantity) * Number(items[index].unit_price);
    setForm({ ...form, items });
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit_price: 0, total: 0 }] });
  };

  const removeItem = (index) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const applyTemplate = (e) => {
    const tplId = e.target.value;
    if (!tplId) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl && tpl.items?.length) {
      setForm((f) => ({
        ...f,
        items: tpl.items.map((i) => ({
          description: i.description || '',
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          total: (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
        })),
      }));
    }
    e.target.value = '';
  };

  const saveAsTemplate = async () => {
    if (!tplName.trim()) return;
    setSavingTpl(true);
    try {
      await api.entities.ItemTemplate.create({
        name: tplName.trim(),
        items: form.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity) || 0,
          unit_price: Number(i.unit_price) || 0,
        })),
      });
      const res = await api.entities.ItemTemplate.filter({}, { sort: 'name', limit: 200 });
      setTemplates(res.items || []);
      setTplName('');
      setShowSaveTpl(false);
    } catch (e) {
      console.error(e);
    }
    setSavingTpl(false);
  };

  const save = async () => {
    if (!form.client_id) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        tax_rate: Number(form.tax_rate),
        discount_value: Number(form.discount_value),
        discount_amount: discountAmount,
        amount_paid: Number(form.amount_paid),
        balance,
        subtotal,
        tax_amount: taxAmount,
        total,
        client_name: clients.find((c) => c.id === form.client_id)?.name || '',
        // Cleared date inputs post ''; the API expects null.
        issue_date: form.issue_date || null,
        due_date: form.due_date || null,
        next_invoice_date: form.next_invoice_date || null,
        recurring_end_date: form.recurring_end_date || null,
      };
      if (isEdit) {
        await api.entities.Invoice.update(id, data);
        navigate(`/invoices/${id}`);
      } else {
        const created = await api.entities.Invoice.create(data);
        navigate(`/invoices/${created.id}`);
      }
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-sm text-neutral-400">Loading...</div>;

  return (
    <div className="p-10 max-w-5xl">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="p-2 text-neutral-400 hover:text-neutral-900 transition">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
          <p className="text-sm text-neutral-500 mt-1">{form.invoice_number}</p>
        </div>
      </div>

      {clients.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-700">
          You need to add at least one client before creating an invoice.{' '}
          <Link to="/clients" className="underline font-medium">Add a client →</Link>
        </div>
      )}

      {/* Top row: invoice meta */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Client</label>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition bg-white"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Invoice Number</label>
            <input
              type="text"
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Issue Date</label>
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition bg-white"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition bg-white"
            >
              {Object.entries(STATUS_STYLES).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">Line Items</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {templates.length > 0 && (
              <select
                onChange={applyTemplate}
                value=""
                className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:border-neutral-900"
              >
                <option value="">Apply template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {!showSaveTpl ? (
              <button
                onClick={() => setShowSaveTpl(true)}
                className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition"
              >
                <Save size={16} /> Save as template
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Template name"
                  className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
                />
                <button
                  onClick={saveAsTemplate}
                  disabled={savingTpl || !tplName.trim()}
                  className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {savingTpl ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowSaveTpl(false); setTplName(''); }}
                  className="p-1.5 text-neutral-400 hover:text-neutral-900"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition">
              <Plus size={16} /> Add item
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {form.items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 items-start">
              <div className="col-span-6">
                <input
                  type="text"
                  placeholder="Description of work"
                  value={item.description}
                  onChange={(e) => updateItem(i, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-right focus:outline-none focus:border-neutral-900 transition"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Unit price"
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-right focus:outline-none focus:border-neutral-900 transition"
                />
              </div>
              <div className="col-span-1 flex items-center justify-end py-2 text-sm font-medium text-neutral-900">
                {formatCurrency(item.total, form.currency)}
              </div>
              <div className="col-span-1 flex items-center justify-end">
                {form.items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="p-1.5 text-neutral-300 hover:text-red-500 transition">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals + tax */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
        <div className="flex justify-between gap-12">
          <div className="flex-1">
            <div className="mb-4 flex gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">Tax Rate (%)</label>
                <input
                  type="number"
                  step="any"
                  value={form.tax_rate}
                  onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                  className="w-28 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">Discount</label>
                <div className="flex gap-2">
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                    className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition bg-white"
                  >
                    <option value="none">None</option>
                    <option value="amount">Flat amount</option>
                    <option value="percent">Percentage</option>
                  </select>
                  {form.discount_type !== 'none' && (
                    <input
                      type="number"
                      step="any"
                      value={form.discount_value}
                      onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                      placeholder={form.discount_type === 'percent' ? '%' : '0.00'}
                      className="w-24 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Amount Already Paid</label>
              <input
                type="number"
                step="any"
                value={form.amount_paid}
                onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                className="w-40 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes for the client..."
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition resize-none"
              />
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Payment Terms</label>
              <input
                type="text"
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
              />
            </div>
          </div>
          <div className="w-64 space-y-3 pt-7">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal, form.currency)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">
                  Discount{form.discount_type === 'percent' ? ` (${form.discount_value}%)` : ''}
                </span>
                <span className="font-medium text-emerald-600">−{formatCurrency(discountAmount, form.currency)}</span>
              </div>
            )}
            {Number(form.tax_rate) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Tax ({form.tax_rate}%)</span>
                <span className="font-medium">{formatCurrency(taxAmount, form.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-neutral-900 pt-3 text-lg font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total, form.currency)}</span>
            </div>
            {Number(form.amount_paid) > 0 && (
              <>
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-neutral-500">Amount Paid</span>
                  <span className="font-medium text-emerald-600">−{formatCurrency(Number(form.amount_paid), form.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-300 pt-2 font-semibold">
                  <span>Balance Due</span>
                  <span>{formatCurrency(balance, form.currency)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recurring & Late Fees */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Recurring & Late Fees</h2>
        <p className="text-xs text-neutral-400 mb-4">Automate repeat billing and penalize late payments</p>
        <div className="grid grid-cols-2 gap-6">
          {/* Recurring */}
          <div>
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                className="w-4 h-4 accent-neutral-900"
              />
              <span className="text-sm font-medium text-neutral-900">Recurring Invoice</span>
            </label>
            {form.is_recurring && (
              <div className="space-y-3 pl-6 border-l-2 border-neutral-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Frequency</label>
                    <select
                      value={form.recurring_frequency}
                      onChange={(e) => setForm({ ...form, recurring_frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:border-neutral-900"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Every N periods</label>
                    <input
                      type="number"
                      min="1"
                      value={form.recurring_interval}
                      onChange={(e) => setForm({ ...form, recurring_interval: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Next Invoice Date</label>
                    <input
                      type="date"
                      value={form.next_invoice_date || ''}
                      onChange={(e) => setForm({ ...form, next_invoice_date: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">End Date (optional)</label>
                    <input
                      type="date"
                      value={form.recurring_end_date || ''}
                      onChange={(e) => setForm({ ...form, recurring_end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Late fees */}
          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-3">Late Fee</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">Fee Type</label>
                <select
                  value={form.late_fee_type}
                  onChange={(e) => setForm({ ...form, late_fee_type: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:border-neutral-900"
                >
                  <option value="none">No late fee</option>
                  <option value="flat">Flat amount</option>
                  <option value="percent">Percentage</option>
                </select>
              </div>
              {form.late_fee_type !== 'none' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                    {form.late_fee_type === 'percent' ? 'Percentage (%)' : 'Amount'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.late_fee_value}
                    onChange={(e) => setForm({ ...form, late_fee_value: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
                  />
                </div>
              )}
            </div>
            {form.late_fee_type !== 'none' && (
              <p className="text-xs text-neutral-400 mt-2">
                Applied automatically when the invoice becomes overdue.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving || !form.client_id}
          className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition"
        >
          <Save size={16} />
          {saving ? 'Saving...' : isEdit ? 'Update Invoice' : 'Create Invoice'}
        </button>
        <Link to="/" className="px-5 py-2.5 text-sm text-neutral-600 hover:text-neutral-900 transition">
          Cancel
        </Link>
      </div>
    </div>
  );
}