import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Users, Building2, LayoutDashboard, Plus, LogOut, Receipt, Clock, FileText, Layers, Sparkles } from 'lucide-react';
import { api } from '@/api/client';
import FloatingTimer from '@/components/FloatingTimer';
import { useState, useEffect } from 'react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    api.entities.Company.filter({}, { limit: 1 })
      .then((res) => setCompany(res.items[0] || null))
      .catch(() => {});
  }, []);

  const nav = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Invoices', path: '/invoices', icon: FileText },
    { label: 'Clients', path: '/clients', icon: Users },
    { label: 'Expenses', path: '/expenses', icon: Receipt },
    { label: 'Time Tracking', path: '/time-tracking', icon: Clock },
    { label: 'Templates', path: '/templates', icon: Layers },
    { label: 'Assistant', path: '/invoice-assistant', icon: Sparkles },
    { label: 'Company', path: '/company', icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside className="w-64 bg-neutral-900 text-white flex flex-col fixed h-full">
        <div className="p-6 border-b border-white/10">
          {company?.logo ? (
            <img src={company.logo} alt="logo" className="h-10 mb-2 object-contain" />
          ) : (
            <div className="h-10 mb-2 flex items-center">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-neutral-900 font-bold text-sm">
                {(company?.name || 'I')[0]}
              </div>
            </div>
          )}
          <div className="text-sm font-medium tracking-wide">
            {company?.name || 'Invoice Admin'}
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? 'bg-white text-neutral-900 font-medium'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => navigate('/invoices/new')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition mt-4"
          >
            <Plus size={18} />
            New Invoice
          </button>
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => api.auth.logout()}
            className="flex items-center gap-3 px-3 py-2 text-sm text-white/40 hover:text-white transition"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-64 min-h-screen min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
      <FloatingTimer />
    </div>
  );
}
//