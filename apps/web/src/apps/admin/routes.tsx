import type { RouteObject } from 'react-router-dom';
import { RequireRole } from '../../shared/components/RequireRole';
import { AdminLayout } from './components/AdminLayout';
import { AdminDashboard } from './pages/Dashboard';
import { CustomerManagementPage } from './pages/CustomerManagementPage';
import { OperationsPage } from './pages/OperationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SchemePlanDetailPage } from './pages/SchemePlanDetailPage';
import { SchemePlansPage } from './pages/SchemePlansPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { AdminCustomerDetailPage } from './pages/AdminCustomerDetailPage';
import { AdminStaffDetailPage } from './pages/AdminStaffDetailPage';
import { EnrollmentDetailPage } from './pages/EnrollmentDetailPage';
import { EnrollmentsPage } from './pages/EnrollmentsPage';
import { GoldRateDetailPage } from './pages/GoldRateDetailPage';
import { GoldRatesPage } from './pages/GoldRatesPage';
import { OperationDetailPage } from './pages/OperationDetailPage';
import { PaymentDetailPage } from './pages/PaymentDetailPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PhonePeTransactionDetailPage } from './pages/PhonePeTransactionDetailPage';
import { PhonePeTransactionsPage } from './pages/PhonePeTransactionsPage';
import { AuditLogDetailPage } from './pages/AuditLogDetailPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { PayoutDetailPage } from './pages/PayoutDetailPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { CashSubmissionDetailPage } from './pages/CashSubmissionDetailPage';
import { CashSubmissionsPage } from './pages/CashSubmissionsPage';

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
      { path: 'phonepe-transactions', element: <PhonePeTransactionsPage /> },
      { path: 'phonepe-transactions/:id', element: <PhonePeTransactionDetailPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'payments/:id', element: <PaymentDetailPage /> },
      { path: 'gold-rates', element: <GoldRatesPage /> },
      { path: 'gold-rates/:id', element: <GoldRateDetailPage /> },
      { path: 'scheme-plans', element: <SchemePlansPage /> },
      { path: 'scheme-plans/:id', element: <SchemePlanDetailPage /> },
      { path: 'enrollments', element: <EnrollmentsPage /> },
      { path: 'enrollments/:id', element: <EnrollmentDetailPage /> },
      { path: 'cash-submissions', element: <CashSubmissionsPage /> },
      { path: 'cash-submissions/:id', element: <CashSubmissionDetailPage /> },
      { path: 'corrections', element: <OperationsPage module="corrections" /> },
      { path: 'corrections/:id', element: <OperationDetailPage module="corrections" /> },
      { path: 'payouts', element: <PayoutsPage /> },
      { path: 'payouts/:id', element: <PayoutDetailPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'audit-logs/:id', element: <AuditLogDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'maturity', element: <ReportsPage initial="maturity" /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
];
