import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Plus, Pencil, Trash2, Users, X, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const EMPTY = {
  name: '',
  contact_person: '',
  address: '',
  city: '',
  postal_code: '',
  country: '',
  email: '',
  phone: '',
  vat_number: '',
  website: '',
  social_linkedin: '',
};

const FIELDS = [
  { key: 'name', label: 'Company Name', required: true, span: 2 },
  { key: 'contact_person', label: 'Contact Person' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address', span: 2 },
  { key: 'city', label: 'City' },
  { key: 'postal_code', label: 'Postal Code' },
  { key: 'country', label: 'Country' },
  { key: 'vat_number', label: 'VAT Number' },
  { key: 'website', label: 'Website', span: 2 },
  { key: 'social_linkedin', label: 'LinkedIn', span: 2 },
];

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [res, agg] = await Promise.all([
        api.entities.Client.filter({}, { sort: 'name', limit: 200 }),
        api.entities.Invoice.aggregate({ groupBy: 'client_name', sum: 'total' }),
      ]);
      setClients(res.items || []);
      const map = {};
      (agg.rows || []).forEach((r) => {
        map[r.client_name] = { count: r.count, total: r.sum_total || 0 };
      });
      setStats(map);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(EMPTY);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (client) => {
    setForm({ ...EMPTY, ...client });
    setEditing(client);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing) {
        await api.entities.Client.update(editing.id, form);
      } else {
        await api.entities.Client.create(form);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const remove = async (client) => {
    if (!confirm(`Delete client "${client.name}"?`)) return;
    try {
      await api.entities.Client.delete(client.id);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Clients</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage your client directory</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition"
        >
          <Plus size={18} />
          Add Client
        </button>
      </div>

      {/* Embedded inline form — part of the page flow, not a modal */}
      {showForm && (
        <div className="bg-white border border-neutral-200 rounded-xl mb-6 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">{editing ? 'Edit Client' : 'New Client'}</h2>
            <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-900 transition">
              <X size={18} />
            </button>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                  {f.label}
                  {f.required && <span className="text-red-400"> *</span>}
                </label>
                <input
                  type="text"
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
                />
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !form.name}
              className="px-5 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Client'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-neutral-400 py-16">Loading...</div>
      ) : clients.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-16 text-center">
          <Users size={32} className="mx-auto text-neutral-300 mb-3" />
          <p className="text-sm text-neutral-400 mb-4">No clients yet</p>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm">
            <Plus size={16} /> Add your first client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {clients.map((c) => {
            const s = stats[c.name] || { count: 0, total: 0 };
            return (
              <div key={c.id} className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-neutral-900">{c.name}</div>
                    {c.contact_person && <div className="text-xs text-neutral-400 mt-0.5">{c.contact_person}</div>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-neutral-400 hover:text-neutral-900 transition">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => remove(c)} className="p-1.5 text-neutral-400 hover:text-red-500 transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-neutral-500 space-y-1 flex-1">
                  {c.email && <div>{c.email}</div>}
                  {c.phone && <div>{c.phone}</div>}
                  {(c.city || c.country) && (
                    <div className="text-neutral-400">{[c.postal_code, c.city, c.country].filter(Boolean).join(', ')}</div>
                  )}
                  {c.vat_number && <div className="text-neutral-400">VAT: {c.vat_number}</div>}
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-neutral-500">
                    <FileText size={13} />
                    <span>{s.count} invoice{s.count !== 1 ? 's' : ''}</span>
                  </div>
                  {s.total > 0 && (
                    <div className="font-medium text-neutral-900">{formatCurrency(s.total)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}