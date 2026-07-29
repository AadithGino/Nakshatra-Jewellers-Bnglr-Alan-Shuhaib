import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Gem,
  HandCoins,
  IndianRupee,
  Layers3,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';
import { AdminSelect } from '../components/AdminSelect';

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

const monthsBetween = (start?: string | Date, end?: string | Date) => {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  return Math.max(
    0,
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()),
  );
};

const enrollmentProgress = (
  start?: string | Date,
  maturity?: string | Date,
  nowMs = new Date().getTime(),
) => {
  if (!start || !maturity) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(maturity).getTime();
  if (endMs <= startMs) return 0;
  return Math.min(100, Math.max(0, ((nowMs - startMs) / (endMs - startMs)) * 100));
};

const schemeMonthDate = (startDate: string | Date, schemeMonth: number) => {
  const value = new Date(startDate);
  value.setMonth(value.getMonth() + Math.max(0, schemeMonth - 1));
  return value;
};

const schemeMonthShort = (startDate: string | Date, schemeMonth: number) =>
  new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(schemeMonthDate(startDate, schemeMonth));

const schemeMonthLabel = (startDate: string | Date, schemeMonth: number) =>
  new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(schemeMonthDate(startDate, schemeMonth));

function CopyChip({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <button
      type="button"
      className="phonepe-copy-chip"
      title={`Copy ${label}`}
      onClick={() => void navigator.clipboard.writeText(value)}
    >
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
      <Copy />
    </button>
  );
}

