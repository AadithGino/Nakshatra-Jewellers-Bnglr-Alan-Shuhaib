import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  Copy,
  Gem,
  HandCoins,
  Layers3,
  UserRound,
} from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { Page, QueryState, Status } from '../../../shared/components/ui';

const customerName = (record: any) =>
  record?.customerId?.userId?.name ?? record?.customerId?.customerCode ?? '—';
const customerPhone = (record: any) => record?.customerId?.userId?.phone ?? '—';
const customerCode = (record: any) => record?.customerId?.customerCode ?? '—';
const schemeLabel = (record: any) =>
  record?.schemeId?.schemePlanId?.name ?? record?.schemeId?.enrollmentNumber ?? '—';
const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
};
const payoutTypeLabel = (type?: string) =>
  type === 'REDEEM' ? 'Redeem gold' : type === 'PAYOUT' ? 'Payout amount' : (type ?? '—');
const methodLabel = (method?: string) => {
  if (method === 'CASH') return 'Cash';
  if (method === 'UPI') return 'UPI';
  if (method === 'BANK') return 'Bank';
  if (method === 'GOLD') return 'Gold';
  return method ?? '—';
};

function Fact({
  label,
  value,
  note,
  onClick,
}: {
  label: string;
  value: string;
  note?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button type="button" className="phonepe-fact link" onClick={onClick}>
        <small>{label}</small>
        <b>{value}</b>
        {note && <em>{note}</em>}
      </button>
    );
  }
  return (
    <div className="phonepe-fact">
      <small>{label}</small>
      <b>{value}</b>
      {note && <em>{note}</em>}
    </div>
  );
}

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

