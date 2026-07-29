import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Layers3,
  ScrollText,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { Page, QueryState } from '../../../shared/components/ui';

const PAGE_SIZE = 20;

const dateTime = (value?: string | Date) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(value))
    : '—';

const actorName = (row: any) =>
  row.actorId?.name ?? row.actorRole ?? 'System';

const actorDetail = (row: any) => {
  const phone = row.actorId?.phone;
  if (phone && row.actorRole) return `${row.actorRole} · ${phone}`;
  if (row.actorRole) return row.actorRole;
  return phone ?? '—';
};

const actionLabel = (action?: string) =>
  (action ?? '—').replaceAll('_', ' ');

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

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="reports-pagination">
      <span>
        Showing {from} to {to} of {total.toLocaleString('en-IN')} entries
      </span>
      <div>
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft />
        </button>
        <button type="button" className="active">
          {page}
        </button>
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

export function AuditLogsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api<any[]>('/admin/audit-logs?limit=100'),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = list.data ?? [];
    if (!term) return rows;
    return rows.filter((row) =>
      [
        row.action,
        row.entityType,
        row.entityId,
        row.actorRole,
        row.actorId?.name,
        row.actorId?.phone,
        row.requestId,
        row.ip,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [list.data, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const summary = useMemo(() => {
    const data = list.data ?? [];
    const actors = new Set(
      data.map((row) => String(row.actorId?._id ?? row.actorRole ?? 'system')),
    );
    const entities = new Set(data.map((row) => row.entityType).filter(Boolean));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = data.filter((row) => new Date(row.createdAt) >= today).length;
    return {
      total: data.length,
      today: todayCount,
      actors: actors.size,
      entities: entities.size,
    };
  }, [list.data]);

  return (
    <Page
      title="Audit logs"
      subtitle="Immutable trail of admin, staff and system actions across the platform."
    >
      <div className="audit-logs-page">
        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <ScrollText />
            </span>
            <div>
              <small>Total events</small>
              <strong>{summary.total.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi success">
            <span>
              <ShieldCheck />
            </span>
            <div>
              <small>Today</small>
              <strong>{summary.today.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <UserRound />
            </span>
            <div>
              <small>Distinct actors</small>
              <strong>{summary.actors.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Layers3 />
            </span>
            <div>
              <small>Entity types</small>
              <strong>{summary.entities.toLocaleString('en-IN')}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card">
          <div className="reports-table-head">
            <h2>Activity ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search action, actor, entity, request ID..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
          <QueryState
            loading={list.isLoading}
            error={list.error}
            empty={!list.isLoading && !filtered.length}
            retry={() => void list.refetch()}
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Entity</th>
                    <th>Request</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => {
                    const entityLink = entityPath(
                      row.entityType,
                      row.entityId ? String(row.entityId) : undefined,
                    );
                    return (
                      <tr
                        key={row._id}
                        className="reports-clickable-row"
                        onClick={() => navigate(`/admin/audit-logs/${row._id}`)}
                      >
                        <td>
                          <span className="scheme-admin-name-cell">
                            <b className="reports-inline-link">{dateTime(row.createdAt)}</b>
                            <small>{row.ip || 'No IP'}</small>
                          </span>
                        </td>
                        <td>
                          <span className="audit-action-pill">{actionLabel(row.action)}</span>
                        </td>
                        <td>
                          <span className="scheme-admin-name-cell">
                            <b>{actorName(row)}</b>
                            <small>{actorDetail(row)}</small>
                          </span>
                        </td>
                        <td>
                          <span className="scheme-admin-name-cell">
                            <b>{row.entityType ?? '—'}</b>
                            <small>
                              {entityLink ? (
                                <button
                                  type="button"
                                  className="reports-cell-link"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(entityLink);
                                  }}
                                >
                                  {String(row.entityId).slice(-8)}
                                </button>
                              ) : (
                                row.entityId ? String(row.entityId).slice(-8) : '—'
                              )}
                            </small>
                          </span>
                        </td>
                        <td>
                          <span className="audit-mono">
                            <Fingerprint />
                            {row.requestId ? String(row.requestId).slice(0, 12) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={filtered.length} onChange={setPage} />
          </QueryState>
        </section>
      </div>
    </Page>
  );
}
