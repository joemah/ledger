import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { CreditCard, Plus, Trash2, X } from 'lucide-react';
import { formatCurrency, formatDate, PAYMENT_METHODS } from '@/lib/format';

export default function PaymentPanel({ invoice, onPaymentChange }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank_transfer',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    loadPayments();
  }, [invoice.id]);

  const loadPayments = async () => {
    try {
      const res = await api.entities.Invoice.payments.list(invoice.id);
      setPayments(res.items || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const balance = Math.max(
    0,
    (invoice.total || 0) + (invoice.late_fee_amount || 0) - (invoice.amount_paid || 0)
  );

  const recordPayment = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      await api.entities.Invoice.payments.create(invoice.id, {
        ...form,
        amount: Number(form.amount),
      });
      setShowForm(false);
      setForm({
        amount: '',
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: 'bank_transfer',
        reference: '',
        notes: '',
      });
      await loadPayments();
      onPaymentChange?.();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const deletePayment = async (paymentId) => {
    if (!confirm('Delete this payment? The invoice balance will be recalculated.')) return;
    try {
      await api.entities.Invoice.payments.delete(invoice.id, paymentId);
      await loadPayments();
      onPaymentChange?.();
    } catch (e) {
      console.error(e);
    }
  };

  const paidPercent =
    invoice.total > 0
      ? Math.min(100, Math.round(((invoice.amount_paid || 0) / invoice.total) * 100))
      : 0;

  return (
    <div className="max-w-4xl mx-auto mb-8 bg-white border border-neutral-200 rounded-xl overflow-hidden no-print">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard size={18} className="text-neutral-600" />
          <h2 className="text-sm font-semibold text-neutral-900">Payments</h2>
          <span className="text-xs text-neutral-400">
            {formatCurrency(invoice.amount_paid || 0, invoice.currency)} of{' '}
            {formatCurrency(invoice.total || 0, invoice.currency)} paid
          </span>
        </div>
        {balance > 0 && invoice.status !== 'draft' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition"
          >
            <Plus size={14} /> Record Payment
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500">Payment progress</span>
          <span className="text-xs font-medium text-neutral-900">{paidPercent}%</span>
        </div>
        <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${paidPercent}%` }}
          />
        </div>
        {balance > 0 && (
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-neutral-500">Balance due</span>
            <span className="font-semibold text-neutral-900">
              {formatCurrency(balance, invoice.currency)}
            </span>
          </div>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-neutral-900">New Payment</h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-neutral-400 hover:text-neutral-900"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Amount ({invoice.currency})
              </label>
              <input
                type="number"
                step="any"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
                placeholder={balance.toFixed(2)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Date</label>
              <input
                type="date"
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Method</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:border-neutral-900"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-neutral-500 mb-1">Reference</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
                placeholder="Transaction ID, check number..."
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={recordPayment}
              disabled={saving || !form.amount}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment list */}
      {loading ? (
        <div className="p-6 text-sm text-neutral-400">Loading payments...</div>
      ) : payments.length === 0 ? (
        <div className="p-6 text-sm text-neutral-400 text-center">No payments recorded yet</div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {payments.map((p) => (
            <div
              key={p.id}
              className="px-6 py-3 flex items-center justify-between hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <CreditCard size={16} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-900">
                    {formatCurrency(p.amount, invoice.currency)}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {formatDate(p.payment_date)} ·{' '}
                    {PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ||
                      p.payment_method}
                    {p.reference && ` · ${p.reference}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => deletePayment(p.id)}
                className="p-1.5 text-neutral-300 hover:text-red-500 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}