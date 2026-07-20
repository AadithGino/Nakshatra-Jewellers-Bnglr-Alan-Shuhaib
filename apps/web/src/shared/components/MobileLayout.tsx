import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Users, ReceiptIndianRupee, UserRound, LogOut, CirclePlus, Gem } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BrandMark } from './BrandLogo';

export function MobileLayout({ role }: { role: 'staff' | 'customer' }) {
  const { logout } = useAuth();
  const location = useLocation();
  const focusedPayment =
    role === 'customer' && /\/customer\/schemes\/[^/]+\/pay\/?$/.test(location.pathname);
  const compactCollect = role === 'staff' && /^\/staff\/collect\/?$/.test(location.pathname);

  const links =
    role === 'staff'
      ? ([
          [`/${role}`, Home, 'Home'],
          [`/${role}/customers`, Users, 'Customers'],
          [`/${role}/collect`, CirclePlus, 'Collect'],
          [`/${role}/payments`, ReceiptIndianRupee, 'Payments'],
          [`/${role}/profile`, UserRound, 'Profile'],
        ] as const)
      : ([
          [`/${role}`, Home, 'Home'],
          [`/${role}/schemes`, Gem, 'Scheme'],
          [`/${role}/payments`, ReceiptIndianRupee, 'Payments'],
          [`/${role}/profile`, UserRound, 'Profile'],
        ] as const);

  return (
    <div
      className={`mobile-shell${focusedPayment ? ' payment-focus' : ''}${compactCollect ? ' collect-focus' : ''}`}
    >
      {!focusedPayment && !compactCollect && (
        <header className={`mobile-app-header ${role}`}>
          <BrandMark
            variant="white"
            size={42}
            title="Nakshathra"
            subtitle="Jewellery Savings Schemes"
            inverted
            className="mobile-brand"
          />
          <button className="mobile-logout" aria-label="Logout" onClick={() => void logout()}>
            <LogOut />
          </button>
        </header>
      )}
      <main>
        <Outlet />
      </main>
      {!focusedPayment && (
        <nav>
          {links.map(([to, Icon, label]) => (
            <NavLink to={to} end={to === `/${role}`} key={to}>
              <Icon />
              <small>{label}</small>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
