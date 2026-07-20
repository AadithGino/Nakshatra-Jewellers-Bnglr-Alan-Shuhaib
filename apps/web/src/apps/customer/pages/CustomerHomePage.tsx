import { useQuery } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import {
  CalendarClock,
  ChevronRight,
  FileText,
  Gem,
  History,
  ReceiptIndianRupee,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Card, GoldRateBanner, Page, QueryState } from '../../../shared/components/ui';

export function CustomerHomePage() {
  const [now] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ['customer-home'],
    queryFn: () => api<any>('/customer/home'),
  });
  const home = query.data;
  const scheme = home?.activeScheme;
  const status = home?.schemeStatus;
  const startedAt = scheme ? new Date(scheme.startDate).getTime() : 0;
  const completesAt = scheme ? new Date(scheme.maturityDate).getTime() : 0;
  const timeProgress = status?.timeProgressPercent ??
    (scheme
      ? Math.max(0, Math.min(100, ((now - startedAt) / Math.max(1, completesAt - startedAt)) * 100))
      : 0);
  const remainingDays = scheme ? Math.max(0, Math.ceil((completesAt - now) / 86_400_000)) : 0;
  const isWeightScheme = scheme?.schemeType === 'GOLD_WEIGHT';
  const payPath = scheme ? `/customer/schemes/${scheme._id}/pay` : '/customer';

  return (
    <Page
      title={`Hello${home?.customer?.userId?.name ? ` ${home.customer.userId.name.split(' ')[0]}` : ''}`}
      subtitle="Your savings journey, clearly accounted for."
    >
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {scheme ? (
          <div className="customer-home-stack">
            {isWeightScheme && (
              <GoldRateBanner
                ratePaise={home.currentGoldRate?.ratePerGramPaise}
                updatedAt={home.currentGoldRate?.effectiveFrom}
              />
            )}
            <section className="customer-scheme-card">
              <header>
                <div>
                  <small>Active scheme</small>
                  <h2>{isWeightScheme ? 'Gold Weight Scheme' : 'Cash Scheme'}</h2>
                  <span>{scheme.enrollmentNumber}</span>
                </div>
                <span className="active-pill">
                  <ShieldCheck /> Active
                </span>
              </header>

              <div className="customer-scheme-status">
                <div>
                  <small>Scheme month</small>
                  <b>
                    {status?.schemeMonth ?? '—'} of {scheme.durationMonths}
                  </b>
                </div>
                <div>
                  <small>Current phase</small>
                  <b>{status?.phaseLabel ?? 'Flexible phase'}</b>
                </div>
                <div>
                  <small>Time progress</small>
                  <b>{Math.floor(timeProgress)}%</b>
                </div>
              </div>

              <div className="time-progress-layout">
                <div className="scheme-time-facts">
                  <span>
                    <small>Started on</small>
                    <b>{date(scheme.startDate)}</b>
                  </span>
                  <span>
                    <small>Time elapsed</small>
                    <b>{Math.floor(timeProgress)}% of duration</b>
                  </span>
                  <span>
                    <small>Time remaining</small>
                    <b>{remainingDays} days</b>
                  </span>
                  <span>
                    <small>Total duration</small>
                    <b>{scheme.durationMonths} months</b>
                  </span>
                </div>
                <div
                  className="time-ring"
                  style={{ '--progress': `${timeProgress * 3.6}deg` } as CSSProperties}
                >
                  <div>
                    <strong>{Math.floor(timeProgress)}%</strong>
                    <small>time elapsed</small>
                  </div>
                </div>
              </div>

              <div className="scheme-benefits">
                <div>
                  <ReceiptIndianRupee />
                  <span>
                    <small>Total contributions</small>
                    <strong>{money(scheme.totalPaidPaise ?? 0)}</strong>
                    <em>{status?.phaseLabel ?? 'Flexible payments'}</em>
                  </span>
                </div>
                {isWeightScheme && (
                  <div>
                    <Gem />
                    <span>
                      <small>Gold accumulated (916)</small>
                      <strong>{((scheme.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g</strong>
                      <em>
                        {home.currentGoldRate?.ratePerGramPaise
                          ? `Live rate ${money(home.currentGoldRate.ratePerGramPaise)}/g`
                          : 'Rate-linked weight'}
                      </em>
                    </span>
                  </div>
                )}
              </div>

              {status?.phase === 'CAPPED' && !status.flexibleThroughout && (
                <div className="home-cap-summary">
                  <div>
                    <small>Monthly cap</small>
                    <b>{money(status.monthlyCapPaise ?? 0)}</b>
                  </div>
                  <div>
                    <small>Paid this month</small>
                    <b>{money(status.paidInCurrentMonthPaise ?? 0)}</b>
                  </div>
                  <div>
                    <small>Available</small>
                    <b>{money(status.remainingCapPaise ?? 0)}</b>
                  </div>
                </div>
              )}

              <Link className="primary add-any-amount" to={payPath}>
                <WalletCards /> Pay
              </Link>
              {isWeightScheme && (
                <p className="rate-note">
                  <ShieldCheck /> Gold weight is credited using the 916 rate locked when your payment
                  is confirmed.
                </p>
              )}
            </section>

            <div className="customer-quick-actions">
              <Link to={payPath}>
                <WalletCards />
                <span>Make payment</span>
              </Link>
              <Link to="/customer/payments">
                <FileText />
                <span>Passbook</span>
              </Link>
              <Link to="/customer/rates">
                <History />
                <span>Rate history</span>
              </Link>
              <Link to={`/customer/schemes/${scheme._id}`}>
                <Gem />
                <span>Scheme details</span>
              </Link>
            </div>

            <Card title="Recent payments" className="customer-recent-payments">
              {home.recentPayments?.length ? (
                home.recentPayments.map((payment: any) => (
                  <div className="customer-payment-row" key={payment._id}>
                    <span className="payment-check">
                      <ShieldCheck />
                    </span>
                    <div>
                      <b>{date(payment.paymentDate)}</b>
                      <small>{payment.receiptNumber}</small>
                    </div>
                    <div>
                      <strong>{money(payment.amountPaise ?? 0)}</strong>
                      {payment.goldWeightMg ? (
                        <small>{(payment.goldWeightMg / 1000).toFixed(3)} g credited</small>
                      ) : (
                        <small>{payment.method}</small>
                      )}
                    </div>
                    <Link to={`/customer/payments?receipt=${payment._id}`}>Receipt</Link>
                  </div>
                ))
              ) : (
                <p className="helper">Your completed payments will appear here.</p>
              )}
              <Link className="card-link" to="/customer/payments">
                View passbook <ChevronRight />
              </Link>
            </Card>

            <Link className="completion-banner" to={`/customer/schemes/${scheme._id}`}>
              <CalendarClock />
              <div>
                <small>Scheme completion</small>
                <b>{remainingDays ? `${remainingDays} days remaining` : 'Ready for settlement'}</b>
                <span>Expected completion: {date(scheme.maturityDate)}</span>
              </div>
              <ChevronRight />
            </Link>
          </div>
        ) : (
          <Card>
            <p>No active scheme. Contact Nakshathra Jewellers for enrollment.</p>
          </Card>
        )}
      </QueryState>
    </Page>
  );
}
