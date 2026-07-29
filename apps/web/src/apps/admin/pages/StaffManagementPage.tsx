import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

// Shared with the staff detail workspace.
// eslint-disable-next-line react-refresh/only-export-components
export const permissionOptions = [
  'canCreateCustomer',
  'canEnrollScheme',
  'canCollectPayment',
  'canViewCustomers',
  'canSubmitCorrectionRequest',
];

const PAGE_SIZE = 10;

const emptyForm = {
  name: '',
  phone: '',
  password: '',
  employeeCode: '',
  permissions: [] as string[],
  notes: '',
};

const permissionLabel = (permission: string) =>
  permission.replace('can', '').replaceAll(/([A-Z])/g, ' $1').trim();

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

export function StaffManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['admin-staff', search],
    queryFn: () => api<any[]>(`/admin/staff?search=${encodeURIComponent(search)}&limit=200`),
  });

  const rows = list.data ?? [];

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const summary = useMemo(() => {
    const active = rows.filter(
      (row) => row.userId?.status === 'ACTIVE' || row.status === 'ACTIVE',
    );
    return {
      total: rows.length,
      active: active.length,
      inactive: rows.length - active.length,
      permissions: rows.reduce((sum, row) => sum + (row.permissions?.length ?? 0), 0),
    };
  }, [rows]);

  const create = useMutation({
    mutationFn: () => api('/admin/staff', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(emptyForm);
      setMessage('Staff account created successfully.');
      await queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: (requestError) =>
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to create staff.'),
  });

  const togglePermission = (permission: string) =>
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));

  const openCreate = () => {
    setError('');
    setForm(emptyForm);
    setCreateOpen(true);
  };

  return (
    <Page title="Staff" subtitle="Employee accounts, permissions and collection workspace.">
      <Notice>{message}</Notice>
      <div className="scheme-admin-page">
        <section className="admin-module-strip">
          <div className="admin-module-strip-main">
            <span className="admin-module-strip-icon">
              <UsersRound />
            </span>
            <div className="admin-module-strip-copy">
              <small>Staff directory</small>
              <strong>{summary.active.toLocaleString('en-IN')} active accounts</strong>
            </div>
            <span className="admin-module-strip-meta">
              {summary.total} total · {summary.inactive} inactive
            </span>
          </div>
          <button type="button" className="admin-module-action" onClick={openCreate}>
            <Plus />
            Add staff
          </button>
        </section>

        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <UsersRound />
            </span>
            <div>
              <small>Total staff</small>
              <strong>{summary.total.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi success">
            <span>
              <BadgeCheck />
            </span>
            <div>
              <small>Active</small>
              <strong>{summary.active.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <KeyRound />
            </span>
            <div>
              <small>Inactive</small>
              <strong>{summary.inactive.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <ShieldCheck />
            </span>
            <div>
              <small>Permissions granted</small>
              <strong>{summary.permissions.toLocaleString('en-IN')}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card">
          <div className="reports-table-head">
            <h2>Staff ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search name, phone or employee code..."
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
            empty={!list.isLoading && !rows.length}
            retry={() => void list.refetch()}
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Employee code</th>
                    <th>Phone</th>
                    <th>Permissions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((staff) => (
                    <tr
                      key={staff._id}
                      className="reports-clickable-row"
                      onClick={() => navigate(`/admin/staff/${staff._id}`)}
                    >
                      <td>
                        <span className="scheme-admin-name-cell">
                          <b className="reports-inline-link">{staff.userId?.name ?? '—'}</b>
                          <small>
                            {(staff.permissions ?? [])
                              .slice(0, 2)
                              .map(permissionLabel)
                              .join(' · ') || 'No permissions'}
                          </small>
                        </span>
                      </td>
                      <td>{staff.employeeCode}</td>
                      <td>{staff.userId?.phone ?? '—'}</td>
                      <td>{staff.permissions?.length ?? 0}</td>
                      <td>
                        <Status value={staff.userId?.status ?? 'INACTIVE'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={rows.length} onChange={setPage} />
          </QueryState>
        </section>
      </div>

      <Modal
        title="Create staff account"
        open={createOpen}
        onClose={() => {
          if (!create.isPending) setCreateOpen(false);
        }}
      >
        <form
          className="plan-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            create.mutate();
          }}
        >
          <p className="plan-modal-lead">
            Creates a staff login with temporary password and role-based collection permissions.
          </p>

          <div className="plan-modal-preview">
            <div>
              <small>Staff</small>
              <strong>{form.name || '—'}</strong>
              <em>{form.employeeCode || 'Employee code pending'}</em>
            </div>
            <div>
              <small>Permissions</small>
              <strong>{form.permissions.length || 0}</strong>
              <em>{form.phone || 'Phone pending'}</em>
            </div>
          </div>

          <div className="plan-modal-fields">
            <label>
              <span>Name</span>
              <input
                className="form-control"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                className="form-control"
                required
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label>
              <span>Employee code</span>
              <input
                className="form-control"
                required
                value={form.employeeCode}
                onChange={(event) => setForm({ ...form, employeeCode: event.target.value })}
              />
            </label>
            <label>
              <span>Temporary password</span>
              <input
                className="form-control"
                type="password"
                minLength={10}
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
            <label className="full">
              <span>Notes</span>
              <textarea
                className="form-control"
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
            <div className="full staff-permission-grid">
              <span>Permissions</span>
              <div className="check-grid">
                {permissionOptions.map((permission) => (
                  <label key={permission}>
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(permission)}
                      onChange={() => togglePermission(permission)}
                    />{' '}
                    {permissionLabel(permission)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Notice error>{error}</Notice>
          <div className="plan-modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={create.isPending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button className="primary" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create staff'}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
