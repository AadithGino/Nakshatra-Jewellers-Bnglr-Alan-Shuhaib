import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Gem,
  IndianRupee,
  ReceiptText,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Page, QueryState, Status, Card, GoldRateBanner } from '../../../shared/components/ui';

const monthName = (month: number) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(2026, month - 1, 1));

export function AdminDashboard() {
  const q = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<any>('/admin/dashboard'),
  });
  const d = q.data;
  const monthly = Object.values(
    (d?.monthlyCollections ?? []).reduce((result: Record<string, any>, item: any) => {
      const key = `${item._id.year}-${item._id.month}`;
      result[key] ??= {
        label: `${monthName(item._id.month)} '${String(item._id.year).slice(-2)}`,
        CASH: 0,
        GOLD_WEIGHT: 0,
      };
      result[key][item._id.schemeType] = item.totalPaise;
      return result;
    }, {}),
  ) as any[];
  const chartMax = Math.max(
    1,
    ...monthly.flatMap((item) => [item.CASH ?? 0, item.GOLD_WEIGHT ?? 0]),
  );
  const activeTotal = (d?.activeCashSchemes ?? 0) + (d?.activeGoldWeightSchemes ?? 0);
  return (
    <Page
      title="Dashboard"
      subtitle="A live view of collections, schemes and upcoming completions."
    >
      <QueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}>
        <div className="admin-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <Users />
            </span>
            <div>
              <small>Active customers</small>
              <strong>{activeTotal.toLocaleString('en-IN')}</strong>
              <em>One active scheme each</em>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <IndianRupee />
            </span>
            <div>
              <small>Active cash schemes</small>
              <strong>{(d?.activeCashSchemes ?? 0).toLocaleString('en-IN')}</strong>
              <em>Flexible contributions</em>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Gem />
            </span>
            <div>
              <small>Active weight schemes</small>
              <strong>{(d?.activeGoldWeightSchemes ?? 0).toLocaleString('en-IN')}</strong>
              <em>916 rate linked</em>
            </div>
          </article>
          <article className="dashboard-kpi success">
            <span>
              <ReceiptText />
            </span>
            <div>
              <small>Today's collection</small>
              <strong>{money(d?.todayCollectionPaise)}</strong>
              <em>{d?.todayPaymentCount ?? 0} payments</em>
            </div>
          </article>
        </div>
        <div className="dashboard-rate-row">
          <GoldRateBanner
            ratePaise={d?.currentGoldRate?.ratePerGramPaise}
            updatedAt={d?.currentGoldRate?.effectiveFrom}
          />
          <div className="liability-card">
            <Gem />
            <div>
              <small>Gold liability</small>
              <strong>{((d?.goldLiabilityMg ?? 0) / 1000).toFixed(3)} g</strong>
              <span>Across active and completed weight schemes</span>
            </div>
          </div>
        </div>
        <div className="admin-dashboard-grid">
          <Card title="Monthly collections" className="collection-chart-card">
            <div className="chart-legend">
              <span>
                <i className="cash" /> Cash scheme
              </span>
              <span>
                <i className="weight" /> Weight scheme
              </span>
            </div>
            <div className="column-chart">
              {monthly.length ? (
                monthly.map((item) => (
                  <div className="column-group" key={item.label}>
                    <div className="columns">
                      <i
                        className="cash"
                        style={{ height: `${Math.max(6, ((item.CASH ?? 0) / chartMax) * 100)}%` }}
                        title={money(item.CASH)}
                      />
                      <i
                        className="weight"
                        style={{
                          height: `${Math.max(6, ((item.GOLD_WEIGHT ?? 0) / chartMax) * 100)}%`,
                        }}
                        title={money(item.GOLD_WEIGHT)}
                      />
                    </div>
                    <small>{item.label}</small>
                  </div>
                ))
              ) : (
                <div className="chart-empty">
                  Collection trends will appear after payments are recorded.
                </div>
              )}
            </div>
          </Card>
          <Card title="Schemes nearing completion" className="completion-card">
            {d?.upcomingMaturities?.length ? (
              d.upcomingMaturities.map((scheme: any) => (
                <div className="list-row" key={scheme._id}>
                  <div>
                    <b>{scheme.customerId?.userId?.name ?? scheme.enrollmentNumber}</b>
                    <small>
                      {scheme.schemePlanId?.name ?? scheme.schemeType.replace('_', ' ')}
                    </small>
                  </div>
                  <div>
                    <strong>{date(scheme.maturityDate)}</strong>
                    <small>Time completion</small>
                  </div>
                </div>
              ))
            ) : (
              <p className="helper">No schemes complete in the next 30 days.</p>
            )}
            <Link className="card-link" to="/admin/maturity">
              View scheme timeline <ChevronRight />
            </Link>
          </Card>
          <Card title="Recent flexible collections" className="recent-collections-card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Scheme</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Weight credited</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d?.recentPayments?.map((payment: any) => (
                    <tr key={payment._id}>
                      <td>
                        <b>{payment.customerId?.userId?.name ?? payment.receiptNumber}</b>
                        <small className="table-subtitle">{payment.receiptNumber}</small>
                      </td>
                      <td>
                        {payment.schemeId?.schemeType === 'GOLD_WEIGHT' ? 'Gold weight' : 'Cash'}
                      </td>
                      <td>{date(payment.paymentDate)}</td>
                      <td>{money(payment.amountPaise)}</td>
                      <td>
                        {payment.goldWeightMg
                          ? `${(payment.goldWeightMg / 1000).toFixed(3)} g`
                          : '—'}
                      </td>
                      <td>
                        <Status value={payment.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Quick actions" className="quick-actions-card">
            <Link to="/admin/customers?action=create">
              <Users /> Add customer
            </Link>
            <Link to="/admin/enrollments?action=create">
              <CircleDollarSign /> Enroll customer
            </Link>
            <Link to="/admin/payments">
              <ReceiptText /> View payments
            </Link>
            <Link to="/admin/maturity">
              <CalendarClock /> Scheme timeline
            </Link>
          </Card>
        </div>
      </QueryState>
    </Page>
  );
}
