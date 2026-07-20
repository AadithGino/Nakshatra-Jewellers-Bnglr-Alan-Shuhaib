import { Navigate, useRoutes, type RouteObject } from 'react-router-dom';
import { adminRoutes } from './apps/admin/routes';
import { customerRoutes } from './apps/customer/routes';
import { staffRoutes } from './apps/staff/routes';
import { Login } from './shared/components/LoginPage';

const routes: RouteObject[] = [
  { path: '/login', element: <Login /> },
  ...adminRoutes,
  ...staffRoutes,
  ...customerRoutes,
  { path: '*', element: <Navigate to="/login" replace /> },
];

export function App() {
  return useRoutes(routes);
}
