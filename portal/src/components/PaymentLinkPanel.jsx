import { useState } from 'react';
import { api } from '@/api/client';
import { Link2, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export default function PaymentLinkPanel({ invoice, onLinkGenerated }) {
  const [showSelector, setShowSelector] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const balance = Math.max(
    0,
    (invoice.total || 0) + (invoice.late_fee_amount || 0) - (invoice.amount_paid || 0)
  );

  const generate = async (provider) => {
    setGenerating(true);
    setError('');
    setShowSelector(false);
    try {
      // Use the backend endpoint when available (standalone mode)
      if (typeof api.entities.Invoice.generatePaymentLink === 'function') {
        await api.entities.Invoice.generatePaymentLink(invoice.id, provider);
      } else {
        // Fallback for testing without the standalone backend — generate a mock link
        const mockLink = `https://pay.${provider}.com/pay/${invoice.invoice_number}-${Date.now()}`;
        await api.entities.Invoice.update(invoice.id, {
          payment_link: mockLink,
          payment_link_provider: provider,
          payment_link_id: `mock-${Date.now()}`,
        });
      }
      onLinkGenerated?.();
    } catch (e) {
      setError(
        e.message ||
          'Failed to generate payment link. Check that API credentials are configured.'
      );
    }
    setGenerating(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(invoice.payment_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (invoice.status === 'draft' || balance <= 0) return null;

  return (
    <div className="max-w-4xl mx-auto mb-8 bg-white border border-neutral-200 rounded-xl overflow-hidden no-print">
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-3">
        <Link2 size={18} className="text-neutral-600" />
        <h2 className="text-sm font-semibold text-neutral-900">Secure Payment Link</h2>
        <span className="text-xs text-neutral-400 ml-auto">
          Balance: {formatCurrency(balance, invoice.currency)}
        </span>
      </div>

      {invoice.payment_link ? (
        <div className="px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg min-w-0">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider whitespace-nowrap">
                {invoice.payment_link_provider}
              </span>
              <span className="text-sm text-neutral-700 truncate flex-1">
                {invoice.payment_link}
              </span>
            </div>
            <button
              onClick={copyLink}
              className="p-2.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition shrink-0"
              title="Copy link"
            >
              {copied ? (
                <Check size={16} className="text-emerald-600" />
              ) : (
                <Copy size={16} />
              )}
            </button>
            <a
              href={invoice.payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition shrink-0"
              title="Open link"
            >
              <ExternalLink size={16} />
            </a>
            <button
              onClick={() => setShowSelector(true)}
              className="p-2.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition shrink-0"
              title="Regenerate"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Share this link with your client — they can pay securely via{' '}
            {invoice.payment_link_provider}.
          </p>
        </div>
      ) : showSelector ? (
        <div className="px-6 py-4">
          <p className="text-sm text-neutral-600 mb-3">Choose a payment provider:</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => generate('wise')}
              disabled={generating}
              className="flex items-center gap-3 px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-900 hover:bg-neutral-50 transition text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-emerald-600 font-bold text-sm">W</span>
              </div>
              <div>
                <div className="text-sm font-medium text-neutral-900">Wise</div>
                <div className="text-xs text-neutral-400">Cross-border, low fees</div>
              </div>
            </button>
            <button
              onClick={() => generate('revolut')}
              disabled={generating}
              className="flex items-center gap-3 px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-900 hover:bg-neutral-50 transition text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-blue-600 font-bold text-sm">R</span>
              </div>
              <div>
                <div className="text-sm font-medium text-neutral-900">Revolut</div>
                <div className="text-xs text-neutral-400">Bank transfer + card</div>
              </div>
            </button>
          </div>
          {generating && (
            <p className="text-xs text-neutral-400 mt-3">Generating secure link...</p>
          )}
          <button
            onClick={() => setShowSelector(false)}
            className="text-xs text-neutral-400 mt-3 hover:text-neutral-900"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="px-6 py-4">
          <button
            onClick={() => setShowSelector(true)}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            <Link2 size={16} /> Generate Payment Link
          </button>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}