import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Repeat } from 'lucide-react';

export default function RecurringPanel() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.entities.Invoice.filter(
          { is_recurring: true },
          { sort: '-created_date', limit: 10 }
        );
        setTemplates(res.items || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  if (loading || templates.length === 0) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <Repeat size={16} className="text-neutral-600" />
        <h3 className="text-sm font-semibold text-neutral-900">Active Recurring Templates</h3>
        <span className="text-xs text-neutral-400 ml-auto">
          {templates.length} active
        </span>
      </div>
      <div className="space-y-1">
        {templates.map((t) => (
          <Link
            key={t.id}
            to={`/invoices/${t.id}`}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition"
          >
            <div>
              <div className="text-sm font-medium text-neutral-900">
                {t.client_name || '—'}
              </div>
              <div className="text-xs text-neutral-400 capitalize">
                {t.recurring_frequency}
                {t.recurring_interval > 1 ? ` (every ${t.recurring_interval})` : ''}
                {t.next_invoice_date && ` · Next: ${formatDate(t.next_invoice_date)}`}
                {t.recurring_end_date && ` · Until ${formatDate(t.recurring_end_date)}`}
              </div>
            </div>
            <div className="text-sm font-medium text-neutral-700">
              {formatCurrency(t.total, t.currency)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}