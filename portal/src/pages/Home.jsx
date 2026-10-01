import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Plus, FileText, Eye, Pencil } from 'lucide-react';
import { formatCurrency, formatDate, STATUS_STYLES } from '@/lib/format';
import DashboardCharts from '@/components/DashboardCharts';
import AgingReport from '@/components/AgingReport';
import RecurringPanel from '@/components/RecurringPanel';
import ProfitLoss from '@/components/ProfitLoss';
import UnbilledHours from '@/components/UnbilledHours';

export default function Home() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    outstanding: 0,
    revenue: 0,
    outstandingAmount: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [res, agg] = await Promise.all([
          api.entities.Invoice.filter({}, { sort: '-created_date', limit: 50 }),
          api.entities.Invoice.aggregate({ groupBy: 'status', sum: 'total' }),
        ]);
        setInvoices(res.items || []);
        const rows = agg.rows || [];
        const total = rows.reduce((s, r) => s + r.count, 0);
        const paidRow = rows.find((r) => r.status === 'paid');
        const paid = paidRow?.count || 0;
        const outRows = rows.filter((r) => ['sent', 'overdue', 'draft'].includes(r.status));
        const outstanding = outRows.reduce((s, r) => s + r.count, 0);
        const revenue = rows.reduce((s, r) => s + (r.sum_total || 0), 0);
        const outstandingAmount = outRows.reduce((s, r) => s + (r.sum_total || 0), 0);
        setStats({ total, paid, outstanding, revenue, outstandingAmount });
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  const statCards = [
    { label: 'Total Invoices', value: stats.total, sub: '' },
    { label: 'Paid', value: stats.paid, sub: `${stats.paid} invoices` },
    { label: 'Outstanding', value: stats.outstanding, sub: `${stats.outstanding} invoices` },
    { label: 'Total Billed', value: formatCurrency(stats.revenue), sub: 'All time' },
  ];

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage and track your invoices</p>
        </div>
        <Link
          to="/invoices/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition"
        >
          <Plus size={18} />
          New Invoice
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-10">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="text-xs uppercase tracking-wider text-neutral-400">{card.label}</div>
            <div className="text-2xl font-semibold text-neutral-900 mt-2">{card.value}</div>
            <div className="text-xs text-neutral-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      <DashboardCharts />

      <div className="mb-10">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Profit & Loss</h2>
        <ProfitLoss />
      </div>

      <UnbilledHours />

      <AgingReport />
      <RecurringPanel />

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">Recent Invoices</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-400">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-16 text-center">
            <FileText size={32} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-400 mb-4">No invoices yet</p>
            <Link
              to="/invoices/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm"
            >
              <Plus size={16} /> Create your first invoice
            </Link>
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
              {invoices.map((inv) => {
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