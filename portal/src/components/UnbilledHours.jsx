import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Clock, FileText, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export default function UnbilledHours() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoicing, setInvoicing] = useState(null);

  useEffect(() => {
    api.entities.TimeEntry.unbilled()
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateInvoice = async (clientId) => {
    setInvoicing(clientId);
    try {
      const invoice = await api.entities.TimeEntry.createInvoice(clientId);
      navigate(`/invoices/${invoice.id}/edit`);
    } catch (e) {
      console.error(e);
      alert('Failed to create invoice. Make sure there are unbilled entries for this client.');
    }
    setInvoicing(null);
  };

  if (loading) return null;
  if (!data || data.total_entries === 0) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-neutral-700" />
          <h2 className="text-sm font-semibold text-neutral-900">Unbilled Time</h2>
        </div>
        <Link to="/time-tracking" className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1">
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-5 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-400">Unbilled Hours</div>
          <div className="text-xl font-semibold text-neutral-900 mt-1">{data.total_hours.toFixed(1)}h</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-400">Unbilled Value</div>
          <div className="text-xl font-semibold text-neutral-900 mt-1">{formatCurrency(data.total_value)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-400">Entries</div>
          <div className="text-xl font-semibold text-neutral-900 mt-1">{data.total_entries}</div>
        </div>
      </div>
      <div className="space-y-2">
        {data.clients.map((c) => (
          <div key={c.client_id} className="flex items-center justify-between py-2 border-t border-neutral-100">
            <div>
              <div className="text-sm font-medium text-neutral-900">{c.client_name}</div>
              <div className="text-xs text-neutral-400">{c.hours.toFixed(1)}h · {c.entries} entries</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-neutral-900">{formatCurrency(c.value)}</div>
              <button
                onClick={() => handleCreateInvoice(c.client_id)}
                disabled={invoicing === c.client_id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition disabled:opacity-50"
              >
                <FileText size={12} />
                {invoicing === c.client_id ? 'Creating...' : 'Invoice'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}