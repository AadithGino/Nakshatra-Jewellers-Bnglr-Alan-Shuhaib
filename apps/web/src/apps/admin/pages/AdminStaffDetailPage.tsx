import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit3, HandCoins, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import {
  Card,
  Metric,
  Modal,
  Notice,
  Page,
  QueryState,
  Status,
} from '../../../shared/components/ui';
import { permissionOptions } from './StaffManagementPage';

export function AdminStaffDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'edit' | 'cash' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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
    queryKey: ['admin-staff-detail', id],
    queryFn: () => api<any>(`/admin/staff/${id}`),
    enabled: Boolean(id),
  });
  const profile = details.data?.profile;
  const userId = String(profile?.userId?._id ?? profile?.userId ?? '');
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
    mutationFn: (newPassword: string) =>
      api(`/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }),
    onSuccess: () => setMessage('Password reset and existing sessions invalidated.'),
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
  const togglePermission = (permission: string) =>
    setEdit((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));

  return (
    <Page
      title={profile?.userId?.name ?? 'Staff detail'}
      subtitle={
        profile
          ? `${profile.employeeCode} · ${profile.userId?.phone}`
          : 'Staff operations workspace'
      }
      actions={
        <button className="secondary" onClick={() => navigate('/admin/staff')}>
          <ArrowLeft /> Staff
        </button>
      }
    >
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <QueryState
        loading={details.isLoading}
        error={details.error}
        retry={() => void details.refetch()}
      >
        {profile && (
          <div className="stack">
            <Card className="stack admin-entity-hero staff-entity-hero">
              <div className="toolbar">
                <div>
                  <h2>{profile.userId?.name}</h2>
                  <p>
                    {profile.employeeCode} · <Status value={profile.userId?.status} />
                  </p>
                </div>
                <div className="actions">
                  <button className="secondary" onClick={openEdit}>
                    <Edit3 /> Edit
                  </button>
                  <button
                    className="secondary"
                    disabled={status.isPending}
                    onClick={() =>
                      status.mutate(profile.userId?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
                    }
                  >
                    <ShieldCheck />{' '}
                    {profile.userId?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="primary"
                    disabled={(details.data.report?.cashWithStaffPaise ?? 0) <= 0}
                    onClick={() => {
                      setError('');
                      setModal('cash');
                    }}
                  >
                    <HandCoins /> Record cash submission
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      const value = window.prompt('New password (minimum 10 characters)');
                      if (value) resetPassword.mutate(value);
                    }}
                  >
                    Reset password
                  </button>
                </div>
              </div>
              <div className="metrics">
                <Metric
                  label="Total collection"
                  value={money(details.data.report?.collectionPaise)}
                />
                <Metric
                  label="Cash collected"
                  value={money(details.data.report?.cashCollectedPaise)}
                />
                <Metric
                  label="Cash submitted"
                  value={money(details.data.report?.cashSubmittedPaise)}
                />
                <Metric
                  label="Cash pending"
                  value={money(details.data.report?.cashWithStaffPaise)}
                />
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <small>Last login</small>
                  <b>{profile.userId?.lastLoginAt ? date(profile.userId.lastLoginAt) : 'Never'}</b>
                </div>
                <div className="detail-item">
                  <small>Permissions</small>
                  <b>
                    {profile.permissions
                      ?.map((item: string) => item.replace('can', ''))
                      .join(', ') || 'None'}
                  </b>
                </div>
                <div className="detail-item">
                  <small>Notes</small>
                  <b>{profile.notes || '—'}</b>
                </div>
              </div>
            </Card>
            <Card title="Recent payments" className="admin-detail-section">
              {details.data.payments?.length ? (
                details.data.payments.map((payment: any) => (
                  <div className="list-row" key={payment._id}>
                    <div>
                      <b>{payment.receiptNumber}</b>
                      <small>
                        {date(payment.paymentDate)} · {payment.method}
                      </small>
                    </div>
                    <div>
                      <strong>{money(payment.amountPaise)}</strong>
                      <Status value={payment.status} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="helper">No collections yet.</p>
              )}
            </Card>
            <Card title="Cash submission history" className="admin-detail-section">
              {details.data.submissions?.length ? (
                details.data.submissions.map((item: any) => (
                  <div className="list-row" key={item._id}>
                    <div>
                      <b>{date(item.submissionDate)}</b>
                      <small>{item.notes || 'Received by admin'}</small>
                    </div>
                    <div>
                      <strong>{money(item.amountPaise)}</strong>
                      <Status value={item.status} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="helper">No cash submissions yet.</p>
              )}
            </Card>
            <Card title="Correction requests" className="admin-detail-section">
              {details.data.corrections?.length ? (
                details.data.corrections.map((item: any) => (
                  <div className="list-row" key={item._id}>
                    <div>
                      <b>{item.correctionType.replaceAll('_', ' ')}</b>
                      <small>{item.reason}</small>
                    </div>
                    <Status value={item.status} />
                  </div>
                ))
              ) : (
                <p className="helper">No correction requests.</p>
              )}
            </Card>
          </div>
        )}
      </QueryState>
      <Modal title="Edit staff" open={modal === 'edit'} onClose={() => setModal(null)}>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            update.mutate();
          }}
        >
          <div className="form-grid">
            {[
              ['name', 'Name'],
              ['phone', 'Phone'],
              ['employeeCode', 'Employee code'],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  className="form-control"
                  required
                  value={(edit as any)[key]}
                  onChange={(event) => setEdit({ ...edit, [key]: event.target.value })}
                />
              </label>
            ))}
            <label className="full">
              <span>Notes</span>
              <textarea
                className="form-control"
                value={edit.notes}
                onChange={(event) => setEdit({ ...edit, notes: event.target.value })}
              />
            </label>
          </div>
          <span>Permissions</span>
          <div className="check-grid">
            {permissionOptions.map((permission) => (
              <label key={permission}>
                <input
                  type="checkbox"
                  checked={edit.permissions.includes(permission)}
                  onChange={() => togglePermission(permission)}
                />{' '}
                {permission.replace('can', '').replaceAll(/([A-Z])/g, ' $1')}
              </label>
            ))}
          </div>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={update.isPending}>
            Save staff
          </button>
        </form>
      </Modal>
      <Modal
        title="Record staff cash submission"
        open={modal === 'cash'}
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            submitCash.mutate();
          }}
        >
          <div className="detail-item">
            <small>Maximum available cash</small>
            <b>{money(details.data?.report?.cashWithStaffPaise)}</b>
          </div>
          <label>
            <span>Amount received ₹</span>
            <input
              className="form-control"
              type="number"
              min="0.01"
              max={(details.data?.report?.cashWithStaffPaise ?? 0) / 100}
              step="0.01"
              required
              value={cash.amountRupees}
              onChange={(event) => setCash({ ...cash, amountRupees: event.target.value })}
            />
          </label>
          <label>
            <span>Submission date and time</span>
            <input
              className="form-control"
              type="datetime-local"
              required
              value={cash.submissionDate}
              onChange={(event) => setCash({ ...cash, submissionDate: event.target.value })}
            />
          </label>
          <label>
            <span>Notes</span>
            <textarea
              className="form-control"
              value={cash.notes}
              onChange={(event) => setCash({ ...cash, notes: event.target.value })}
            />
          </label>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={submitCash.isPending}>
            Confirm cash received
          </button>
        </form>
      </Modal>
    </Page>
  );
}
