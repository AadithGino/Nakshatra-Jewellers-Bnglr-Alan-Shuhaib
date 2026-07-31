import type { RouteObject } from 'react-router-dom';
import { MobileLayout } from '../../shared/components/MobileLayout';
import { RequireRole } from '../../shared/components/RequireRole';
import { StaffCustomersPage } from './pages/StaffCustomersPage';
import { StaffCollectPaymentPage } from './pages/StaffCollectPaymentPage';
import { StaffHomePage } from './pages/StaffHomePage';
import { StaffPaymentsPage } from './pages/StaffPaymentsPage';
import { StaffProfilePage } from './pages/StaffProfilePage';
import { StaffCustomerDetailPage } from './pages/StaffCustomerDetailPage';
import { StaffEnrollmentDetailPage } from './pages/StaffEnrollmentDetailPage';

export const staffRoutes: RouteObject[] = [
  {
    path: '/staff',
    element: (
      <RequireRole role="STAFF">
        <MobileLayout role="staff" />
      </RequireRole>
    ),
    children: [
      { index: true, element: <StaffHomePage /> },
      { path: 'customers', element: <StaffCustomersPage /> },
      { path: 'customers/:id', element: <StaffCustomerDetailPage /> },
      { path: 'enrollments/:id', element: <StaffEnrollmentDetailPage /> },
      { path: 'collect', element: <StaffCollectPaymentPage /> },
      { path: 'payments', element: <StaffPaymentsPage /> },
      { path: 'profile', element: <StaffProfilePage /> },
    ],
  },
];