export function PayoutDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const detail = useQuery({
    queryKey: ['admin-payout', id],
    queryFn: () => api<any>(`/admin/operation-records/payouts/${id}`),
    enabled: Boolean(id),
  });

  const record = detail.data;
  const customer = resolveId(record?.customerId);
  const enrollment = resolveId(record?.schemeId);
  const isRedeem = record?.payoutType === 'REDEEM';

  const timeline = useMemo(() => {
    if (!record) return [];
    const steps = [
      {
        title: 'Recorded',
        detail: date(record.payoutDate),
        state: record.status === 'REVERSED' ? ('error' as const) : ('done' as const),
      },
      {
        title: isRedeem ? 'Gold redeemed' : 'Amount paid out',
        detail: isRedeem
          ? goldGrams(record.goldWeightMg) ?? money(record.amountPaise)
          : money(record.amountPaise),
        state: 'done' as const,
      },
    ];
    if (record.status === 'REVERSED') {
      steps.push({
        title: 'Reversed',
        detail: record.reversedAt ? date(record.reversedAt) : 'Reversed',
        state: 'error' as const,
      });
    }
    return steps;
  }, [record, isRedeem]);

  return (
    <Page
      title="Payout"
      actions={
        <button className="secondary" onClick={() => navigate('/admin/payouts')}>
          <ArrowLeft /> Back
        </button>
      }
    >
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        empty={!detail.isLoading && !record}
        retry={() => void detail.refetch()}
      >
        {record && (
          <div className="payout-detail-page">
            <section className="payout-hero">
              <div className="payout-hero-main">
                <div className="payout-hero-top">
                  <span className="payout-hero-eyebrow">
                    <HandCoins />
                    Settlement record
                  </span>
                  <div className="admin-hero-toolbar">
                    <div className="payout-hero-badges">
                      <Status value={record.status} />
                      <span
                        className={`payout-type-pill ${String(record.payoutType ?? '').toLowerCase()}`}
                      >
                        {payoutTypeLabel(record.payoutType)}
                      </span>
                      <span className="settings-status-pill clean">
                        {methodLabel(record.method)}
                      </span>
                    </div>
                    {enrollment && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => navigate(`/admin/enrollments/${enrollment}`)}
                      >
                        <Layers3 /> Open enrollment
                      </button>
                    )}
                  </div>
                </div>
                <div className="payout-hero-title-row">
                  <h2>{isRedeem ? goldGrams(record.goldWeightMg) ?? money(record.amountPaise) : money(record.amountPaise)}</h2>
                  <p>
                    {customerName(record)} · {date(record.payoutDate)}
                  </p>
                </div>
                <div className="payout-hero-stats">
                  <article>
                    <small>Amount</small>
                    <strong>{money(record.amountPaise)}</strong>
                  </article>
                  <article>
                    <small>Gold weight</small>
                    <strong>{goldGrams(record.goldWeightMg) ?? '—'}</strong>
                  </article>
                  <article>
                    <small>Method</small>
                    <strong>{methodLabel(record.method)}</strong>
                  </article>
                  <article>
                    <small>Enrollment</small>
                    <strong>{record.schemeId?.enrollmentNumber ?? '—'}</strong>
                  </article>
                </div>
              </div>
              <div className="payout-hero-side">
                <div className={`payout-hero-icon ${isRedeem ? 'redeem' : ''}`}>
                  {isRedeem ? <Gem /> : <Banknote />}
                </div>
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-facts-row">
                <Fact
                  label="Customer"
                  value={customerName(record)}
                  note={`${customerCode(record)} · ${customerPhone(record)}`}
                  onClick={() => {
                    if (customer) navigate(`/admin/customers/${customer}`);
                  }}
                />
                <Fact
                  label="Scheme"
                  value={schemeLabel(record)}
                  note={record.schemeId?.enrollmentNumber ?? '—'}
                  onClick={() => {
                    if (enrollment) navigate(`/admin/enrollments/${enrollment}`);
                  }}
                />
                <Fact label="Settlement" value={payoutTypeLabel(record.payoutType)} />
                <Fact label="Method" value={methodLabel(record.method)} />
                <Fact label="Payout date" value={date(record.payoutDate)} />
                <Fact
                  label="Created by"
                  value={record.createdBy?.name ?? '—'}
                  note={record.createdBy?.phone}
                />
              </div>
            </section>

            <div className="payout-detail-split">
              <section className="phonepe-panel">
                <div className="phonepe-panel-head">
                  <h2>Timeline</h2>
                </div>
                <div className="phonepe-timeline">
                  {timeline.map((step) => (
                    <article className={`phonepe-timeline-step ${step.state}`} key={step.title}>
                      <span>
                        {step.state === 'done' ? <CheckCircle2 /> : <Clock3 />}
                      </span>
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
                  <h2>Reference IDs</h2>
                </div>
                <div className="phonepe-copy-list">
                  <CopyChip label="Payout ID" value={String(record._id)} />
                  <CopyChip label="Reference" value={record.referenceNumber} />
                  <CopyChip label="Customer ID" value={customer} />
                  <CopyChip label="Enrollment ID" value={enrollment} />
                </div>
                {record.notes && (
                  <p className="helper" style={{ marginTop: 12 }}>
                    Notes: {record.notes}
                  </p>
                )}
              </section>
            </div>

            <section className="reports-table-card">
              <div className="reports-table-head">
                <h2>Settlement summary</h2>
              </div>
              <div className="payout-summary-grid">
                <article>
                  <span>
                    <UserRound />
                  </span>
                  <div>
                    <small>Customer</small>
                    <b>{customerName(record)}</b>
                    <em>{customerPhone(record)}</em>
                  </div>
                </article>
                <article>
                  <span>
                    <Layers3 />
                  </span>
                  <div>
                    <small>Scheme plan</small>
                    <b>{schemeLabel(record)}</b>
                    <em>{record.schemeId?.schemeType?.replaceAll('_', ' ') ?? '—'}</em>
                  </div>
                </article>
                <article>
                  <span>
                    <Banknote />
                  </span>
                  <div>
                    <small>Cash value</small>
                    <b>{money(record.amountPaise)}</b>
                    <em>{methodLabel(record.method)}</em>
                  </div>
                </article>
                <article>
                  <span>
                    <Gem />
                  </span>
                  <div>
                    <small>Gold value</small>
                    <b>{goldGrams(record.goldWeightMg) ?? '—'}</b>
                    <em>{isRedeem ? 'Redeemed from scheme' : 'Not applicable'}</em>
                  </div>
                </article>
              </div>
            </section>
          </div>
        )}
      </QueryState>
    </Page>
  );
}
