import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from '../../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { AuthBoot } from './AuthBoot';

export function RequireRole({ role, children }: { role: Session['role']; children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthBoot />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (session.role !== role) {
    return <Navigate to={`/${session.role.toLowerCase()}`} replace />;
  }

  return <>{children}</>;
}
