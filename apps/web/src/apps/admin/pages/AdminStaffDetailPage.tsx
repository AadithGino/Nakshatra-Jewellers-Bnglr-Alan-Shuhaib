import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Edit3,
  HandCoins,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import {
  currentMonthRange,
  eachDayInRange,
  formatReportDateRange,
  shortDayLabel,
} from '../../../shared/utils/reportDateRange';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { DateRangePicker } from '../components/ReportFilters';
import { permissionOptions } from './StaffManagementPage';

const permissionLabel = (permission: string) =>
  permission.replace('can', '').replaceAll(/([A-Z])/g, ' $1').trim();

const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
};

const customerName = (payment: any) =>
  payment?.customerId?.userId?.name ?? payment?.customerId?.customerCode ?? '—';

function initials(name?: string) {
  if (!name) return '—';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function StaffDailyChart({
  from,
  to,
  daily,
}: {
  from: string;
  to: string;
  daily: { date: string; totalPaise: number; count: number }[];
}) {
  const days = eachDayInRange(from, to);
  const byDate = new Map(daily.map((row) => [row.date, row]));
  const values = days.map((day) => byDate.get(day)?.totalPaise ?? 0);
  const max = Math.max(...values, 1);

  if (!days.length) {
    return (
      <div className="staff-daily-chart empty">
        <p>Select a date range to view collections.</p>
      </div>
    );
  }

  return (
    <div className="staff-daily-chart">
      <div className="staff-daily-chart-y">
        <span>{money(max)}</span>
        <span>{money(Math.round(max / 2))}</span>
        <span>₹0</span>
      </div>
      <div className="staff-daily-chart-body">
        <div className="staff-daily-bars">
          {days.map((day, index) => {
            const value = values[index] ?? 0;
            const height = Math.max(value ? (value / max) * 100 : 0, value ? 4 : 0);
            return (
              <div key={day} className="staff-daily-bar" title={`${shortDayLabel(day)} · ${money(value)}`}>
                <i style={{ height: `${height}%` }} />
                {(days.length <= 14 || index % Math.ceil(days.length / 8) === 0) && (
                  <small>{shortDayLabel(day)}</small>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AdminStaffDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(() => currentMonthRange()[0]);
  const [to, setTo] = useState(() => currentMonthRange()[1]);
  const [modal, setModal] = useState<'edit' | 'cash' | 'password' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [edit, setEdit] = useState({
    name: '',
    phone: '',
    employeeCode: '',
    permissions: [] as string[],
    notes: '',
  });
  const [cash, setCash] = useState({
    amountRupees: '',
    submissionDate: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  const details = useQuery({
    queryKey: ['admin-staff-detail', id, from, to],
    queryFn: () => api<any>(`/admin/staff/${id}?from=${from}&to=${to}`),
    enabled: Boolean(id && from && to),
  });

  const profile = details.data?.profile;
  const report = details.data?.report;
  const payments = details.data?.payments ?? [];
  const submissions = details.data?.submissions ?? [];
  const corrections = details.data?.corrections ?? [];
  const userId = String(profile?.userId?._id ?? profile?.userId ?? '');
  const lifetimeCash = report?.lifetimeCashWithStaffPaise ?? 0;

  const refresh = async () => {
    await details.refetch();
    await queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
  };

  const handleError = (requestError: unknown) =>
    setError(
      requestError instanceof ApiError ? requestError.message : 'Action could not be completed.',
    );

  const update = useMutation({
    mutationFn: () => api(`/admin/staff/${id}`, { method: 'PATCH', body: JSON.stringify(edit) }),
    onSuccess: async () => {
      setModal(null);
      setMessage('Staff details and permissions updated.');
      await refresh();
    },
    onError: handleError,
  });

  const status = useMutation({
    mutationFn: (nextStatus: 'ACTIVE' | 'INACTIVE') =>
      api(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      }),
    onSuccess: async () => {
      setMessage('Account status updated and sessions invalidated.');
      await refresh();
    },
    onError: handleError,
  });

  const resetPassword = useMutation({
    mutationFn: () =>
      api(`/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: password }),
      }),
    onSuccess: () => {
      setModal(null);
      setPassword('');
      setMessage('Password reset and existing sessions invalidated.');
    },
    onError: handleError,
  });

  const submitCash = useMutation({
    mutationFn: () =>
      api('/admin/cash-submissions', {
        method: 'POST',
        body: JSON.stringify({
          staffId: userId,
          amountPaise: Math.round(Number(cash.amountRupees) * 100),
          submissionDate: cash.submissionDate,
          notes: cash.notes || undefined,
        }),
      }),
    onSuccess: async () => {
      setModal(null);
      setCash({
        amountRupees: '',
        submissionDate: new Date().toISOString().slice(0, 16),
        notes: '',
      });
      setMessage('Staff cash submission recorded.');
      await refresh();
    },
    onError: handleError,
  });

  const openEdit = () => {
    setEdit({
      name: profile?.userId?.name ?? '',
      phone: profile?.userId?.phone ?? '',
      employeeCode: profile?.employeeCode ?? '',
      permissions: profile?.permissions ?? [],
      notes: profile?.notes ?? '',
    });
    setError('');
    setModal('edit');
  };

  const openCash = () => {
    setError('');
    setCash({
      amountRupees: lifetimeCash ? String(lifetimeCash / 100) : '',
      submissionDate: new Date().toISOString().slice(0, 16),
      notes: '',
    });
    setModal('cash');
  };

  const openPassword = () => {
    setError('');
    setPassword('');
    setModal('password');
  };

  const togglePermission = (permission: string) =>
    setEdit((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));

  const closeModal = () => {
    if (update.isPending || submitCash.isPending || resetPassword.isPending) return;
    setModal(null);
  };

  const methodSplit = useMemo(() => {
    const total = report?.collectionPaise ?? 0;
    if (!total) return { cash: 0, other: 0 };
    return {
      cash: Math.round(((report?.cashCollectedPaise ?? 0) / total) * 100),
      other: Math.round(((report?.otherCollectedPaise ?? 0) / total) * 100),
    };
  }, [report]);
  const methodAmount = (method: string) =>
    report?.byMethod?.find((row: any) => row.method === method)?.totalPaise ?? 0;
  const methodCount = (method: string) =>
    report?.byMethod?.find((row: any) => row.method === method)?.count ?? 0;

  return (
    <Page
      title="Staff"
      actions={
        <div className="customer-page-actions">
          <button className="secondary" onClick={() => navigate('/admin/staff')}>
            <ArrowLeft /> Back
          </button>
          {profile && (
            <>
              <button type="button" className="secondary" onClick={openEdit}>
                <Edit3 /> Edit
              </button>
              <button
                type="button"
                className="secondary"
                disabled={status.isPending}
                onClick={() =>
                  status.mutate(profile.userId?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
                }
              >
                <ShieldCheck />
                {profile.userId?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
              <button type="button" className="secondary" onClick={openPassword}>
                <KeyRound /> Password
              </button>
              <button
                type="button"
                className="primary"
                disabled={lifetimeCash <= 0}
                onClick={openCash}
              >
                <HandCoins /> Record cash
              </button>
            </>
          )}
        </div>
      }
    >
      <Notice>{message}</Notice>
      {modal === null && <Notice error>{error}</Notice>}
      <QueryState
        loading={details.isLoading}
        error={details.error}
        empty={!details.isLoading && !profile}
        retry={() => void details.refetch()}
      >
        {profile && report && (
          <div className="staff-detail-page">
            <section className="phonepe-detail-hero">
              <div className="phonepe-brand-badge payment customer-detail-avatar-badge">
                {initials(profile.userId?.name)}
              </div>
              <div className="phonepe-detail-main">
                <div className="phonepe-detail-title-row">
                  <h2>{profile.userId?.name}</h2>
                  <div className="phonepe-detail-badges">
                    <Status value={profile.userId?.status ?? 'INACTIVE'} />
                    <span className="phonepe-pill">{profile.employeeCode}</span>
                  </div>
                </div>
                <p>
                  {profile.userId?.phone}
                  {profile.permissions?.length
                    ? ` · ${profile.permissions.length} permission${profile.permissions.length === 1 ? '' : 's'}`
                    : ' · No permissions'}
                  {profile.userId?.lastLoginAt
                    ? ` · Last login ${date(profile.userId.lastLoginAt)}`
                    : ' · Never logged in'}
                </p>
              </div>
            </section>

            <section className="reports-toolbar staff-detail-toolbar">
              <div className="reports-toolbar-main">
                <DateRangePicker
                  from={from}
                  to={to}
                  onChange={(nextFrom, nextTo) => {
                    setFrom(nextFrom);
                    setTo(nextTo);
                  }}
                />
                <span className="staff-detail-range-label">
                  Showing {formatReportDateRange(from, to)}
                </span>
              </div>
              <div className="staff-detail-cash-chip">
                <Banknote />
                <div>
                  <small>Cash outstanding</small>
                  <b>{money(lifetimeCash)}</b>
                </div>
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-facts-row">
                <div className="phonepe-fact">
                  <small>Total collected</small>
                  <b>{money(report.collectionPaise)}</b>
                </div>
                <div className="phonepe-fact">
                  <small>Payments</small>
                  <b>{(report.paymentCount ?? 0).toLocaleString('en-IN')}</b>
                </div>
                <div className="phonepe-fact">
                  <small>Cash collected</small>
                  <b>{money(report.cashCollectedPaise)}</b>
                </div>
                <div className="phonepe-fact">
                  <small>Cash submitted</small>
                  <b>{money(report.cashSubmittedPaise)}</b>
                </div>
                <div className="phonepe-fact">
                  <small>Other methods</small>
                  <b>{money(report.otherCollectedPaise)}</b>
                </div>
                <div className="phonepe-fact">
                  <small>Period cash gap</small>
                  <b>{money(report.cashWithStaffPaise)}</b>
                </div>
              </div>
            </section>

            <section className="phonepe-panel staff-chart-panel">
              <div className="phonepe-panel-head">
                <h2>Daily collections</h2>
                <small>
                  {methodSplit.cash}% cash
                  {methodSplit.other ? ` · ${methodSplit.other}% other` : ''}
                </small>
              </div>
              <StaffDailyChart from={from} to={to} daily={report.daily ?? []} />
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Payment type split</h2>
              </div>
              <div className="phonepe-facts-row">
                {(['CASH', 'UPI', 'BANK', 'CARD'] as const).map((method) => (
                  <div className="phonepe-fact" key={method}>
                    <small>{method}</small>
                    <b>{money(methodAmount(method))}</b>
                    <em>{methodCount(method)} payments</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="reports-table-card">
              <div className="reports-table-head">
                <h2>Collections in range</h2>
                <small>{payments.length} payments</small>
              </div>
              <QueryState loading={false} error={null} empty={!payments.length}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment: any) => (
                        <tr
                          key={payment._id}
                          className="reports-clickable-row"
                          onClick={() => navigate(`/admin/payments/${payment._id}`)}
                        >
                          <td>
                            <b className="reports-inline-link">
                              {payment.receiptNumber ?? payment._id.slice(-6)}
                            </b>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="reports-cell-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                const customer = resolveId(payment.customerId);
                                if (customer) navigate(`/admin/customers/${customer}`);
                              }}
                            >
                              {customerName(payment)}
                            </button>
                          </td>
                          <td>{date(payment.paymentDate)}</td>
                          <td>
                            <span className="staff-method-cell">
                              <Banknote />
                              {payment.method ?? '—'}
                            </span>
                          </td>
                          <td>{money(payment.amountPaise)}</td>
                          <td>
                            <Status value={payment.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </section>

            <section className="reports-table-card">
              <div className="reports-table-head">
                <h2>Cash submissions</h2>
                <small>{submissions.length} records</small>
              </div>
              <QueryState loading={false} error={null} empty={!submissions.length}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Notes</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((item: any) => (
                        <tr key={item._id}>
                          <td>{date(item.submissionDate)}</td>
                          <td>{money(item.amountPaise)}</td>
                          <td>{item.notes || '—'}</td>
                          <td>
                            <Status value={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </section>

            <section className="reports-table-card">
              <div className="reports-table-head">
                <h2>Correction requests</h2>
              </div>
              <QueryState loading={false} error={null} empty={!corrections.length}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Reason</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corrections.map((item: any) => (
                        <tr key={item._id}>
                          <td>{String(item.correctionType ?? '—').replaceAll('_', ' ')}</td>
                          <td>{item.reason || '—'}</td>
                          <td>
                            <Status value={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </section>

            {(profile.permissions?.length > 0 || profile.notes) && (
              <section className="phonepe-panel">
                <div className="phonepe-panel-head">
                  <h2>Access & notes</h2>
                </div>
                <div className="staff-access-block">
                  <div className="staff-permission-pills">
                    {(profile.permissions ?? []).map((permission: string) => (
                      <span key={permission} className="phonepe-pill">
                        {permissionLabel(permission)}
                      </span>
                    ))}
                    {!profile.permissions?.length && <span className="helper">No permissions</span>}
                  </div>
                  {profile.notes ? <p className="scheme-admin-copy">{profile.notes}</p> : null}
                </div>
              </section>
            )}
          </div>
        )}
      </QueryState>

      <Modal title="Edit staff" open={modal === 'edit'} onClose={closeModal}>
        <form
          className="plan-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            update.mutate();
          }}
        >
          <p className="plan-modal-lead">
            Updates profile details and collection permissions for this staff account.
          </p>
          <div className="plan-modal-fields">
            <label>
              <span>Name</span>
              <input
                className="form-control"
                required
                value={edit.name}
                onChange={(event) => setEdit({ ...edit, name: event.target.value })}
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                className="form-control"
                required
                value={edit.phone}
                onChange={(event) => setEdit({ ...edit, phone: event.target.value })}
              />
            </label>
            <label className="full">
              <span>Employee code</span>
              <input
                className="form-control"
                required
                value={edit.employeeCode}
                onChange={(event) => setEdit({ ...edit, employeeCode: event.target.value })}
              />
            </label>
            <label className="full">
              <span>Notes</span>
              <textarea
                className="form-control"
                rows={2}
                value={edit.notes}
                onChange={(event) => setEdit({ ...edit, notes: event.target.value })}
              />
            </label>
            <div className="full staff-permission-grid">
              <span>Permissions</span>
              <div className="check-grid">
                {permissionOptions.map((permission) => (
                  <label key={permission}>
                    <input
                      type="checkbox"
                      checked={edit.permissions.includes(permission)}
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
            <button type="button" className="secondary" disabled={update.isPending} onClick={closeModal}>
              Cancel
            </button>
            <button className="primary" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Record cash submission" open={modal === 'cash'} onClose={closeModal}>
        <form
          className="settle-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            submitCash.mutate();
          }}
        >
          <p className="settle-modal-lead">
            {profile?.userId?.name} · Outstanding cash {money(lifetimeCash)}
          </p>
          <div className="settle-modal-result">
            <div>
              <small>Available</small>
              <strong>{money(lifetimeCash)}</strong>
              <em>Lifetime cash with staff</em>
            </div>
            <div>
              <small>Receiving now</small>
              <strong>
                {cash.amountRupees ? money(Math.round(Number(cash.amountRupees) * 100)) : '—'}
              </strong>
              <em>Into office cash</em>
            </div>
          </div>
          <div className="settle-modal-fields">
            <label>
              <span>Amount received ₹</span>
              <input
                className="form-control"
                type="number"
                min="0.01"
                max={lifetimeCash / 100}
                step="0.01"
                required
                value={cash.amountRupees}
                onChange={(event) => setCash({ ...cash, amountRupees: event.target.value })}
              />
            </label>
            <label>
              <span>Submission date</span>
              <div className="enroll-modal-date">
                <CalendarDays />
                <input
                  className="form-control"
                  type="datetime-local"
                  required
                  value={cash.submissionDate}
                  onChange={(event) => setCash({ ...cash, submissionDate: event.target.value })}
                />
              </div>
            </label>
            <label className="full">
              <span>Notes</span>
              <input
                className="form-control"
                placeholder="Optional note"
                value={cash.notes}
                onChange={(event) => setCash({ ...cash, notes: event.target.value })}
              />
            </label>
          </div>
          <Notice error>{error}</Notice>
          <div className="settle-modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={submitCash.isPending}
              onClick={closeModal}
            >
              Cancel
            </button>
            <button className="primary" disabled={submitCash.isPending || lifetimeCash <= 0}>
              {submitCash.isPending ? 'Recording…' : 'Confirm cash received'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Reset password" open={modal === 'password'} onClose={closeModal}>
        <form
          className="settle-modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            if (password.length < 10) {
              setError('Password must be at least 10 characters.');
              return;
            }
            resetPassword.mutate();
          }}
        >
          <p className="settle-modal-lead">
            Sets a temporary password for {profile?.userId?.name ?? 'this staff member'} and signs
            out all sessions.
          </p>
          <div className="settle-modal-fields">
            <label className="full">
              <span>New password</span>
              <div className="enroll-modal-date">
                <KeyRound />
                <input
                  className="form-control"
                  type="password"
                  minLength={10}
                  required
                  placeholder="Minimum 10 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>
          </div>
          <Notice error>{error}</Notice>
          <div className="settle-modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={resetPassword.isPending}
              onClick={closeModal}
            >
              Cancel
            </button>
            <button className="primary" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
