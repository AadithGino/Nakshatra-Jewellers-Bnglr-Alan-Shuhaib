import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Gem,
  IndianRupee,
  ReceiptText,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Page, QueryState, Status } from '../../../shared/components/ui';

const monthName = (month: number) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(2026, month - 1, 1));

const customerName = (payment: any) =>
  payment.customerId?.userId?.name ?? payment.receiptNumber ?? '—';

const schemeTypeLabel = (type?: string) =>
  type === 'GOLD_WEIGHT' ? 'Gold weight' : type === 'CASH' ? 'Cash' : (type ?? '—');

export function AdminDashboard() {
  const navigate = useNavigate();
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
  const ratePaise = d?.currentGoldRate?.ratePerGramPaise;
  const rateUpdatedAt = d?.currentGoldRate?.effectiveFrom;
  const liabilityGrams = ((d?.goldLiabilityMg ?? 0) / 1000).toFixed(3);

  return (
    <Page
      title="Dashboard"
      subtitle="A live view of collections, schemes and upcoming completions."
    >
      <QueryState loading={q.isLoading} error={q.error} retry={() => void q.refetch()}>
        <div className="admin-dashboard-page">
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

          <section className="admin-gold-rate-strip dashboard-gold-strip">
            <div className="admin-gold-rate-strip-main">
              <span className="admin-gold-rate-strip-icon">
                <Gem />
              </span>
              <div className="admin-gold-rate-strip-copy">
                <small>Current 916 rate</small>
                <strong>{ratePaise ? `${money(ratePaise)}/g` : 'Not set'}</strong>
              </div>
              <span className="admin-gold-rate-strip-shift up">
                <ArrowUpRight /> Live
              </span>
              {rateUpdatedAt && (
                <span className="admin-gold-rate-strip-meta">
                  Effective {date(rateUpdatedAt)}
                </span>
              )}
              <span className="dashboard-liability-chip">
                <Gem />
                Liability {liabilityGrams} g
              </span>
            </div>
            <Link className="admin-gold-rate-publish" to="/admin/gold-rates">
              View rates
              <ChevronRight />
            </Link>
          </section>

          <div className="admin-dashboard-grid">
            <section className="reports-table-card dashboard-chart-card">
              <div className="reports-table-head">
                <h2>Monthly collections</h2>
                <div className="dashboard-chart-legend">
                  <span>
                    <i className="cash" /> Cash
                  </span>
                  <span>
                    <i className="weight" /> Weight
                  </span>
                </div>
              </div>
              <div className="dashboard-column-chart">
                {monthly.length ? (
                  monthly.map((item) => (
                    <div className="dashboard-column-group" key={item.label}>
                      <div className="dashboard-columns">
                        <i
                          className="cash"
                          style={{
                            height: `${Math.max(8, ((item.CASH ?? 0) / chartMax) * 100)}%`,
                          }}
                          title={money(item.CASH)}
                        />
                        <i
                          className="weight"
                          style={{
                            height: `${Math.max(8, ((item.GOLD_WEIGHT ?? 0) / chartMax) * 100)}%`,
                          }}
                          title={money(item.GOLD_WEIGHT)}
                        />
                      </div>
                      <small>{item.label}</small>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-chart-empty">
                    Collection trends will appear after payments are recorded.
                  </div>
                )}
              </div>
            </section>

            <section className="reports-table-card dashboard-maturity-card">
              <div className="reports-table-head">
                <h2>Nearing completion</h2>
                <Link className="dashboard-panel-link" to="/admin/maturity">
                  Timeline <ChevronRight />
                </Link>
              </div>
              <div className="dashboard-maturity-list">
                {d?.upcomingMaturities?.length ? (
                  d.upcomingMaturities.map((scheme: any) => (
                    <button
                      type="button"
                      className="dashboard-maturity-row"
                      key={scheme._id}
                      onClick={() => navigate(`/admin/enrollments/${scheme._id}`)}
                    >
                      <span className="dashboard-maturity-icon">
                        <CalendarClock />
                      </span>
                      <span className="dashboard-maturity-copy">
                        <b>{scheme.customerId?.userId?.name ?? scheme.enrollmentNumber}</b>
                        <small>
                          {scheme.schemePlanId?.name ??
                            schemeTypeLabel(scheme.schemeType)?.replace('_', ' ')}
                        </small>
                      </span>
                      <span className="dashboard-maturity-date">
                        <strong>{date(scheme.maturityDate)}</strong>
                        <small>Matures</small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))
                ) : (
                  <p className="helper">No schemes complete in the next 30 days.</p>
                )}
              </div>
            </section>

            <section className="reports-table-card dashboard-recent-card">
              <div className="reports-table-head">
                <h2>Recent collections</h2>
                <Link className="dashboard-panel-link" to="/admin/payments">
                  All payments <ChevronRight />
                </Link>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Scheme</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Weight</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d?.recentPayments?.length ? (
                      d.recentPayments.map((payment: any) => (
                        <tr
                          key={payment._id}
                          className="reports-clickable-row"
                          onClick={() => navigate(`/admin/payments/${payment._id}`)}
                        >
                          <td>
                            <span className="scheme-admin-name-cell">
                              <b className="reports-inline-link">{customerName(payment)}</b>
                              <small>{payment.receiptNumber ?? '—'}</small>
                            </span>
                          </td>
                          <td>{schemeTypeLabel(payment.schemeId?.schemeType)}</td>
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <p className="helper">No recent collections yet.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-table-card dashboard-actions-card">
              <div className="reports-table-head">
                <h2>Quick actions</h2>
              </div>
              <div className="dashboard-actions-grid">
                <Link to="/admin/customers?action=create">
                  <Users />
                  <span>Add customer</span>
                </Link>
                <Link to="/admin/enrollments?action=create">
                  <CircleDollarSign />
                  <span>Enroll customer</span>
                </Link>
                <Link to="/admin/payments">
                  <ReceiptText />
                  <span>View payments</span>
                </Link>
                <Link to="/admin/maturity">
                  <CalendarClock />
                  <span>Scheme timeline</span>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </QueryState>
    </Page>
  );
}
