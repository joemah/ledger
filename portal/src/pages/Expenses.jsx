import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Plus, Pencil, Trash2, Receipt, X, Check, Minus } from 'lucide-react';
import { formatCurrency, formatDate, CURRENCIES } from '@/lib/format';

const CATEGORIES = [
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS = {
  software: 'bg-blue-100 text-blue-700',
  hardware: 'bg-purple-100 text-purple-700',
  travel: 'bg-amber-100 text-amber-700',
  meals: 'bg-orange-100 text-orange-700',
  office: 'bg-teal-100 text-teal-700',
  professional_services: 'bg-indigo-100 text-indigo-700',
  marketing: 'bg-pink-100 text-pink-700',
  utilities: 'bg-cyan-100 text-cyan-700',
  rent: 'bg-red-100 text-red-700',
  other: 'bg-neutral-100 text-neutral-700',
};

const EMPTY_FORM = {
  description: '',
  category: 'other',
  amount: '',
  currency: 'EUR',
  expense_date: new Date().toISOString().slice(0, 10),
  vendor: '',
  payment_method: 'card',
  tax_deductible: true,
  notes: '',
};

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState('all');
  const [showCategories, setShowCategories] = useState(false);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, deductible: 0 });

  const loadExpenses = async () => {
    try {
      const res = await api.entities.Expense.filter({}, { sort: '-expense_date', limit: 200 });
      setExpenses(res.items || []);
      const items = res.items || [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setStats({
        total: items.reduce((s, e) => s + (e.amount || 0), 0),
        thisMonth: items
          .filter((e) => e.expense_date && new Date(e.expense_date) >= monthStart)
          .reduce((s, e) => s + (e.amount || 0), 0),
        deductible: items.filter((e) => e.tax_deductible).reduce((s, e) => s + (e.amount || 0), 0),
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadExpenses(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (expense) => {
    setForm({
      description: expense.description || '',
      category: expense.category || 'other',
      amount: expense.amount || '',
      currency: expense.currency || 'EUR',
      expense_date: expense.expense_date || '',
      vendor: expense.vendor || '',
      payment_method: expense.payment_method || 'card',
      tax_deductible: expense.tax_deductible !== false,
      notes: expense.notes || '',
    });
    setEditingId(expense.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    const data = { ...form, amount: parseFloat(form.amount) };
    try {
      if (editingId) {
        await api.entities.Expense.update(editingId, data);
      } else {
        await api.entities.Expense.create(data);
      }
      setShowForm(false);
      loadExpenses();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.entities.Expense.delete(id);
      loadExpenses();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = filterCategory === 'all'
    ? expenses
    : expenses.filter((e) => e.category === filterCategory);

  const statCards = [
    { label: 'Total Expenses', value: formatCurrency(stats.total), sub: 'All time' },
    { label: 'This Month', value: formatCurrency(stats.thisMonth), sub: new Date().toLocaleDateString('en-US', { month: 'long' }) },
    { label: 'Tax-Deductible', value: formatCurrency(stats.deductible), sub: 'Claimable on taxes' },
    { label: 'Total Entries', value: expenses.length, sub: 'Expense records' },
  ];

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Expenses</h1>
          <p className="text-sm text-neutral-500 mt-1">Track business expenses and monitor profitability</p>
        </div>
        <button
          onClick={showForm ? () => setShowForm(false) : openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Close Form' : 'Add Expense'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="text-xs uppercase tracking-wider text-neutral-400">{card.label}</div>
            <div className="text-2xl font-semibold text-neutral-900 mt-2">{card.value}</div>
            <div className="text-xs text-neutral-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Embedded add/edit form */}
      {showForm && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">{editingId ? 'Edit Expense' : 'New Expense'}</h2>
              <p className="text-xs text-neutral-400 mt-0.5">{editingId ? 'Update the details below' : 'Record a new business expense'}</p>
            </div>
            <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-900 transition">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-6 gap-4">
            <div className="col-span-4">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
                placeholder="e.g. Adobe Creative Cloud subscription"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Vendor</label>
              <input
                type="text"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
                placeholder="e.g. Adobe Inc."
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
                placeholder="0.00"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition bg-white"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Date</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition"
              />
            </div>
            <div className="col-span-3">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition bg-white"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Payment Method</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition bg-white"
              >
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="col-span-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.tax_deductible}
                  onChange={(e) => setForm({ ...form, tax_deductible: e.target.checked })}
                  className="w-4 h-4 accent-neutral-900"
                />
                <span className="text-sm text-neutral-700">Tax-deductible expense</span>
              </label>
            </div>
            <div className="col-span-6">
              <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-900 transition resize-none"
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-neutral-100">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.description || !form.amount}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-50"
            >
              <Check size={16} />
              {editingId ? 'Update Expense' : 'Add Expense'}
            </button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-4 py-1.5 rounded-full text-sm transition ${
            filterCategory === 'all' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          All Categories
        </button>
        {(showCategories ? CATEGORIES : CATEGORIES.slice(0, 4)).map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(cat.value)}
            className={`px-4 py-1.5 rounded-full text-sm transition ${
              filterCategory === cat.value ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
        <button
          onClick={() => setShowCategories((v) => !v)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition"
          title={showCategories ? 'Show less' : 'Show more'}
        >
          {showCategories ? <Minus size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {/* Expense table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Receipt size={32} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-400 mb-4">No expenses recorded yet</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm"
            >
              <Plus size={16} /> Add your first expense
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Description</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Category</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Vendor</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Date</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Method</th>
                <th className="text-center text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Deductible</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Amount</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => {
                const cat = CATEGORIES.find((c) => c.value === exp.category);
                const colorClass = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.other;
                return (
                  <tr key={exp.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{exp.description}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                        {cat?.label || exp.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{exp.vendor || '—'}</td>
                    <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(exp.expense_date)}</td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {PAYMENT_METHODS.find((m) => m.value === exp.payment_method)?.label || exp.payment_method}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {exp.tax_deductible ? (
                        <Check size={16} className="inline text-emerald-600" />
                      ) : (
                        <X size={16} className="inline text-neutral-300" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-neutral-900 text-right">
                      {formatCurrency(exp.amount, exp.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(exp)} className="p-1.5 text-neutral-400 hover:text-neutral-900 transition" title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="p-1.5 text-neutral-400 hover:text-red-600 transition" title="Delete">
                          <Trash2 size={16} />
                        </button>
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