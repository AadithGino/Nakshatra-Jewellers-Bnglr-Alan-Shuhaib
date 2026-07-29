import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  ScrollText,
  Settings,
  LogOut,
  Search,
  Bell,
  CircleHelp,
  Menu,
  X,
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
  ['/admin/audit-logs', 'Audit Logs', ScrollText],
  ['/admin/settings', 'Settings', Settings],
] as const;
export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const quickLinks = [
    ['/admin', 'Home', LayoutDashboard],
    ['/admin/customers', 'Customers', UserRound],
    ['/admin/payments', 'Payments', ReceiptIndianRupee],
    ['/admin/payouts', 'Payouts', HandCoins],
    ['/admin/reports', 'Reports', BarChart3],
  ] as const;

  return (
    <div className={`admin-shell ${menuOpen ? 'menu-open' : ''}`}>
      <button
        type="button"
        className="admin-mobile-overlay"
        aria-label="Close menu"
        onClick={() => setMenuOpen(false)}
      />
      <aside>
        <BrandMark
          variant="white"
          size={44}
          title="Nakshathra"
          subtitle="916 SAVINGS SCHEME"
          inverted
          className="admin-brand"
        />
        <button
          type="button"
          className="admin-menu-close"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        >
          <X />
        </button>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink to={to} end={to === '/admin'} key={to} onClick={() => setMenuOpen(false)}>
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
          <button
            type="button"
            className="admin-menu-toggle"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </button>
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
      <nav className="admin-bottom-nav">
        {quickLinks.map(([to, label, Icon]) => (
          <NavLink to={to} end={to === '/admin'} key={to}>
            <Icon />
            <small>{label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
