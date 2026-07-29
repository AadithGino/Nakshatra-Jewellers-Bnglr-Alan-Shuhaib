import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gem,
  Layers3,
  Plus,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { AdminSelect } from '../components/AdminSelect';

const PAGE_SIZE = 10;

const typeLabel = (type?: string) => (type === 'GOLD_WEIGHT' ? 'Gold weight' : type === 'CASH' ? 'Cash' : '—');
const customerName = (row: any) =>
  row.customerId?.userId?.name ?? row.customerId?.customerCode ?? '—';
const planName = (row: any) => row.schemePlanId?.name ?? '—';
const customerId = (row: any) => {
  const id = row.customerId?._id ?? row.customerId;
  return id ? String(id) : null;
};

function enrollmentProgress(start?: string, maturity?: string) {
  if (!start || !maturity) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(maturity).getTime();
  if (endMs <= startMs) return 0;
  return Math.min(100, Math.max(0, ((Date.now() - startMs) / (endMs - startMs)) * 100));
}

function ProgressCell({ start, maturity }: { start?: string; maturity?: string }) {
  const value = enrollmentProgress(start, maturity);
  return (
    <span className="scheme-progress-cell">
      <span className="scheme-progress-track">
        <span className="scheme-progress-bar" style={{ width: `${value}%` }} />
      </span>
      <small>{Math.round(value)}%</small>
    </span>
  );
}

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

