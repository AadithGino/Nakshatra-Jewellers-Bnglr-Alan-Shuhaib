import type { RouteObject } from 'react-router-dom';
import { RequireRole } from '../../shared/components/RequireRole';
import { AdminLayout } from './components/AdminLayout';
import { AdminDashboard } from './pages/Dashboard';
import { CustomerManagementPage } from './pages/CustomerManagementPage';
import { OperationsPage } from './pages/OperationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { AdminCustomerDetailPage } from './pages/AdminCustomerDetailPage';
import { AdminStaffDetailPage } from './pages/AdminStaffDetailPage';
import { OperationDetailPage } from './pages/OperationDetailPage';

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: (
      <RequireRole role="ADMIN">
        <AdminLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'staff', element: <StaffManagementPage /> },
      { path: 'staff/:id', element: <AdminStaffDetailPage /> },
      { path: 'customers', element: <CustomerManagementPage /> },
      { path: 'customers/:id', element: <AdminCustomerDetailPage /> },
      ...[
        'scheme-plans',
        'enrollments',
        'gold-rates',
        'payments',
        'phonepe-transactions',
        'cash-submissions',
        'corrections',
        'payouts',
        'audit-logs',
      ].map((module) => ({ path: module, element: <OperationsPage module={module} /> })),
      ...[
        'scheme-plans',
        'enrollments',
        'gold-rates',
        'payments',
        'phonepe-transactions',
        'cash-submissions',
        'corrections',
        'payouts',
        'audit-logs',
      ].map((module) => ({
        path: `${module}/:id`,
        element: <OperationDetailPage module={module} />,
      })),
      { path: 'reports', element: <ReportsPage /> },
      { path: 'maturity', element: <ReportsPage initial="maturity" /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
];
