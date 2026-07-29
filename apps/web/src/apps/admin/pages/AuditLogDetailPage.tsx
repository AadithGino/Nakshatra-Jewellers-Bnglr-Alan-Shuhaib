import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Fingerprint,
  Globe,
  Layers3,
  MonitorSmartphone,
  ScrollText,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { Page, QueryState } from '../../../shared/components/ui';

const dateTime = (value?: string | Date) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(value))
    : '—';

const actionLabel = (action?: string) => (action ?? '—').replaceAll('_', ' ');

const actorName = (record: any) => record?.actorId?.name ?? record?.actorRole ?? 'System';

const actorDetail = (record: any) => {
  const parts = [record?.actorRole, record?.actorId?.phone].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
};

const entityPath = (entityType?: string, entityId?: string) => {
  if (!entityType || !entityId) return null;
  const map: Record<string, string> = {
    Payment: `/admin/payments/${entityId}`,
    SchemeEnrollment: `/admin/enrollments/${entityId}`,
    SchemePlan: `/admin/scheme-plans/${entityId}`,
    Customer: `/admin/customers/${entityId}`,
    GoldRate: `/admin/gold-rates/${entityId}`,
    User: `/admin/staff/${entityId}`,
    StaffProfile: `/admin/staff/${entityId}`,
    PaymentIntent: `/admin/phonepe-transactions/${entityId}`,
    CashSubmission: `/admin/cash-submissions/${entityId}`,
    Payout: `/admin/payouts/${entityId}`,
  };
  return map[entityType] ?? null;
};

