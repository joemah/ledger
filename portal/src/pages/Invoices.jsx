import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Plus, Eye, Pencil, Search, FileText } from 'lucide-react';
import { formatCurrency, formatDate, STATUS_STYLES } from '@/lib/format';

const STATUS_TABS = ['all', 'draft', 'sent', 'paid', 'overdue'];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({ all: 0, draft: 0, sent: 0, paid: 0, overdue: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const query = status === 'all' ? {} : { status };
      const res = await api.entities.Invoice.filter(query, { sort: '-created_date', limit: 200 });
      setInvoices(res.items || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadCounts = async () => {
    try {
      const agg = await api.entities.Invoice.aggregate({ groupBy: 'status', sum: 'total' });
      const rows = agg.rows || [];
      const map = { all: 0, draft: 0, sent: 0, paid: 0, overdue: 0 };
      rows.forEach((r) => {
        if (map[r.status] !== undefined) map[r.status] = r.count;
        map.all += r.count;
      });
      setCounts(map);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  useEffect(() => {
    loadCounts();
  }, []);

  const filtered = search.trim()
    ? invoices.filter(
        (inv) =>
          (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
          (inv.client_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Invoices</h1>
          <p className="text-sm text-neutral-500 mt-1">All your invoices in one place</p>
        </div>
        <Link
          to="/invoices/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition"
        >
          <Plus size={18} />
          New Invoice
        </Link>
      </div>

      {/* Status filter tabs + search */}
      <div className="flex items-end justify-between gap-4 mb-6 border-b border-neutral-200">
        <div className="flex items-center gap-1">
          {STATUS_TABS.map((tab) => {
            const active = status === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatus(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition ${
                  active
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-400 hover:text-neutral-700'
                }`}
              >
                {tab}
                <span className="ml-2 text-xs text-neutral-400">{counts[tab]}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by invoice number or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
          />
        </div>
      </div>

      {/* Invoice table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <FileText size={32} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-400 mb-4">
              {search ? 'No invoices match your search' : 'No invoices yet'}
            </p>
            {!search && (
              <Link
                to="/invoices/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm"
              >
                <Plus size={16} /> Create your first invoice
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Invoice #</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Client</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Issued</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Due</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Status</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Total</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const st = STATUS_STYLES[inv.status] || STATUS_STYLES.draft;
                return (
                  <tr key={inv.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{inv.client_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(inv.issue_date)}</td>
                    <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(inv.due_date)}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                        <span className={st.text}>{st.label}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900 text-right">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/invoices/${inv.id}`} className="p-1.5 text-neutral-400 hover:text-neutral-900 transition" title="View">
                          <Eye size={16} />
                        </Link>
                        <Link to={`/invoices/${inv.id}/edit`} className="p-1.5 text-neutral-400 hover:text-neutral-900 transition" title="Edit">
                          <Pencil size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}