export function EnrollmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [settleOpen, setSettleOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<any>(null);
  const [payout, setPayout] = useState({
    payoutType: 'REDEEM' as 'REDEEM' | 'PAYOUT',
    method: 'BANK',
    payoutDate: new Date().toISOString().slice(0, 10),
    referenceNumber: '',
    notes: '',
  });

  const detail = useQuery({
    queryKey: ['admin-enrollment', id],
    queryFn: () => api<any>(`/admin/enrollments/${id}`),
    enabled: Boolean(id),
  });

  const record = detail.data?.enrollment ?? detail.data;
  const payments = detail.data?.payments ?? [];
  const payouts = detail.data?.payouts ?? [];
  const customerIdValue = resolveId(record?.customerId);
  const availablePayoutPaise = Math.max(
    0,
    (record?.totalPaidPaise ?? 0) - (record?.totalPayoutPaise ?? 0),
  );
  const isGoldScheme = record?.schemeType === 'GOLD_WEIGHT';
  const canSettle =
    Boolean(record) &&
    ['ACTIVE', 'MATURED'].includes(record?.status) &&
    availablePayoutPaise > 0;

  const openSettlement = () => {
    if (!record) return;
    setError('');
    setPayout({
      payoutType: isGoldScheme && (record.totalGoldWeightMg ?? 0) > 0 ? 'REDEEM' : 'PAYOUT',
      method: 'BANK',
      payoutDate: new Date().toISOString().slice(0, 10),
      referenceNumber: '',
      notes: '',
    });
    setSettleOpen(true);
  };

  const createPayout = useMutation({
    mutationFn: () =>
      api('/admin/payouts', {
        method: 'POST',
        body: JSON.stringify({
          customerId: customerIdValue,
          schemeId: record._id,
          payoutType: payout.payoutType,
          ...(payout.payoutType === 'PAYOUT' ? { method: payout.method } : {}),
          payoutDate: payout.payoutDate,
          referenceNumber: payout.referenceNumber || undefined,
          notes: payout.notes || undefined,
        }),
      }),
    onSuccess: async () => {
      setSettleOpen(false);
      setMessage(
        payout.payoutType === 'REDEEM'
          ? 'Gold redeemed and the scheme was settled.'
          : 'Amount payout completed and the scheme was settled.',
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-enrollment', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to complete settlement.',
      ),
  });

  const nowMs = new Date().getTime();
  const progress = enrollmentProgress(record?.startDate, record?.maturityDate, nowMs);
  const elapsedMonths = monthsBetween(record?.startDate, new Date(nowMs).toISOString());
  const successfulPayments = payments.filter((row: any) => row.status === 'SUCCESS');

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
            record.status === 'REDEEMED' || record.status === 'WITHDRAWN'
              ? record.status
              : 'Pending',
          state:
            record.status === 'REDEEMED' || record.status === 'WITHDRAWN'
              ? ('done' as const)
              : ('pending' as const),
        },
      ];

  const history = record?.statusHistory ?? [];
  const statusHistory =
    !history.length && record
      ? [{ title: 'ACTIVE', detail: date(record.startDate), state: 'done' as const }]
      : [...history].reverse().map((entry: any, index: number) => ({
          title: entry.status,
          detail: `${date(entry.at)}${entry.reason ? ` · ${entry.reason}` : ''}`,
          state: index === 0 ? ('done' as const) : ('pending' as const),
        }));

  const paidMonths = new Set(
    successfulPayments
      .map((row: any) => row.schemeMonth)
      .filter((month: number | null | undefined) => month != null),
  );
  const monthMarks = !record?.durationMonths
    ? []
    : Array.from({ length: record.durationMonths }, (_, index) => {
        const month = index + 1;
        return {
          month,
          name: schemeMonthShort(record.startDate, month),
          yearLabel: schemeMonthLabel(record.startDate, month),
          paid: paidMonths.has(month),
          current: month === Math.min(record.durationMonths, Math.max(1, elapsedMonths + 1)),
        };
      });

  return (
    <Page
      title="Enrollment"
      actions={
        <button className="secondary" onClick={() => navigate('/admin/enrollments')}>
          <ArrowLeft /> Back
        </button>
      }
    >
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        empty={!detail.isLoading && !record}
        retry={() => void detail.refetch()}
      >
        {record && (
          <div className="enrollment-detail-page">
            <section className="enrollment-hero">
              <div className="enrollment-hero-main">
                <div className="enrollment-hero-top">
                  <span className="enrollment-hero-eyebrow">
                    <Layers3 />
                    {planName(record)}
                  </span>
                  <div className="admin-hero-toolbar">
                    <div className="enrollment-hero-badges">
                      <Status value={record.status} />
                      <span className={`scheme-type-pill ${record.schemeType?.toLowerCase()}`}>
                        {typeLabel(record.schemeType)}
                      </span>
                    </div>
                    {canSettle && (
                      <button
                        type="button"
                        className="primary"
                        onClick={openSettlement}
                      >
                        <HandCoins /> Redeem / payout
                      </button>
                    )}
                  </div>
                </div>
                <div className="enrollment-hero-title-row">
                  <h2>{record.enrollmentNumber}</h2>
                  <p>
                    {customerName(record)} · Matures {date(record.maturityDate)}
                  </p>
                </div>
                <div className="enrollment-hero-stats">
                  <article>
                    <small>Balance left</small>
                    <strong>{money(availablePayoutPaise)}</strong>
                  </article>
                  <article>
                    <small>Gold left</small>
                    <strong>
                      {['ACTIVE', 'MATURED'].includes(record.status)
                        ? goldGrams(record.totalGoldWeightMg) ?? '0 g'
                        : '0 g'}
                    </strong>
                  </article>
                  <article>
                    <small>Collected</small>
                    <strong>{money(record.totalPaidPaise)}</strong>
                  </article>
                  <article>
                    <small>Settled</small>
                    <strong>{money(record.totalPayoutPaise)}</strong>
                  </article>
                </div>
              </div>

              <div className="enrollment-hero-side">
                <div className="enrollment-progress-ring" style={{ ['--progress' as string]: `${progress}%` }}>
                  <div>
                    <strong>{Math.round(progress)}%</strong>
                    <small>complete</small>
                  </div>
                </div>
              </div>
            </section>

            <div className="enrollment-detail-grid">
              <button
                type="button"
                className="enrollment-person-card"
                onClick={() => {
                  const customer = resolveId(record.customerId);
                  if (customer) navigate(`/admin/customers/${customer}`);
                }}
              >
                <span>
                  <UserRound />
                </span>
                <div>
                  <small>Customer</small>
                  <b>{customerName(record)}</b>
                  <em>
                    {customerCode(record)} · {customerPhone(record)}
                  </em>
                </div>
              </button>
              <button
                type="button"
                className="enrollment-person-card"
                onClick={() => {
                  const plan = resolveId(record.schemePlanId);
                  if (plan) navigate(`/admin/scheme-plans/${plan}`);
                }}
              >
                <span>
                  <Gem />
                </span>
                <div>
                  <small>Scheme plan</small>
                  <b>{planName(record)}</b>
                  <em>
                    Min {money(record.schemePlanId?.minimumPaymentPaise)} · {record.durationMonths} months
                  </em>
                </div>
              </button>
              <article className="enrollment-person-card static">
                <span>
                  <CalendarDays />
                </span>
                <div>
                  <small>Schedule</small>
                  <b>
                    {date(record.startDate)} → {date(record.maturityDate)}
                  </b>
                  <em>Flexible until {date(record.flexiblePeriodEndDate)}</em>
                </div>
              </article>
              <article className="enrollment-person-card static">
                <span>
                  <IndianRupee />
                </span>
                <div>
                  <small>Payouts so far</small>
                  <b>{money(record.totalPayoutPaise)}</b>
                  <em>
                    {payouts.length} payout record{payouts.length === 1 ? '' : 's'}
                  </em>
                </div>
              </article>
            </div>

            <section className="reports-table-card enrollment-month-card">
              <div className="reports-table-head">
                <h2>Contribution months</h2>
                <small>
                  {successfulPayments.length} successful payment
                  {successfulPayments.length === 1 ? '' : 's'}
                </small>
              </div>
              <div className="enrollment-month-track">
                {monthMarks.map((mark) => (
                  <span
                    key={mark.month}
                    className={`enrollment-month-pip ${mark.paid ? 'paid' : ''} ${mark.current ? 'current' : ''}`}
                    title={`Month ${mark.month} · ${mark.yearLabel}`}
                  >
                    <b>{mark.name}</b>
                    <small>M{mark.month}</small>
                  </span>
                ))}
              </div>
              <div className="scheme-progress-panel">
                <span className="scheme-progress-track large">
                  <span className="scheme-progress-bar" style={{ width: `${progress}%` }} />
                </span>
                <div className="scheme-progress-panel-meta">
                  <span>Started {date(record.startDate)}</span>
                  <span>{Math.round(progress)}% of term elapsed</span>
                  <span>Matures {date(record.maturityDate)}</span>
                </div>
              </div>
            </section>

            <div className="enrollment-split">
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

              <section className="phonepe-panel">
                <div className="phonepe-panel-head">
                  <h2>Status history</h2>
                </div>
                <div className="phonepe-timeline">
                  {statusHistory.map((step) => (
                    <article
                      className={`phonepe-timeline-step ${step.state}`}
                      key={`${step.title}-${step.detail}`}
                    >
                      <span>{step.state === 'done' ? <CheckCircle2 /> : <Clock3 />}</span>
                      <div>
                        <b>{step.title}</b>
                        <small>{step.detail}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <section className="reports-table-card">
              <div className="reports-table-head">
                <h2>Payment ledger</h2>
                <small>{payments.length} entries</small>
              </div>
              <QueryState loading={false} empty={!payments.length}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Month</th>
                        <th>Amount</th>
                        <th>Gold</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((row: any) => (
                        <tr
                          key={row._id}
                          className="reports-clickable-row"
                          onClick={() => navigate(`/admin/payments/${row._id}`)}
                        >
                          <td>
                            <button
                              type="button"
                              className="reports-cell-link enrollment-receipt-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                setReceiptPayment(row);
                              }}
                            >
                              <ReceiptText />
                              {row.receiptNumber ?? row._id.slice(-6)}
                            </button>
                          </td>
                          <td>{date(row.paymentDate)}</td>
                          <td>{row.method ?? '—'}</td>
                          <td>
                            {row.schemeMonth && record.startDate
                              ? schemeMonthLabel(record.startDate, row.schemeMonth)
                              : '—'}
                          </td>
                          <td>{money(row.amountPaise)}</td>
                          <td>{goldGrams(row.goldWeightMg) ?? '—'}</td>
                          <td>
                            <Status value={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </section>

            {payouts.length > 0 && (
              <section className="reports-table-card">
                <div className="reports-table-head">
                  <h2>Payouts</h2>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Gold</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((row: any) => (
                        <tr key={row._id}>
                          <td>{date(row.payoutDate)}</td>
                          <td>{row.payoutType ?? '—'}</td>
                          <td>{row.method ?? '—'}</td>
                          <td>{money(row.amountPaise)}</td>
                          <td>{goldGrams(row.goldWeightMg) ?? '—'}</td>
                          <td>
                            <Status value={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Reference</h2>
              </div>
              <div className="phonepe-copy-list">
                <CopyChip label="Enrollment" value={record.enrollmentNumber} />
                <CopyChip label="Record ID" value={record._id} />
                <CopyChip label="Customer ID" value={resolveId(record.customerId)} />
                <CopyChip label="Plan ID" value={resolveId(record.schemePlanId)} />
              </div>
            </section>
          </div>
        )}
      </QueryState>

      <Modal
        title="Settle enrollment"
        open={settleOpen}
        onClose={() => {
          if (!createPayout.isPending) setSettleOpen(false);
        }}
      >
        {record && (
          <form
            className="settle-modal-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              createPayout.mutate();
            }}
          >
            <p className="settle-modal-lead">
              {record.enrollmentNumber} · {customerName(record)} · {planName(record)}
            </p>

            <div className="settle-modal-result">
              <div>
                <small>Available</small>
                <strong>
                  {payout.payoutType === 'REDEEM'
                    ? (goldGrams(record.totalGoldWeightMg) ?? '0 g')
                    : money(availablePayoutPaise)}
                </strong>
                <em>{payout.payoutType === 'REDEEM' ? '916 gold weight' : 'Remaining paid amount'}</em>
              </div>
              <ArrowRight className="settle-modal-arrow" />
              <div>
                <small>After settlement</small>
                <strong>{payout.payoutType === 'REDEEM' ? 'REDEEMED' : 'WITHDRAWN'}</strong>
                <em>Scheme closed permanently</em>
              </div>
            </div>

            <div className="settle-modal-toggle" role="radiogroup" aria-label="Settlement option">
              <button
                type="button"
                role="radio"
                aria-checked={payout.payoutType === 'REDEEM'}
                className={payout.payoutType === 'REDEEM' ? 'active' : ''}
                disabled={!isGoldScheme || (record.totalGoldWeightMg ?? 0) <= 0}
                onClick={() => setPayout({ ...payout, payoutType: 'REDEEM' })}
              >
                <Gem />
                <span>
                  <b>Redeem gold</b>
                  <small>
                    {isGoldScheme
                      ? goldGrams(record.totalGoldWeightMg) ?? '0 g'
                      : 'Gold schemes only'}
                  </small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={payout.payoutType === 'PAYOUT'}
                className={payout.payoutType === 'PAYOUT' ? 'active' : ''}
                disabled={availablePayoutPaise <= 0}
                onClick={() => setPayout({ ...payout, payoutType: 'PAYOUT' })}
              >
                <Banknote />
                <span>
                  <b>Payout amount</b>
                  <small>{money(availablePayoutPaise)}</small>
                </span>
              </button>
            </div>

            <div className="settle-modal-fields">
              {payout.payoutType === 'PAYOUT' && (
                <label>
                  <span>Payout method</span>
                  <AdminSelect
                    value={payout.method}
                    placeholder="Select method"
                    icon={<Banknote />}
                    options={[
                      { value: 'BANK', label: 'Bank transfer' },
                      { value: 'UPI', label: 'UPI' },
                      { value: 'CASH', label: 'Cash' },
                    ]}
                    onChange={(value) => setPayout({ ...payout, method: value })}
                  />
                </label>
              )}
              <label>
                <span>Settlement date</span>
                <div className="enroll-modal-date">
                  <CalendarDays />
                  <input
                    className="form-control"
                    type="date"
                    required
                    value={payout.payoutDate}
                    onChange={(event) => setPayout({ ...payout, payoutDate: event.target.value })}
                  />
                </div>
              </label>
              <label className={payout.payoutType === 'PAYOUT' ? '' : 'full'}>
                <span>Reference / voucher</span>
                <input
                  className="form-control"
                  placeholder="Optional voucher number"
                  value={payout.referenceNumber}
                  onChange={(event) =>
                    setPayout({ ...payout, referenceNumber: event.target.value })
                  }
                />
              </label>
              <label className="full">
                <span>Notes</span>
                <input
                  className="form-control"
                  placeholder="Optional settlement note"
                  value={payout.notes}
                  onChange={(event) => setPayout({ ...payout, notes: event.target.value })}
                />
              </label>
            </div>

            <p className="settle-modal-note">
              This completes the scheme. Entitlement is calculated by the server and cannot be
              increased manually.
            </p>

            <Notice error>{error}</Notice>
            <div className="settle-modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={createPayout.isPending}
                onClick={() => setSettleOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  createPayout.isPending ||
                  availablePayoutPaise <= 0 ||
                  (payout.payoutType === 'REDEEM' &&
                    (!isGoldScheme || (record.totalGoldWeightMg ?? 0) <= 0))
                }
              >
                {createPayout.isPending
                  ? 'Settling…'
                  : payout.payoutType === 'REDEEM'
                    ? 'Confirm redemption'
                    : 'Confirm payout'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        title="Official payment receipt"
        open={Boolean(receiptPayment)}
        onClose={() => setReceiptPayment(null)}
      >
        {receiptPayment && (
          <ReceiptSheet payment={receiptPayment} title="Collection receipt" />
        )}
      </Modal>
    </Page>
  );
}