const prettyJson = (value: unknown) => {
  if (value == null) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const compactJson = (value: unknown) => {
  if (value == null) return '—';
  try {
    const text = JSON.stringify(value);
    return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  } catch {
    return String(value);
  }
};

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

function SnapshotPanel({
  title,
  value,
  empty,
}: {
  title: string;
  value: unknown;
  empty: string;
}) {
  const text = prettyJson(value);
  return (
    <section className="reports-table-card audit-snapshot-card">
      <div className="reports-table-head">
        <h2>{title}</h2>
        {text && (
          <button
            type="button"
            className="secondary audit-copy-json"
            onClick={() => void navigator.clipboard.writeText(text)}
          >
            <Copy /> Copy JSON
          </button>
        )}
      </div>
      {text ? (
        <pre className="audit-json">{text}</pre>
      ) : (
        <p className="helper">{empty}</p>
      )}
    </section>
  );
}

export function AuditLogDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const detail = useQuery({
    queryKey: ['admin-audit-log', id],
    queryFn: () => api<any>(`/admin/operation-records/audit-logs/${id}`),
    enabled: Boolean(id),
  });

  const record = detail.data;
  const entityId = record?.entityId ? String(record.entityId) : '';
  const linkedPath = entityPath(record?.entityType, entityId);

  const changedKeys = useMemo(() => {
    if (!record?.before || !record?.after) return [] as string[];
    if (typeof record.before !== 'object' || typeof record.after !== 'object') return [];
    const before = record.before as Record<string, unknown>;
    const after = record.after as Record<string, unknown>;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys]
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .slice(0, 12);
  }, [record]);

  return (
    <Page
      title="Audit event"
      actions={
        <button className="secondary" onClick={() => navigate('/admin/audit-logs')}>
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
          <div className="audit-detail-page">
            <section className="audit-hero">
              <div className="audit-hero-main">
                <div className="audit-hero-top">
                  <span className="audit-hero-eyebrow">
                    <ScrollText />
                    Audit trail
                  </span>
                  <div className="admin-hero-toolbar">
                    <div className="audit-hero-badges">
                      <span className="audit-action-pill large">{actionLabel(record.action)}</span>
                      {record.actorRole && (
                        <span className="settings-status-pill clean">{record.actorRole}</span>
                      )}
                    </div>
                    {linkedPath && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => navigate(linkedPath)}
                      >
                        <Layers3 /> Open entity
                      </button>
                    )}
                  </div>
                </div>
                <div className="audit-hero-title-row">
                  <h2>{actionLabel(record.action)}</h2>
                  <p>
                    {dateTime(record.createdAt)}
                    {record.entityType ? ` · ${record.entityType}` : ''}
                  </p>
                </div>
                <div className="audit-hero-stats">
                  <article>
                    <small>Actor</small>
                    <strong>{actorName(record)}</strong>
                  </article>
                  <article>
                    <small>Entity</small>
                    <strong>{record.entityType ?? '—'}</strong>
                  </article>
                  <article>
                    <small>IP address</small>
                    <strong>{record.ip || '—'}</strong>
                  </article>
                  <article>
                    <small>Changed fields</small>
                    <strong>{changedKeys.length || (record.after ? 'Snapshot' : '—')}</strong>
                  </article>
                </div>
              </div>
              <div className="audit-hero-side">
                <div className="audit-hero-icon">
                  <ShieldCheck />
                </div>
              </div>
            </section>

            <div className="audit-facts">
              <article className="settings-fact">
                <span>
                  <UserRound />
                </span>
                <div>
                  <small>Actor</small>
                  <b>{actorName(record)}</b>
                  <em>{actorDetail(record)}</em>
                </div>
              </article>
              <article className="settings-fact">
                <span>
                  <Layers3 />
                </span>
                <div>
                  <small>Entity</small>
                  <b>{record.entityType ?? '—'}</b>
                  <em>{entityId ? entityId.slice(-12) : 'No entity id'}</em>
                </div>
              </article>
              <article className="settings-fact">
                <span>
                  <Globe />
                </span>
                <div>
                  <small>Network</small>
                  <b>{record.ip || '—'}</b>
                  <em>Client IP at request time</em>
                </div>
              </article>
              <article className="settings-fact">
                <span>
                  <MonitorSmartphone />
                </span>
                <div>
                  <small>User agent</small>
                  <b>{record.userAgent ? 'Captured' : 'Not set'}</b>
                  <em>{record.userAgent ? String(record.userAgent).slice(0, 42) : '—'}</em>
                </div>
              </article>
            </div>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Reference IDs</h2>
              </div>
              <div className="phonepe-copy-list">
                <CopyChip label="Audit ID" value={String(record._id)} />
                <CopyChip label="Request ID" value={record.requestId} />
                <CopyChip label="Entity ID" value={entityId || null} />
                <CopyChip
                  label="Actor ID"
                  value={
                    record.actorId?._id
                      ? String(record.actorId._id)
                      : record.actorId
                        ? String(record.actorId)
                        : null
                  }
                />
              </div>
            </section>

            {changedKeys.length > 0 && (
              <section className="reports-table-card">
                <div className="reports-table-head">
                  <h2>Field changes</h2>
                  <small>{changedKeys.length} keys differ</small>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Before</th>
                        <th>After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changedKeys.map((key) => (
                        <tr key={key}>
                          <td>
                            <span className="audit-mono">
                              <Fingerprint />
                              {key}
                            </span>
                          </td>
                          <td>
                            <code className="audit-value-chip">
                              {compactJson((record.before as any)?.[key])}
                            </code>
                          </td>
                          <td>
                            <code className="audit-value-chip after">
                              {compactJson((record.after as any)?.[key])}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="audit-snapshot-grid">
              <SnapshotPanel
                title="Before"
                value={record.before}
                empty="No before snapshot was recorded for this event."
              />
              <SnapshotPanel
                title="After"
                value={record.after}
                empty="No after snapshot was recorded for this event."
              />
            </div>

            {record.userAgent && (
              <section className="reports-table-card">
                <div className="reports-table-head">
                  <h2>User agent</h2>
                </div>
                <p className="audit-user-agent">{record.userAgent}</p>
              </section>
            )}
          </div>
        )}
      </QueryState>
    </Page>
  );
}
