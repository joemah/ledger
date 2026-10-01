import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { formatCurrency } from '@/lib/format';
import { AlertTriangle } from 'lucide-react';

const BRACKET_COLORS = [
  'bg-emerald-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-red-700',
];

export default function AgingReport() {
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.entities.Invoice.aging();
        setBrackets(res.brackets || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  if (loading || brackets.length === 0) return null;

  const totalOverdue = brackets.slice(1).reduce((s, b) => s + b.amount, 0);
  const totalOutstanding = brackets.reduce((s, b) => s + b.amount, 0);
  if (totalOutstanding === 0) return null;

  const maxAmount = Math.max(...brackets.map((b) => b.amount), 1);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} className="text-neutral-600" />
        <h3 className="text-sm font-semibold text-neutral-900">Aging Report</h3>
        {totalOverdue > 0 && (
          <span className="text-xs text-red-500 ml-auto font-medium">
            {formatCurrency(totalOverdue)} overdue
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        {brackets.map((b, i) => (
          <div key={b.key} className="flex items-center gap-3">
            <div className="w-20 text-xs text-neutral-500">{b.label}</div>
            <div className="flex-1 h-6 bg-neutral-100 rounded-lg overflow-hidden">
              <div
                className={`h-full ${BRACKET_COLORS[i]} rounded-lg flex items-center justify-end px-2 transition-all`}
                style={{ width: `${Math.max(4, (b.amount / maxAmount) * 100)}%` }}
              >
                {b.amount > 0 && (
                  <span className="text-xs text-white font-medium whitespace-nowrap">
                    {formatCurrency(b.amount)}
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-neutral-400 w-10 text-right">{b.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}