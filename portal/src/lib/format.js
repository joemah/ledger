export const CURRENCY_SYMBOLS = {
  EUR: '€',
  CHF: 'CHF',
  GBP: '£',
  USD: '$',
};

export const CURRENCIES = ['EUR', 'CHF', 'GBP', 'USD'];

export function formatCurrency(amount, currency = 'EUR') {
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  const num = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (currency === 'CHF') return `${symbol} ${num}`;
  return `${symbol}${num}`;
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const STATUS_STYLES = {
  draft: { label: 'Draft', dot: 'bg-neutral-400', text: 'text-neutral-600' },
  sent: { label: 'Sent', dot: 'bg-blue-500', text: 'text-blue-600' },
  paid: { label: 'Paid', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  overdue: { label: 'Overdue', dot: 'bg-red-500', text: 'text-red-600' },
};

export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
];