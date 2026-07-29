import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Plus,
  Search,
  UserRound,
  Wallet,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { AdminSelect } from '../components/AdminSelect';

const PAGE_SIZE = 12;

const staffName = (row: any) => row.staffId?.name ?? '—';
const staffPhone = (row: any) => row.staffId?.phone ?? '—';
const staffCode = (row: any) => row.employeeCode ?? '—';

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

export function CashSubmissionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    staffId: '',
    amountRupees: '',
    submissionDate: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  const list = useQuery({
    queryKey: ['admin-cash-submissions'],
    queryFn: () => api<any[]>('/admin/cash-submissions'),
  });

  const staff = useQuery({
    queryKey: ['operation-staff'],
    queryFn: () => api<any[]>('/admin/staff?limit=100'),
    enabled: createOpen,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = list.data ?? [];
    if (!term) return rows;
    return rows.filter((row) =>
      [
        staffName(row),
        staffPhone(row),
        staffCode(row),
        row.status,
        row.notes,
        row.receivedBy?.name,
        row._id,
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
    const success = data.filter((row) => row.status === 'SUCCESS');
    const staffSet = new Set(
      success.map((row) => String(row.staffId?._id ?? row.staffId ?? '')).filter(Boolean),
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPaise = success
      .filter((row) => new Date(row.submissionDate) >= today)
      .reduce((sum, row) => sum + (row.amountPaise ?? 0), 0);
    return {
      total: data.length,
      success: success.length,
      amountPaise: success.reduce((sum, row) => sum + (row.amountPaise ?? 0), 0),
      staffCount: staffSet.size,
      todayPaise,
    };
  }, [list.data]);

  const staffOptions = useMemo(
    () =>
      (staff.data ?? []).map((row: any) => ({
        value: String(row.userId?._id ?? row.userId ?? ''),
        label: row.userId?.name ?? row.employeeCode ?? 'Staff',
        hint: [row.employeeCode, row.userId?.phone].filter(Boolean).join(' · '),
      })),
    [staff.data],
  );

  const create = useMutation({
    mutationFn: () =>
      api('/admin/cash-submissions', {
        method: 'POST',
        body: JSON.stringify({
          staffId: form.staffId,
          amountPaise: Math.round(Number(form.amountRupees) * 100),
          submissionDate: form.submissionDate,
          notes: form.notes.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setMessage('Cash submission recorded.');
      setError('');
      setForm({
        staffId: '',
        amountRupees: '',
        submissionDate: new Date().toISOString().slice(0, 16),
        notes: '',
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-cash-submissions'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to record submission.',
      ),
  });

  const openCreate = () => {
    setError('');
    setForm({
      staffId: '',
      amountRupees: '',
      submissionDate: new Date().toISOString().slice(0, 16),
      notes: '',
    });
    setCreateOpen(true);
  };

  return (
    <Page
      title="Cash submissions"
      subtitle="Staff handovers of collected cash into the business till."
      actions={
        <button type="button" className="primary" onClick={openCreate}>
          <Plus /> Record submission
        </button>
      }
    >
      <Notice>{message}</Notice>
      <div className="cash-submissions-page">
        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <HandCoins />
            </span>
            <div>
              <small>Total submissions</small>
              <strong>{summary.total.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi success">
            <span>
              <CheckCircle2 />
            </span>
            <div>
              <small>Successful</small>
              <strong>{summary.success.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Banknote />
            </span>
            <div>
              <small>Cash received</small>
              <strong>{money(summary.amountPaise)}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Wallet />
            </span>
            <div>
              <small>Today</small>
              <strong>{money(summary.todayPaise)}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card">
          <div className="reports-table-head">
            <h2>Submission ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search staff, code, notes..."
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
                    <th>Date</th>
                    <th>Staff</th>
                    <th>Amount</th>
                    <th>Received by</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => {
                    const profileId = row.staffProfileId ? String(row.staffProfileId) : null;
                    return (
                      <tr
                        key={row._id}
                        className="reports-clickable-row"
                        onClick={() => navigate(`/admin/cash-submissions/${row._id}`)}
                      >
                        <td>{date(row.submissionDate)}</td>
                        <td>
                          <button
                            type="button"
                            className="reports-cell-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (profileId) navigate(`/admin/staff/${profileId}`);
                            }}
                          >
                            <span className="scheme-admin-name-cell">
                              <b>{staffName(row)}</b>
                              <small>
                                {staffCode(row)} · {staffPhone(row)}
                              </small>
                            </span>
                          </button>
                        </td>
                        <td>{money(row.amountPaise)}</td>
                        <td>{row.receivedBy?.name ?? '—'}</td>
                        <td>
                          <Status value={row.status} />
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

      <Modal title="Record cash submission" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          className="settle-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            create.mutate();
          }}
        >
          <p className="settle-modal-lead">
            Deducts from the staff cash balance and records handover into the till.
          </p>

          <div className="plan-modal-preview">
            <div>
              <small>Staff selected</small>
              <strong>
                {staffOptions.find((option) => option.value === form.staffId)?.label ?? '—'}
              </strong>
              <em>
                {staffOptions.find((option) => option.value === form.staffId)?.hint ??
                  `${summary.staffCount} staff with history`}
              </em>
            </div>
            <div>
              <small>Amount</small>
              <strong>
                {form.amountRupees
                  ? `₹${Number(form.amountRupees).toLocaleString('en-IN')}`
                  : '—'}
              </strong>
              <em>{date(form.submissionDate)}</em>
            </div>
          </div>

          <div className="plan-modal-fields">
            <label className="full">
              <span>Staff</span>
              <AdminSelect
                icon={<UserRound />}
                value={form.staffId}
                options={staffOptions}
                placeholder="Select staff"
                required
                onChange={(value) => setForm({ ...form, staffId: value })}
              />
            </label>
            <label>
              <span>Amount ₹</span>
              <input
                className="form-control"
                type="number"
                min="1"
                step="0.01"
                required
                value={form.amountRupees}
                onChange={(event) => setForm({ ...form, amountRupees: event.target.value })}
              />
            </label>
            <label>
              <span>Submission date</span>
              <input
                className="form-control"
                type="datetime-local"
                required
                value={form.submissionDate}
                onChange={(event) => setForm({ ...form, submissionDate: event.target.value })}
              />
            </label>
            <label className="full">
              <span>Notes</span>
              <textarea
                className="form-control"
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Optional handover note"
              />
            </label>
          </div>

          <Notice error>{error}</Notice>
          <button className="primary" disabled={create.isPending}>
            {create.isPending ? 'Recording…' : 'Confirm submission'}
          </button>
        </form>
      </Modal>
    </Page>
  );
}
