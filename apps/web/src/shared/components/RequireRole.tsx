import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from '../../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { QueryState } from './ui';

export function RequireRole({ role, children }: { role: Session['role']; children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <QueryState loading>{null}</QueryState>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (session.role !== role) {
    return <Navigate to={`/${session.role.toLowerCase()}`} replace />;
  }

  return <>{children}</>;
}
