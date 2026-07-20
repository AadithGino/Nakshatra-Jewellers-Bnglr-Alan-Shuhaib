import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck, UserRound, UsersRound, Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { Card, Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

const emptyForm = {
  name: '',
  phone: '',
  password: '',
  customerCode: '',
  line1: '',
  city: '',
  district: '',
  state: '',
  postalCode: '',
  nomineeName: '',
  nomineeRelationship: '',
  nomineePhone: '',
};

export function CustomerManagementPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [createOpen, setCreateOpen] = useState(params.get('action') === 'create');
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const list = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: () => api<any[]>(`/admin/customers?search=${encodeURIComponent(search)}`),
  });
  const create = useMutation({
    mutationFn: () =>
      api('/admin/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          password: form.password,
          customerCode: form.customerCode,
          address: {
            line1: form.line1 || undefined,
            city: form.city || undefined,
            district: form.district || undefined,
            state: form.state || undefined,
            postalCode: form.postalCode || undefined,
          },
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

  return (
    <Page
      title="Customer management"
      subtitle="Search accounts and open a complete customer workspace."
      actions={
        <button
          className="primary"
          onClick={() => {
            setError('');
            setCreateOpen(true);
          }}
        >
          <Plus /> Add customer
        </button>
      }
    >
      <Notice>{message}</Notice>
      <section className="management-overview">
        <article><span><UsersRound /></span><div><small>Total customers</small><strong>{list.data?.length ?? 0}</strong><p>Matching current view</p></div></article>
        <article><span><ShieldCheck /></span><div><small>Active accounts</small><strong>{list.data?.filter((item) => item.status === 'ACTIVE').length ?? 0}</strong><p>Verified for service</p></div></article>
        <article><span><UserRound /></span><div><small>Customer workspace</small><strong>360°</strong><p>Scheme, payment and payout records</p></div></article>
      </section>
      <Card>
        <div className="list-command-bar">
          <label className="admin-list-search"><Search /><input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone or customer ID"
          /></label>
          <span>{list.data?.length ?? 0} customer records</span>
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
                  <th>Customer ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((customer) => (
                  <tr key={customer._id}>
                    <td>{customer.customerCode}</td>
                    <td>{customer.userId?.name}</td>
                    <td>{customer.userId?.phone}</td>
                    <td>
                      <Status value={customer.status} />
                    </td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => navigate(`/admin/customers/${customer._id}`)}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </Card>
      <Modal title="Create customer" open={createOpen} onClose={() => setCreateOpen(false)}>
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
              ['password', 'Temporary password'],
              ['customerCode', 'Customer / passbook ID'],
              ['line1', 'Address line'],
              ['city', 'City'],
              ['district', 'District'],
              ['state', 'State'],
              ['postalCode', 'Postal code'],
              ['nomineeName', 'Nominee name'],
              ['nomineeRelationship', 'Nominee relationship'],
              ['nomineePhone', 'Nominee phone'],
            ].map(([key, label]) => (
              <label className={key === 'line1' ? 'full' : ''} key={key}>
                <span>{label}</span>
                <input
                  className="form-control"
                  type={key === 'password' ? 'password' : 'text'}
                  minLength={key === 'password' ? 10 : undefined}
                  required={['name', 'phone', 'password', 'customerCode'].includes(key)}
                  value={(form as any)[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create customer'}
          </button>
        </form>
      </Modal>
    </Page>
  );
}
