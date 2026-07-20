import { useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserRound,
  Layers3,
  Landmark,
  ReceiptIndianRupee,
  WalletCards,
  Smartphone,
  RefreshCcw,
  HandCoins,
  BarChart3,
  CalendarDays,
  ScrollText,
  Settings,
  LogOut,
  Search,
  Bell,
  CircleHelp,
} from 'lucide-react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { BrandMark } from '../../../shared/components/BrandLogo';
const links = [
  ['/admin', 'Dashboard', LayoutDashboard],
  ['/admin/staff', 'Staff', Users],
  ['/admin/customers', 'Customers', UserRound],
  ['/admin/scheme-plans', 'Scheme Plans', Layers3],
  ['/admin/enrollments', 'Enrollments', Landmark],
  ['/admin/gold-rates', 'Gold Rates', WalletCards],
  ['/admin/payments', 'Payments', ReceiptIndianRupee],
  ['/admin/phonepe-transactions', 'PhonePe', Smartphone],
  ['/admin/cash-submissions', 'Cash Submissions', HandCoins],
  ['/admin/corrections', 'Corrections', RefreshCcw],
  ['/admin/payouts', 'Payouts', HandCoins],
  ['/admin/reports', 'Reports', BarChart3],
  ['/admin/maturity', 'Scheme Timeline', CalendarDays],
  ['/admin/audit-logs', 'Audit Logs', ScrollText],
  ['/admin/settings', 'Settings', Settings],
] as const;
export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  return (
    <div className="admin-shell">
      <aside>
        <BrandMark
          variant="white"
          size={44}
          title="Nakshathra"
          subtitle="916 SAVINGS SCHEME"
          inverted
          className="admin-brand"
        />
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink to={to} end={to === '/admin'} key={to}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <button className="logout" onClick={() => void logout()}>
          <LogOut />
          Logout
        </button>
      </aside>
      <main className="admin-content">
        <header className="admin-topbar">
          <form className="admin-search" onSubmit={(event: FormEvent) => { event.preventDefault(); if (search.trim()) navigate(`/admin/customers?search=${encodeURIComponent(search.trim())}`); }}>
            <Search />
            <input aria-label="Global search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer name, mobile or ID…" />
          </form>
          <div className="admin-top-actions">
            <button aria-label="Open settings and help" onClick={() => navigate('/admin/settings')}>
              <CircleHelp />
            </button>
            <button aria-label="Open audit activity" className="notification-button" onClick={() => navigate('/admin/audit-logs')}>
              <Bell />
            </button>
            <span className="admin-avatar">A</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
