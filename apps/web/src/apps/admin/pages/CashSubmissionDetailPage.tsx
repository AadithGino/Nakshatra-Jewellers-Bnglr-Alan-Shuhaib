import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  Copy,
  HandCoins,
  UserRound,
} from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Page, QueryState, Status } from '../../../shared/components/ui';

const staffName = (record: any) => record?.staffId?.name ?? '—';
const staffPhone = (record: any) => record?.staffId?.phone ?? '—';
const staffCode = (record: any) => record?.employeeCode ?? '—';
const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
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

export function CashSubmissionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const detail = useQuery({
    queryKey: ['admin-cash-submission', id],
    queryFn: () => api<any>(`/admin/operation-records/cash-submissions/${id}`),
    enabled: Boolean(id),
  });

  const record = detail.data;
  const staffUserId = resolveId(record?.staffId);
  const staffProfileId = record?.staffProfileId ? String(record.staffProfileId) : null;

  const timeline = useMemo(() => {
    if (!record) return [];
    const steps = [
      {
        title: 'Submitted',
        detail: date(record.submissionDate),
        state: record.status === 'REVERSED' ? ('error' as const) : ('done' as const),
      },
      {
        title: 'Cash received',
        detail: money(record.amountPaise),
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
  }, [record]);

  return (
    <Page
      title="Cash submission"
      actions={
        <button className="secondary" onClick={() => navigate('/admin/cash-submissions')}>
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
          <div className="cash-submission-detail-page">
            <section className="payout-hero">
              <div className="payout-hero-main">
                <div className="payout-hero-top">
                  <span className="payout-hero-eyebrow">
                    <HandCoins />
                    Till handover
                  </span>
                  <div className="admin-hero-toolbar">
                    <div className="payout-hero-badges">
                      <Status value={record.status} />
                      <span className="settings-status-pill clean">Cash</span>
                    </div>
                    {staffProfileId && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => navigate(`/admin/staff/${staffProfileId}`)}
                      >
                        <UserRound /> Open staff
                      </button>
                    )}
                  </div>
                </div>
                <div className="payout-hero-title-row">
                  <h2>{money(record.amountPaise)}</h2>
                  <p>
                    {staffName(record)} · {date(record.submissionDate)}
                  </p>
                </div>
                <div className="payout-hero-stats">
                  <article>
                    <small>Amount</small>
                    <strong>{money(record.amountPaise)}</strong>
                  </article>
                  <article>
                    <small>Staff</small>
                    <strong>{staffName(record)}</strong>
                  </article>
                  <article>
                    <small>Employee code</small>
                    <strong>{staffCode(record)}</strong>
                  </article>
                  <article>
                    <small>Received by</small>
                    <strong>{record.receivedBy?.name ?? '—'}</strong>
                  </article>
                </div>
              </div>
              <div className="payout-hero-side">
                <div className="payout-hero-icon">
                  <Banknote />
                </div>
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-facts-row">
                <Fact
                  label="Staff"
                  value={staffName(record)}
                  note={`${staffCode(record)} · ${staffPhone(record)}`}
                  onClick={
                    staffProfileId
                      ? () => navigate(`/admin/staff/${staffProfileId}`)
                      : undefined
                  }
                />
                <Fact
                  label="Received by"
                  value={record.receivedBy?.name ?? '—'}
                  note={record.receivedBy?.phone}
                />
                <Fact
                  label="Created by"
                  value={record.createdBy?.name ?? '—'}
                  note={record.createdBy?.phone}
                />
                <Fact label="Submission date" value={date(record.submissionDate)} />
                <Fact label="Status" value={String(record.status ?? '—')} />
                <Fact
                  label="Staff user"
                  value={staffUserId ?? '—'}
                  note="Linked user account"
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
                  <CopyChip label="Submission ID" value={String(record._id)} />
                  <CopyChip label="Staff user ID" value={staffUserId} />
                  <CopyChip label="Staff profile ID" value={staffProfileId} />
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
                <h2>Handover summary</h2>
              </div>
              <div className="payout-summary-grid">
                <article>
                  <span>
                    <UserRound />
                  </span>
                  <div>
                    <small>Staff</small>
                    <b>{staffName(record)}</b>
                    <em>{staffPhone(record)}</em>
                  </div>
                </article>
                <article>
                  <span>
                    <Banknote />
                  </span>
                  <div>
                    <small>Cash handed over</small>
                    <b>{money(record.amountPaise)}</b>
                    <em>{date(record.submissionDate)}</em>
                  </div>
                </article>
                <article>
                  <span>
                    <HandCoins />
                  </span>
                  <div>
                    <small>Received by</small>
                    <b>{record.receivedBy?.name ?? '—'}</b>
                    <em>{record.receivedBy?.phone ?? 'Admin till'}</em>
                  </div>
                </article>
                <article>
                  <span>
                    <CheckCircle2 />
                  </span>
                  <div>
                    <small>Status</small>
                    <b>{record.status}</b>
                    <em>
                      {record.status === 'REVERSED'
                        ? record.reversedAt
                          ? date(record.reversedAt)
                          : 'Reversed'
                        : 'Posted to till'}
                    </em>
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
