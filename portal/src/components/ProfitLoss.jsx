import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { TrendingUp, TrendingDown, Wallet, Receipt, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIE_COLORS = ['#0a0a0a', '#525252', '#a3a3a3', '#d4d4d4', '#737373', '#404040', '#e5e5e5', '#171717', '#a3a3a3', '#737373'];

const CATEGORY_LABELS = {
  software: 'Software',
  hardware: 'Hardware',
  travel: 'Travel',
  meals: 'Meals & Entertainment',
  office: 'Office Supplies',
  professional_services: 'Professional Services',
  marketing: 'Marketing',
  utilities: 'Utilities',
  rent: 'Rent',
  other: 'Other',
};

export default function ProfitLoss() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.Expense.summary()
      .then((data) => setSummary(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-400">Loading P&L...</div>;
  if (!summary) return null;

  const pieData = (summary.categories || []).map((c) => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    value: c.sum_amount,
  }));

  // Merge monthly income and expenses
  const monthMap = {};
  (summary.monthly_income || []).forEach((m) => { monthMap[m.month] = { income: m.income, expenses: 0 }; });
  (summary.monthly_expenses || []).forEach((m) => {
    if (!monthMap[m.month]) monthMap[m.month] = { income: 0, expenses: 0 };
    monthMap[m.month].expenses = m.expenses;
  });
  const barData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, vals]) => ({ month, Income: vals.income, Expenses: vals.expenses }));

  const netPositive = summary.net_profit >= 0;

  return (
    <div className="space-y-5">
      {/* P&L Summary Cards */}
      <div className="grid grid-cols-4 gap-5">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
            <Wallet size={14} /> Income (All Time)
          </div>
          <div className="text-2xl font-semibold text-neutral-900 mt-2">{formatCurrency(summary.income_total)}</div>
          <div className="text-xs text-neutral-400 mt-1">From paid invoices</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
            <Receipt size={14} /> Expenses (All Time)
          </div>
          <div className="text-2xl font-semibold text-neutral-900 mt-2">{formatCurrency(summary.expense_total)}</div>
          <div className="text-xs text-neutral-400 mt-1">{summary.categories?.length || 0} categories</div>
        </div>
        <div className={`bg-white border rounded-xl p-5 ${netPositive ? 'border-emerald-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
            {netPositive ? <TrendingUp size={14} className="text-emerald-600" /> : <TrendingDown size={14} className="text-red-600" />}
            Net Profit
          </div>
          <div className={`text-2xl font-semibold mt-2 ${netPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {netPositive ? '+' : ''}{formatCurrency(summary.net_profit)}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Income − Expenses</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
            <BarChart3 size={14} /> Tax-Deductible
          </div>
          <div className="text-2xl font-semibold text-neutral-900 mt-2">{formatCurrency(summary.tax_deductible_total)}</div>
          <div className="text-xs text-neutral-400 mt-1">Deductible expenses</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-5">
        {/* Monthly Income vs Expenses */}
        <div className="col-span-2 bg-white border border-neutral-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Income vs Expenses (Last 6 Months)</h3>
          {barData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-400">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#737373' }} />
                <YAxis tick={{ fontSize: 12, fill: '#737373' }} tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Income" fill="#0a0a0a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#d4d4d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category breakdown pie */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Expense by Category</h3>
          {pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-400">No expenses yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}