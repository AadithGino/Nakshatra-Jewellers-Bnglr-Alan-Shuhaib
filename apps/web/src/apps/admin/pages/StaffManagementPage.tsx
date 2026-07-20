import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { Card, Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

// Shared with the staff detail workspace.
// eslint-disable-next-line react-refresh/only-export-components
export const permissionOptions = [
  'canCreateCustomer',
  'canEnrollScheme',
  'canCollectPayment',
  'canViewCustomers',
  'canSubmitCorrectionRequest',
];
const emptyForm = {
  name: '',
  phone: '',
  password: '',
  employeeCode: '',
  permissions: [] as string[],
  notes: '',
};

export function StaffManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const list = useQuery({
    queryKey: ['admin-staff', search],
    queryFn: () => api<any[]>(`/admin/staff?search=${encodeURIComponent(search)}`),
  });
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

  return (
    <Page
      title="Staff management"
      subtitle="Search staff and open a dedicated collection and cash workspace."
      actions={
        <button className="primary" onClick={() => setCreateOpen(true)}>
          <Plus /> Add staff
        </button>
      }
    >
      <Notice>{message}</Notice>
      <section className="management-overview">
        <article><span><UsersRound /></span><div><small>Total staff</small><strong>{list.data?.length ?? 0}</strong><p>All registered employees</p></div></article>
        <article><span><BadgeCheck /></span><div><small>Active staff</small><strong>{list.data?.filter((item) => item.status === 'ACTIVE' || item.userId?.status === 'ACTIVE').length ?? 0}</strong><p>Enabled accounts</p></div></article>
        <article><span><ShieldCheck /></span><div><small>Access control</small><strong>Role based</strong><p>Permission-level safeguards</p></div></article>
      </section>
      <Card>
        <div className="toolbar">
          <input
            className="search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone or employee code"
          />
          <span>{list.data?.length ?? 0} records</span>
        </div>
        <QueryState
          loading={list.isLoading}
          error={list.error}
          empty={!list.isLoading && !list.data?.length}
          retry={() => void list.refetch()}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((staff) => (
                  <tr key={staff._id}>
                    <td>{staff.employeeCode}</td>
                    <td>{staff.userId?.name}</td>
                    <td>{staff.userId?.phone}</td>
                    <td>
                      <Status value={staff.userId?.status ?? 'INACTIVE'} />
                    </td>
                    <td>{staff.permissions?.length ?? 0}</td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => navigate(`/admin/staff/${staff._id}`)}
                      >
                        Open staff
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </Card>
      <Modal title="Create staff account" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            create.mutate();
          }}
        >
          <div className="form-grid">
            {[
              ['name', 'Name'],
              ['phone', 'Phone'],
              ['employeeCode', 'Employee code'],
              ['password', 'Temporary password'],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  className="form-control"
                  type={key === 'password' ? 'password' : 'text'}
                  minLength={key === 'password' ? 10 : undefined}
                  required
                  value={(form as any)[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                />
              </label>
            ))}
            <label className="full">
              <span>Notes</span>
              <textarea
                className="form-control"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
          </div>
          <span>Permissions</span>
          <div className="check-grid">
            {permissionOptions.map((permission) => (
              <label key={permission}>
                <input
                  type="checkbox"
                  checked={form.permissions.includes(permission)}
                  onChange={() => togglePermission(permission)}
                />{' '}
                {permission.replace('can', '').replaceAll(/([A-Z])/g, ' $1')}
              </label>
            ))}
          </div>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create staff'}
          </button>
        </form>
      </Modal>
    </Page>
  );
}