export function EnrollmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    schemePlanId: '',
    enrollmentNumber: '',
    startDate: new Date().toISOString().slice(0, 10),
  });

  const list = useQuery({
    queryKey: ['admin-enrollments'],
    queryFn: () => api<any[]>('/admin/enrollments?limit=500'),
  });
  const customers = useQuery({
    queryKey: ['admin-enrollment-customers'],
    queryFn: () => api<any[]>('/admin/customers?limit=100'),
    enabled: createOpen,
  });
  const plans = useQuery({
    queryKey: ['admin-scheme-plans'],
    queryFn: () => api<any[]>('/admin/scheme-plans'),
    enabled: createOpen,
  });

  const rows = list.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [
        row.enrollmentNumber,
        customerName(row),
        planName(row),
        row.schemeType,
        row.status,
        money(row.totalPaidPaise),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [rows, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => row.status === 'ACTIVE').length,
      matured: rows.filter((row) => row.status === 'MATURED').length,
      paidPaise: rows.reduce((sum, row) => sum + (row.totalPaidPaise ?? 0), 0),
      goldMg: rows.reduce((sum, row) => sum + (row.totalGoldWeightMg ?? 0), 0),
    };
  }, [rows]);

  const create = useMutation({
    mutationFn: () =>
      api('/admin/enrollments', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setMessage('Customer enrolled successfully.');
      setForm({
        customerId: '',
        schemePlanId: '',
        enrollmentNumber: '',
        startDate: new Date().toISOString().slice(0, 10),
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to enroll customer.',
      ),
  });

  const customerOptions = (customers.data ?? []).map((customer: any) => ({
    value: customer._id,
    label: customer.userId?.name ?? customer.customerCode,
    hint: customer.customerCode,
  }));
  const planOptions = (plans.data ?? [])
    .filter((plan: any) => plan.status === 'ACTIVE')
    .map((plan: any) => ({
      value: plan._id,
      label: plan.name,
      hint: `${typeLabel(plan.type)} · ${plan.durationMonths} months`,
    }));
  const selectedPlan = (plans.data ?? []).find((plan: any) => plan._id === form.schemePlanId);
  const selectedCustomer = (customers.data ?? []).find(
    (customer: any) => customer._id === form.customerId,
  );

  const openCreate = () => {
    setError('');
    setForm({
      customerId: '',
      schemePlanId: '',
      enrollmentNumber: '',
      startDate: new Date().toISOString().slice(0, 10),
    });
    setCreateOpen(true);
  };
  return (
    <Page title="Enrollments" subtitle="Customer scheme memberships, balances and maturity progress.">
      <Notice>{message}</Notice>
      <div className="scheme-admin-page">
        <section className="admin-module-strip">
          <div className="admin-module-strip-main">
            <span className="admin-module-strip-icon">
              <Users />
            </span>
            <div className="admin-module-strip-copy">
              <small>Active memberships</small>
              <strong>{summary.active.toLocaleString('en-IN')} running schemes</strong>
            </div>
            <span className="admin-module-strip-meta">
              {summary.matured} matured · {money(summary.paidPaise)} collected
            </span>
          </div>
          <button type="button" className="admin-module-action" onClick={openCreate}>
            <Plus />
            Enroll customer
          </button>
        </section>

        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <UserRound />
            </span>
            <div>
              <small>Total enrollments</small>
              <strong>{summary.total.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi success">
            <span>
              <Users />
            </span>
            <div>
              <small>Active</small>
              <strong>{summary.active.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Gem />
            </span>
            <div>
              <small>Gold accumulated</small>
              <strong>{goldGrams(summary.goldMg) ?? '0 g'}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Gem />
            </span>
            <div>
              <small>Total collected</small>
              <strong>{money(summary.paidPaise)}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card">
          <div className="reports-table-head">
            <h2>Enrollment ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search enrollment, customer, plan..."
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
                    <th>Enrollment</th>
                    <th>Customer</th>
                    <th>Plan</th>
                    <th>Paid</th>
                    <th>Progress</th>
                    <th>Maturity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => (
                    <tr
                      key={row._id}
                      className="reports-clickable-row"
                      onClick={() => navigate(`/admin/enrollments/${row._id}`)}
                    >
                      <td>
                        <span className="scheme-admin-name-cell">
                          <b className="reports-inline-link">{row.enrollmentNumber}</b>
                          <small>{typeLabel(row.schemeType)}</small>
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="reports-cell-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            const id = customerId(row);
                            if (id) navigate(`/admin/customers/${id}`);
                          }}
                        >
                          {customerName(row)}
                        </button>
                      </td>
                      <td>{planName(row)}</td>
                      <td>{money(row.totalPaidPaise)}</td>
                      <td>
                        <ProgressCell start={row.startDate} maturity={row.maturityDate} />
                      </td>
                      <td>{date(row.maturityDate)}</td>
                      <td>
                        <Status value={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={filtered.length} onChange={setPage} />
          </QueryState>
        </section>
      </div>

      <Modal title="Enroll customer" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          className="enroll-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            if (!form.customerId || !form.schemePlanId) {
              setError('Select both a customer and a scheme plan.');
              return;
            }
            create.mutate();
          }}
        >
          <p className="enroll-modal-lead">
            One active scheme per customer. Maturity is calculated from the selected plan and start
            date.
          </p>

          {(selectedCustomer || selectedPlan) && (
            <div className="enroll-modal-preview">
              <div>
                <small>Customer</small>
                <strong>{selectedCustomer?.userId?.name ?? '—'}</strong>
                <em>{selectedCustomer?.customerCode ?? 'Choose a customer'}</em>
              </div>
              <div>
                <small>Plan</small>
                <strong>{selectedPlan?.name ?? '—'}</strong>
                <em>
                  {selectedPlan
                    ? `${typeLabel(selectedPlan.type)} · ${selectedPlan.durationMonths} months`
                    : 'Choose a scheme plan'}
                </em>
              </div>
            </div>
          )}

          <div className="enroll-modal-fields">
            <label>
              <span>Customer</span>
              <AdminSelect
                required
                icon={<UserRound />}
                placeholder="Select customer"
                value={form.customerId}
                options={customerOptions}
                onChange={(value) => setForm({ ...form, customerId: value })}
              />
            </label>
            <label>
              <span>Scheme plan</span>
              <AdminSelect
                required
                icon={<Layers3 />}
                placeholder="Select plan"
                value={form.schemePlanId}
                options={planOptions}
                onChange={(value) => setForm({ ...form, schemePlanId: value })}
              />
            </label>
            <label>
              <span>Enrollment number</span>
              <input
                className="form-control"
                required
                placeholder="e.g. 1002"
                value={form.enrollmentNumber}
                onChange={(event) => setForm({ ...form, enrollmentNumber: event.target.value })}
              />
            </label>
            <label>
              <span>Start date</span>
              <div className="enroll-modal-date">
                <CalendarDays />
                <input
                  className="form-control"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                />
              </div>
            </label>
          </div>

          <Notice error>{error}</Notice>
          <div className="enroll-modal-actions">
            <button type="button" className="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="primary" disabled={create.isPending}>
              {create.isPending ? 'Enrolling…' : 'Confirm enrollment'}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
