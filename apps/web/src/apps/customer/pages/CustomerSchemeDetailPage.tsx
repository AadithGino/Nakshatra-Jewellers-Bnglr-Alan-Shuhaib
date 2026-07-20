import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  IndianRupee,
  Landmark,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { BrandLogo } from '../../../shared/components/BrandLogo';
import { Card, Page, QueryState, Status } from '../../../shared/components/ui';

export function CustomerSchemeDetailPage() {
  const { id = '' } = useParams();
  const details = useQuery({
    queryKey: ['customer-scheme-detail', id],
    queryFn: () => api<any>(`/customer/schemes/${id}`),
    enabled: Boolean(id),
  });
  const scheme = details.data?.scheme;
  const status = details.data?.schemeStatus;
  const isGold = scheme?.schemeType === 'GOLD_WEIGHT';
  const isActive = scheme?.status === 'ACTIVE';

  return (
    <Page
      title="Scheme details"
      subtitle="Terms, progress and every transaction in one place."
      actions={
        <Link className="scheme-back-link" to="/customer/schemes" aria-label="Back to My scheme">
          <ArrowLeft />
          <span>Back</span>
        </Link>
      }
    >
      <QueryState
        loading={details.isLoading}
        error={details.error}
        empty={!details.isLoading && !scheme}
        retry={() => void details.refetch()}
      >
        {scheme && (
          <div className="scheme-detail-stack">
            <section className="scheme-detail-hero">
              <div className="scheme-detail-hero-top">
                <BrandLogo variant="white" size={44} className="scheme-detail-logo" />
                <div className="scheme-detail-hero-copy">
                  <small>{scheme.schemePlanId?.name ?? 'Savings scheme'}</small>
                  <h2>{scheme.enrollmentNumber}</h2>
                  <p>{isGold ? '916 Gold Weight Scheme' : 'Cash Savings Scheme'}</p>
                </div>
                <Status value={scheme.status} />
              </div>
              <div className={`scheme-detail-amounts ${isGold ? 'cols-3' : 'cols-2'}`}>
                <div>
                  <small>Total paid</small>
                  <strong>{money(scheme.totalPaidPaise ?? 0)}</strong>
                </div>
                {isGold && (
                  <div>
                    <small>916 gold</small>
                    <strong>{((scheme.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g</strong>
                  </div>
                )}
                <div>
                  <small>Duration</small>
                  <strong>{scheme.durationMonths} mo</strong>
                </div>
              </div>
              {isActive && (
                <Link className="primary wide-action" to={`/customer/schemes/${scheme._id}/pay`}>
                  <WalletCards /> Pay
                </Link>
              )}
            </section>

            <div className="detail-highlight-grid scheme-facts-grid">
              <article>
                <CalendarDays />
                <span>
                  <small>Started</small>
                  <b>{date(scheme.startDate)}</b>
                </span>
              </article>
              <article>
                <ShieldCheck />
                <span>
                  <small>Completes</small>
                  <b>{date(scheme.maturityDate)}</b>
                </span>
              </article>
              <article>
                <Landmark />
                <span>
                  <small>Scheme month</small>
                  <b>
                    {status?.schemeMonth ?? '—'} / {scheme.durationMonths}
                  </b>
                </span>
              </article>
              <article>
                <FileText />
                <span>
                  <small>Phase</small>
                  <b>{status?.phaseLabel ?? '—'}</b>
                </span>
              </article>
            </div>

            <Card className="customer-phase-card">
              <header>
                <div>
                  <small>Scheme phase</small>
                  <h3>{status?.phaseLabel ?? 'Flexible phase'}</h3>
                </div>
                <span
                  className={`phase-badge ${status?.phase === 'CAPPED' ? 'capped' : 'flexible'}`}
                >
                  {status?.phase === 'CAPPED' ? 'Capped' : 'Flexible'}
                </span>
              </header>
              <div className={`scheme-phase-facts ${isGold ? 'with-rate' : ''}`}>
                <div>
                  <small>Flexible</small>
                  <b>{status?.flexibleMonthCount ?? scheme.flexibleMonths} mo</b>
                </div>
                {(status?.cappedMonthCount ?? 0) > 0 && (
                  <div>
                    <small>Capped</small>
                    <b>{status?.cappedMonthCount} mo</b>
                  </div>
                )}
                {isGold && (
                  <div className="phase-rate-fact">
                    <small>916 rate</small>
                    <b>
                      {details.data?.currentGoldRate?.ratePerGramPaise
                        ? `${money(details.data.currentGoldRate.ratePerGramPaise)}/g`
                        : 'Not set'}
                    </b>
                  </div>
                )}
              </div>
              {status?.phase === 'CAPPED' && !status.flexibleThroughout && (
                <div className="cap-usage-panel">
                  <div className="cap-usage-row">
                    <span>Monthly cap</span>
                    <b>{money(status.monthlyCapPaise ?? 0)}</b>
                  </div>
                  <div className="cap-usage-row">
                    <span>Paid this month</span>
                    <b>{money(status.paidInCurrentMonthPaise ?? 0)}</b>
                  </div>
                  <div className="cap-usage-row available">
                    <span>Available</span>
                    <b>{money(status.remainingCapPaise ?? 0)}</b>
                  </div>
                </div>
              )}
              {status?.flexibleThroughout && (
                <p className="helper">Flexible throughout the scheme. No monthly cap applies.</p>
              )}
            </Card>

            <Card className="terms-card">
              <div className="section-title-row">
                <span className="section-icon">
                  <FileText />
                </span>
                <div>
                  <h2>Plan terms and benefits</h2>
                  <p>The terms attached to your enrollment.</p>
                </div>
              </div>
              <div className="terms-grid">
                <div>
                  <small>Terms</small>
                  <p>{scheme.schemePlanId?.termsText || 'No additional terms recorded.'}</p>
                </div>
                <div>
                  <small>Benefit</small>
                  <p>{scheme.schemePlanId?.benefitText || 'Standard scheme benefits apply.'}</p>
                </div>
                {scheme.schemePlanId?.makingChargeBenefit && (
                  <div>
                    <small>Making charge benefit</small>
                    <p>{scheme.schemePlanId.makingChargeBenefit}</p>
                  </div>
                )}
                {scheme.schemePlanId?.wastageBenefit && (
                  <div>
                    <small>Wastage benefit</small>
                    <p>{scheme.schemePlanId.wastageBenefit}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="timeline-card">
              <div className="section-heading">
                <div>
                  <span>Transaction timeline</span>
                  <h2>Scheme payments</h2>
                </div>
                <small>{details.data.payments?.length ?? 0} payments</small>
              </div>
              {details.data.payments?.length ? (
                details.data.payments.map((item: any) => (
                  <div className="transaction-card" key={item._id}>
                    <span className="transaction-icon">
                      <IndianRupee />
                    </span>
                    <div>
                      <b>{item.receiptNumber ?? 'Payment'}</b>
                      <small>
                        {date(item.paymentDate)} · {item.method}
                      </small>
                      {item.goldRatePerGramPaise && (
                        <em>916 rate {money(item.goldRatePerGramPaise)}/g</em>
                      )}
                    </div>
                    <div>
                      <strong>{money(item.amountPaise ?? 0)}</strong>
                      {item.goldWeightMg ? (
                        <small>{(item.goldWeightMg / 1000).toFixed(3)} g credited</small>
                      ) : (
                        <Status value={item.status} />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="helper">No payments have been recorded for this scheme.</p>
              )}
            </Card>

            {details.data.payouts?.length > 0 && (
              <Card title="Redemption / payout history">
                {details.data.payouts.map((item: any) => (
                  <div className="transaction-card" key={item._id}>
                    <span className="transaction-icon">
                      <Landmark />
                    </span>
                    <div>
                      <b>{item.payoutType === 'REDEEM' ? 'Gold redeemed' : 'Amount paid out'}</b>
                      <small>
                        {date(item.payoutDate)} · {item.method}
                      </small>
                    </div>
                    <div>
                      <strong>
                        {item.payoutType === 'REDEEM' && item.goldWeightMg
                          ? `${(item.goldWeightMg / 1000).toFixed(3)} g`
                          : money(item.amountPaise ?? 0)}
                      </strong>
                      <Status value={item.status} />
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </QueryState>
    </Page>
  );
}
