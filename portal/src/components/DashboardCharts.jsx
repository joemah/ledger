import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

const STATUS_COLORS = {
  draft: '#a3a3a3',
  sent: '#3b82f6',
  paid: '#10b981',
  overdue: '#ef4444',
};

export default function DashboardCharts() {
  const [statusData, setStatusData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [clientData, setClientData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statusAgg, revenueAgg, clientAgg] = await Promise.all([
          api.entities.Invoice.aggregate({ groupBy: 'status' }),
          api.entities.Invoice.aggregate({ dateBucket: 'month' }),
          api.entities.Invoice.aggregate({ groupBy: 'client_name' }),
        ]);
        setStatusData(
          (statusAgg.rows || []).map((r) => ({
            name: r.status,
            value: r.sum_total || 0,
            count: r.count,
          }))
        );
        setRevenueData(
          (revenueAgg.rows || []).map((r) => ({
            month: r.month,
            revenue: r.sum_total || 0,
          }))
        );
        setClientData(
          (clientAgg.rows || []).map((r) => ({
            name: r.client_name,
            revenue: r.sum_total || 0,
            count: r.count,
          }))
        );
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="text-sm text-neutral-400 py-10 text-center">Loading analytics...</div>
    );

  const recentRevenue = revenueData.slice(-6);
  const maxClientRevenue = clientData[0]?.revenue || 1;

  return (
    <div className="grid grid-cols-2 gap-5 mb-10">
      {/* Revenue by month */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">
          Revenue — Last 6 Months
        </h3>
        {recentRevenue.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-neutral-400">
            No revenue data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recentRevenue}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#a3a3a3' }}
                axisLine={{ stroke: '#e5e5e5' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#a3a3a3' }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v) => formatCurrency(v, '').replace(/\.\d+/, '')}
              />
              <Tooltip
                formatter={(v) => [formatCurrency(v), 'Revenue']}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e5e5e5',
                }}
              />
              <Bar dataKey="revenue" fill="#171717" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Status distribution */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Status Distribution</h3>
        {statusData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-neutral-400">
            No invoices yet
          </div>
        ) : (
          <div className="flex items-center gap-6 h-[200px]">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || '#a3a3a3'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => formatCurrency(v)}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e5e5e5',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2.5">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: STATUS_COLORS[s.name] || '#a3a3a3' }}
                  />
                  <span className="text-neutral-600 capitalize">{s.name}</span>
                  <span className="text-neutral-400 text-xs">({s.count})</span>
                  <span className="text-neutral-500 text-xs ml-auto">
                    {formatCurrency(s.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top clients */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 col-span-2">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Top Clients by Revenue</h3>
        {clientData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-neutral-400">
            No client revenue data yet
          </div>
        ) : (
          <div className="space-y-3">
            {clientData.slice(0, 6).map((c, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-40 text-sm text-neutral-700 truncate font-medium">
                  {c.name || 'Unknown'}
                </div>
                <div className="flex-1 h-7 bg-neutral-100 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-neutral-900 rounded-lg flex items-center justify-end px-3 transition-all"
                    style={{ width: `${Math.max(8, (c.revenue / maxClientRevenue) * 100)}%` }}
                  >
                    <span className="text-xs text-white font-medium whitespace-nowrap">
                      {formatCurrency(c.revenue)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-neutral-400 w-20 text-right">
                  {c.count} {c.count === 1 ? 'invoice' : 'invoices'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}