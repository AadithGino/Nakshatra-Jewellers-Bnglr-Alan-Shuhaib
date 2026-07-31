import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gem,
  IndianRupee,
  Layers3,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { useAuth } from '../../../shared/hooks/useAuth';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { Page, QueryState, Status } from '../../../shared/components/ui';

const typeLabel = (type?: string) =>
  type === 'GOLD_WEIGHT' ? 'Gold weight' : type === 'CASH' ? 'Cash' : '—';

const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
};

const customerName = (record: any) =>
  record?.customerId?.userId?.name ?? record?.customerId?.customerCode ?? '—';
const customerPhone = (record: any) => record?.customerId?.userId?.phone ?? '—';
const customerCode = (record: any) => record?.customerId?.customerCode ?? '—';
const planName = (record: any) => record?.schemePlanId?.name ?? '—';

const enrollmentProgress = (
  start?: string | Date,
  maturity?: string | Date,
  nowMs = Date.now(),
) => {
  if (!start || !maturity) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(maturity).getTime();
  if (endMs <= startMs) return 0;
  return Math.min(100, Math.max(0, ((nowMs - startMs) / (endMs - startMs)) * 100));
};

export function StaffEnrollmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canCollect = session?.permissions.includes('canCollectPayment');

  const detail = useQuery({
    queryKey: ['staff-enrollment', id],
    queryFn: () => api<any>(`/staff/enrollments/${id}`),
    enabled: Boolean(id),
  });

  const record = detail.data?.enrollment;
  const customerId = resolveId(record?.customerId);
  const nowMs = Date.now();
  const progress = enrollmentProgress(record?.startDate, record?.maturityDate, nowMs);
  const isActive = record?.status === 'ACTIVE';

  const journey = !record
    ? []
    : [
        {
          title: 'Started',
          detail: date(record.startDate),
          state: 'done' as const,
        },
        {
          title: 'Flexible period',
          detail: date(record.flexiblePeriodEndDate),
          state:
            new Date(record.flexiblePeriodEndDate).getTime() <= nowMs
              ? ('done' as const)
              : ('active' as const),
        },
        {
          title: 'Maturity',
          detail: date(record.maturityDate),
          state:
            record.status === 'MATURED' || record.status === 'REDEEMED'
              ? ('done' as const)
              : new Date(record.maturityDate).getTime() <= nowMs
                ? ('active' as const)
                : ('pending' as const),
        },
        {
          title: 'Settlement',
          detail:
            record.status === 'REDEEMED' || record.status === 'CLOSED' || record.status === 'WITHDRAWN'
              ? `Status · ${record.status}`
              : 'Pending settlement',
          state:
            record.status === 'REDEEMED' || record.status === 'CLOSED' || record.status === 'WITHDRAWN'
              ? ('done' as const)
              : ('pending' as const),
        },
      ];

  const statusHistory = (record?.statusHistory ?? [])
    .slice()
    .reverse()
    .map((entry: any) => ({
      title: entry.status,
      detail: `${date(entry.at)}${entry.reason ? ` · ${entry.reason}` : ''}`,
      state: 'done' as const,
    }));

  return (
    <Page
      title={record?.enrollmentNumber ?? 'Enrollment'}
      subtitle={record ? `${planName(record)} · ${typeLabel(record.schemeType)}` : 'Scheme enrollment'}
      actions={
        <Link
          className="scheme-back-link"
          to={customerId ? `/staff/customers/${customerId}` : '/staff/customers'}
        >
          <ArrowLeft />
          <span>Back</span>
        </Link>
      }
    >
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        retry={() => void detail.refetch()}
      >
        {record && (
          <div className="staff-enrollment-stack">
            <section className="staff-enrollment-hero">
              <div className="staff-enrollment-hero-top">
                <span className="staff-enrollment-eyebrow">
                  <Layers3 />
                  {planName(record)}
                </span>
                <div className="staff-enrollment-badges">
                  <Status value={record.status} />
                  <span className={`scheme-type-pill ${String(record.schemeType ?? '').toLowerCase()}`}>
                    {typeLabel(record.schemeType)}
                  </span>
                </div>
              </div>

              <h2>{record.enrollmentNumber}</h2>
              <p>
                {customerName(record)} · Matures {date(record.maturityDate)}
              </p>

              <div className="staff-enrollment-stats">
                <article>
                  <small>Collected</small>
                  <strong>{money(record.totalPaidPaise)}</strong>
                </article>
                <article>
                  <small>Gold</small>
                  <strong>{goldGrams(record.totalGoldWeightMg) ?? '0 g'}</strong>
                </article>
                <article>
                  <small>Settled</small>
                  <strong>{money(record.totalPayoutPaise)}</strong>
                </article>
                <article>
                  <small>Progress</small>
                  <strong>{Math.round(progress)}%</strong>
                </article>
              </div>

              <div className="scheme-progress-panel staff-enrollment-progress">
                <span className="scheme-progress-track large">
                  <span className="scheme-progress-bar" style={{ width: `${progress}%` }} />
                </span>
                <div className="scheme-progress-panel-meta">
                  <span>Started {date(record.startDate)}</span>
                  <span>Matures {date(record.maturityDate)}</span>
                </div>
              </div>

              {canCollect && isActive && customerId ? (
                <button
                  type="button"
                  className="primary staff-enrollment-collect"
                  onClick={() => navigate(`/staff/collect?customer=${customerId}`)}
                >
                  <WalletCards /> Collect payment
                </button>
              ) : null}
            </section>

            <div className="staff-enrollment-facts">
              <article>
                <UserRound />
                <div>
                  <small>Customer</small>
                  <b>{customerName(record)}</b>
                  <em>
                    {customerCode(record)} · {customerPhone(record)}
                  </em>
                </div>
              </article>
              <article>
                {record.schemeType === 'GOLD_WEIGHT' ? <Gem /> : <IndianRupee />}
                <div>
                  <small>Scheme plan</small>
                  <b>{planName(record)}</b>
                  <em>
                    Min {money(record.schemePlanId?.minimumPaymentPaise)} · {record.durationMonths}{' '}
                    months
                  </em>
                </div>
              </article>
              <article>
                <CalendarDays />
                <div>
                  <small>Schedule</small>
                  <b>
                    {date(record.startDate)} → {date(record.maturityDate)}
                  </b>
                  <em>Flexible until {date(record.flexiblePeriodEndDate)}</em>
                </div>
              </article>
            </div>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Scheme journey</h2>
              </div>
              <div className="phonepe-timeline">
                {journey.map((step) => (
                  <article className={`phonepe-timeline-step ${step.state}`} key={step.title}>
                    <span>{step.state === 'done' ? <CheckCircle2 /> : <Clock3 />}</span>
                    <div>
                      <b>{step.title}</b>
                      <small>{step.detail}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {statusHistory.length ? (
              <section className="phonepe-panel">
                <div className="phonepe-panel-head">
                  <h2>Status history</h2>
                </div>
                <div className="phonepe-timeline">
                  {statusHistory.map((step: { title: string; detail: string; state: string }) => (
                    <article
                      className={`phonepe-timeline-step ${step.state}`}
                      key={`${step.title}-${step.detail}`}
                    >
                      <span>
                        <CheckCircle2 />
                      </span>
                      <div>
                        <b>{step.title}</b>
                        <small>{step.detail}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </QueryState>
    </Page>
  );
}
