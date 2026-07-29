import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { AadhaarUploadFields } from '../../../shared/components/AadhaarUploadFields';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

const PAGE_SIZE = 10;

const emptyForm = {
  name: '',
  phone: '',
  password: '',
  line1: '',
  city: '',
  district: '',
  state: '',
  postalCode: '',
  nomineeName: '',
  nomineeRelationship: '',
  nomineePhone: '',
  aadhaarFrontKey: '',
  aadhaarBackKey: '',
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

export function CustomerManagementPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(params.get('action') === 'create');
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: () => api<any[]>(`/admin/customers?search=${encodeURIComponent(search)}`),
  });

  const rows = list.data ?? [];

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const summary = useMemo(() => {
    const active = rows.filter((row) => row.status === 'ACTIVE');
    const withNominee = rows.filter((row) => row.nomineeId?.name || row.nomineeId);
    return {
      total: rows.length,
      active: active.length,
      inactive: rows.length - active.length,
      withNominee: withNominee.length,
    };
  }, [rows]);

  const create = useMutation({
    mutationFn: () =>
      api('/admin/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          password: form.password,
          address: {
            line1: form.line1 || undefined,
            city: form.city || undefined,
            district: form.district || undefined,
            state: form.state || undefined,
            postalCode: form.postalCode || undefined,
          },
          aadhaar:
            form.aadhaarFrontKey || form.aadhaarBackKey
              ? {
                  frontKey: form.aadhaarFrontKey || undefined,
                  backKey: form.aadhaarBackKey || undefined,
                }
              : undefined,
          nominee: form.nomineeName
            ? {
                name: form.nomineeName,
                relationship: form.nomineeRelationship,
                phone: form.nomineePhone || undefined,
              }
            : undefined,
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(emptyForm);
      setMessage('Customer created successfully.');
      await queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to create customer.',
      ),
  });

  const openCreate = () => {
    setError('');
    setForm(emptyForm);
    setCreateOpen(true);
  };

  return (
    <Page title="Customers" subtitle="Search accounts and open a complete customer workspace.">
      <Notice>{message}</Notice>
      <div className="scheme-admin-page">
        <section className="admin-module-strip">
          <div className="admin-module-strip-main">
            <span className="admin-module-strip-icon">
              <UsersRound />
            </span>
            <div className="admin-module-strip-copy">
              <small>Customer directory</small>
              <strong>{summary.active.toLocaleString('en-IN')} active accounts</strong>
            </div>
            <span className="admin-module-strip-meta">
              {summary.total} total · {summary.inactive} inactive
            </span>
          </div>
          <button type="button" className="admin-module-action" onClick={openCreate}>
            <Plus />
            Add customer
          </button>
        </section>

        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <UsersRound />
            </span>
            <div>
              <small>Total customers</small>
              <strong>{summary.total.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi success">
            <span>
              <ShieldCheck />
            </span>
            <div>
              <small>Active</small>
              <strong>{summary.active.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <UserRound />
            </span>
            <div>
              <small>Inactive</small>
              <strong>{summary.inactive.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <MapPin />
            </span>
            <div>
              <small>With nominee</small>
              <strong>{summary.withNominee.toLocaleString('en-IN')}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card">
          <div className="reports-table-head">
            <h2>Customer ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search name, phone or customer ID..."
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
                    <th>Customer</th>
                    <th>Passbook ID</th>
                    <th>Phone</th>
                    <th>City</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((customer) => (
                    <tr
                      key={customer._id}
                      className="reports-clickable-row"
                      onClick={() => navigate(`/admin/customers/${customer._id}`)}
                    >
                      <td>
                        <span className="scheme-admin-name-cell">
                          <b className="reports-inline-link">{customer.userId?.name ?? '—'}</b>
                          <small>{customer.nomineeId?.name ? `Nominee · ${customer.nomineeId.name}` : 'No nominee'}</small>
                        </span>
                      </td>
                      <td>{customer.customerCode}</td>
                      <td>{customer.userId?.phone ?? '—'}</td>
                      <td>{customer.address?.city || customer.address?.district || '—'}</td>
                      <td>
                        <Status value={customer.status} />
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
        title="Create customer"
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
            Creates a login account with an auto-generated passbook ID, optional Aadhaar images, and
            address / nominee details.
          </p>

          <div className="plan-modal-preview">
            <div>
              <small>Customer</small>
              <strong>{form.name || '—'}</strong>
              <em>Passbook ID auto-assigned</em>
            </div>
            <div>
              <small>Contact</small>
              <strong>{form.phone || '—'}</strong>
              <em>{form.city || form.district || 'Address optional'}</em>
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
              <div className="enroll-modal-date">
                <Phone />
                <input
                  className="form-control"
                  required
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
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
            <label>
              <span>Passbook ID</span>
              <input className="form-control" value="Auto-generated (000001…)" disabled readOnly />
            </label>
            <label className="full">
              <span>Address line</span>
              <input
                className="form-control"
                value={form.line1}
                onChange={(event) => setForm({ ...form, line1: event.target.value })}
              />
            </label>
            <label>
              <span>City</span>
              <input
                className="form-control"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </label>
            <label>
              <span>District</span>
              <input
                className="form-control"
                value={form.district}
                onChange={(event) => setForm({ ...form, district: event.target.value })}
              />
            </label>
            <label>
              <span>State</span>
              <input
                className="form-control"
                value={form.state}
                onChange={(event) => setForm({ ...form, state: event.target.value })}
              />
            </label>
            <label>
              <span>Postal code</span>
              <input
                className="form-control"
                value={form.postalCode}
                onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
              />
            </label>
            <AadhaarUploadFields
              frontKey={form.aadhaarFrontKey || undefined}
              backKey={form.aadhaarBackKey || undefined}
              disabled={create.isPending}
              onChange={({ frontKey, backKey }) =>
                setForm({
                  ...form,
                  aadhaarFrontKey: frontKey ?? '',
                  aadhaarBackKey: backKey ?? '',
                })
              }
            />
            <label>
              <span>Nominee name</span>
              <input
                className="form-control"
                value={form.nomineeName}
                onChange={(event) => setForm({ ...form, nomineeName: event.target.value })}
              />
            </label>
            <label>
              <span>Nominee relationship</span>
              <input
                className="form-control"
                value={form.nomineeRelationship}
                onChange={(event) => setForm({ ...form, nomineeRelationship: event.target.value })}
              />
            </label>
            <label>
              <span>Nominee phone</span>
              <input
                className="form-control"
                value={form.nomineePhone}
                onChange={(event) => setForm({ ...form, nomineePhone: event.target.value })}
              />
            </label>
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
              {create.isPending ? 'Creating…' : 'Create customer'}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
