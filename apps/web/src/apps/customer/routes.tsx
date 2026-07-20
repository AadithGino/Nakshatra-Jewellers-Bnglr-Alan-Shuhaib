import type { RouteObject } from 'react-router-dom';
import { MobileLayout } from '../../shared/components/MobileLayout';
import { RequireRole } from '../../shared/components/RequireRole';
import { CustomerHomePage } from './pages/CustomerHomePage';
import { CustomerPaymentsPage } from './pages/CustomerPaymentsPage';
import { CustomerPaymentReturnPage } from './pages/CustomerPaymentReturnPage';
import { CustomerPayPage } from './pages/CustomerPayPage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { CustomerSchemesPage } from './pages/CustomerSchemesPage';
import { CustomerSchemeDetailPage } from './pages/CustomerSchemeDetailPage';
import { CustomerRateHistoryPage } from './pages/CustomerRateHistoryPage';

export const customerRoutes: RouteObject[] = [
  {
    path: '/customer',
    element: (
      <RequireRole role="CUSTOMER">
        <MobileLayout role="customer" />
      </RequireRole>
    ),
    children: [
      { index: true, element: <CustomerHomePage /> },
      { path: 'schemes', element: <CustomerSchemesPage /> },
      { path: 'schemes/:id/pay', element: <CustomerPayPage /> },
      { path: 'schemes/:id', element: <CustomerSchemeDetailPage /> },
      { path: 'rates', element: <CustomerRateHistoryPage /> },
      { path: 'payments', element: <CustomerPaymentsPage /> },
      { path: 'payments/return', element: <CustomerPaymentReturnPage /> },
      { path: 'profile', element: <CustomerProfilePage /> },
    ],
  },
];
