import { Navigate, useRoutes, type RouteObject } from 'react-router-dom';
import { adminRoutes } from './apps/admin/routes';
import { customerRoutes } from './apps/customer/routes';
import { staffRoutes } from './apps/staff/routes';
import { AuthBoot } from './shared/components/AuthBoot';
import { Login } from './shared/components/LoginPage';
import { useAuth } from './shared/hooks/useAuth';

function AuthHome() {
  const { session, loading } = useAuth();
  if (loading) return <AuthBoot />;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={`/${session.role.toLowerCase()}`} replace />;
}

const routes: RouteObject[] = [
  { path: '/', element: <AuthHome /> },
  { path: '/login', element: <Login /> },
  ...adminRoutes,
  ...staffRoutes,
  ...customerRoutes,
  { path: '*', element: <AuthHome /> },
];

export function App() {
  return useRoutes(routes);
}
