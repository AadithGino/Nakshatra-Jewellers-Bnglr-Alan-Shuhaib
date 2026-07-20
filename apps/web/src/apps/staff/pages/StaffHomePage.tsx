import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CirclePlus, ReceiptIndianRupee, ScrollText, UserPlus, Users } from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Card, GoldRateBanner, Page, QueryState, Status } from '../../../shared/components/ui';

function greetingForNow(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(now),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function StaffHomePage() {
  const query = useQuery({
    queryKey: ['staff-dashboard'],
    queryFn: () => api<any>('/staff/dashboard'),
  });
  const dashboard = query.data;
  const greeting = useMemo(() => greetingForNow(), []);

  return (
    <Page title={greeting} subtitle="Collect payments and help customers move forward.">
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        <div className="staff-dashboard">
          <GoldRateBanner
            ratePaise={dashboard?.currentGoldRate?.ratePerGramPaise}
            updatedAt={dashboard?.currentGoldRate?.effectiveFrom}
          />

          <div className="staff-action-grid">
            <Link to="/staff/collect">
              <span>
                <ReceiptIndianRupee />
              </span>
              <b>Collect</b>
              <small>Payment</small>
            </Link>
            <Link to="/staff/customers?action=create">
              <span>
                <UserPlus />
              </span>
              <b>Add</b>
              <small>Customer</small>
            </Link>
            <Link to="/staff/customers?action=enroll">
              <span>
                <CirclePlus />
              </span>
              <b>Enroll</b>
              <small>Scheme</small>
            </Link>
          </div>

          <section className="staff-summary">
            <div>
              <span>
                <ReceiptIndianRupee />
              </span>
              <small>Today</small>
              <b>{money(dashboard?.todayCollectionPaise ?? 0)}</b>
            </div>
            <div>
              <span>
                <ScrollText />
              </span>
              <small>Payments</small>
              <b>{dashboard?.todayPaymentCount ?? 0}</b>
            </div>
            <div>
              <span>
                <Users />
              </span>
              <small>Customers</small>
              <b>{dashboard?.customersServedToday ?? 0}</b>
            </div>
          </section>

          <Card title="Recent payments" className="staff-recent-payments">
            {dashboard?.recentPayments?.length ? (
              dashboard.recentPayments.map((payment: any) => (
                <div className="staff-payment-row" key={payment._id}>
                  <span className="customer-initials">
                    {(payment.customerId?.userId?.name ?? 'C')
                      .split(' ')
                      .map((word: string) => word[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div className="payment-person">
                    <b>{payment.customerId?.userId?.name ?? 'Customer'}</b>
                    <small>
                      {date(payment.paymentDate)} · {payment.method}
                    </small>
                    <span
                      className={`scheme-chip ${payment.schemeId?.schemeType === 'GOLD_WEIGHT' ? 'weight' : 'cash'}`}
                    >
                      {payment.schemeId?.schemeType === 'GOLD_WEIGHT' ? 'Gold weight' : 'Cash scheme'}
                    </span>
                  </div>
                  <div className="payment-side">
                    <div className="payment-value">
                      <strong>{money(payment.amountPaise)}</strong>
                      {payment.goldWeightMg ? (
                        <small>{(payment.goldWeightMg / 1000).toFixed(3)} g</small>
                      ) : (
                        <Status value={payment.status} />
                      )}
                    </div>
                    <Link className="receipt-button" to={`/staff/payments?receipt=${payment._id}`}>
                      Receipt
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="helper">Payments you collect today will show up here.</p>
            )}
            <Link className="card-link" to="/staff/payments">
              View all payments
            </Link>
          </Card>
        </div>
      </QueryState>
    </Page>
  );
}
