import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Plus,
  ReceiptText,
  Search,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

const PAGE_SIZE = 10;

const customerName = (row: any) =>
  row.customerId?.userId?.name ?? row.customerId?.customerCode ?? '—';
const schemeLabel = (row: any) =>
  row.schemeId?.schemePlanId?.name ?? row.schemeId?.enrollmentNumber ?? '—';
const customerId = (row: any) => {
  const id = row.customerId?._id ?? row.customerId;
  return id ? String(id) : null;
};
const methodLabel = (method?: string) => {
  if (method === 'CASH') return 'Cash';
  if (method === 'PHONEPE') return 'PhonePe';
  return method ?? '—';
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

export function PaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    schemeId: '',
    amountRupees: '',
    method: 'CASH',
    paymentDate: new Date().toISOString().slice(0, 16),
    referenceNumber: '',
    notes: '',
  });

  const list = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => api<any[]>('/admin/payments?limit=500'),
  });
  const customers = useQuery({
    queryKey: ['admin-payment-customers'],
    queryFn: () => api<any[]>('/admin/customers?limit=100'),
    enabled: createOpen,
  });
  const enrollments = useQuery({
    queryKey: ['admin-payment-enrollments'],
    queryFn: () => api<any[]>('/admin/enrollments?limit=100'),
    enabled: createOpen,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = list.data ?? [];
    if (!term) return rows;
    return rows.filter((row) =>
      [
        row.receiptNumber,
        customerName(row),
        schemeLabel(row),
        row.method,
        row.status,
        row.referenceNumber,
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
    const cash = data.filter((row) => row.method === 'CASH' && row.status === 'SUCCESS');
    const online = data.filter(
      (row) => row.method !== 'CASH' && row.status === 'SUCCESS',
    );
    return {
      total: data.length,
      success: data.filter((row) => row.status === 'SUCCESS').length,
      cashPaise: cash.reduce((sum, row) => sum + (row.amountPaise ?? 0), 0),
      onlinePaise: online.reduce((sum, row) => sum + (row.amountPaise ?? 0), 0),
    };
  }, [list.data]);

  const create = useMutation({
    mutationFn: () =>
      api('/admin/payments/manual', {
        method: 'POST',
        body: JSON.stringify({
          customerId: form.customerId,
          schemeId: form.schemeId,
          amountPaise: Math.round(Number(form.amountRupees) * 100),
          method: form.method,
          paymentDate: form.paymentDate,
          referenceNumber: form.referenceNumber || undefined,
          notes: form.notes || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setMessage('Payment recorded successfully.');
      setForm({
        customerId: '',
        schemeId: '',
        amountRupees: '',
        method: 'CASH',
        paymentDate: new Date().toISOString().slice(0, 16),
        referenceNumber: '',
        notes: '',
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to record payment.',
      ),
  });

  return (
    <Page
      title="Payments"
      subtitle="All collections with receipts, methods and customer links."
      actions={
        <button
          className="primary"
          onClick={() => {
            setError('');
            setCreateOpen(true);
          }}
        >
          <Plus /> Record payment
        </button>
      }
    >
      <Notice>{message}</Notice>
      <div className="phonepe-page">
        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <ReceiptText />
            </span>
            <div>
              <small>Total payments</small>
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
              <small>Cash collected</small>
              <strong>{money(summary.cashPaise)}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Globe />
            </span>
            <div>
              <small>Online collected</small>
              <strong>{money(summary.onlinePaise)}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card payments-ledger-card">
          <div className="reports-table-head">
            <h2>Payment ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search receipt, customer, scheme..."
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
              <table className="payments-ledger-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Scheme</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => (
                    <tr
                      key={row._id}
                      className="reports-clickable-row"
                      onClick={() => navigate(`/admin/payments/${row._id}`)}
                    >
                      <td>
                        <span className="reports-inline-link">
                          {row.receiptNumber ?? row.merchantTransactionId ?? '—'}
                        </span>
                      </td>
                      <td>{date(row.paymentDate)}</td>
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
                      <td>{schemeLabel(row)}</td>
                      <td>{methodLabel(row.method)}</td>
                      <td>{money(row.amountPaise)}</td>
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

      <Modal title="Record payment" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="form-grid">
            <label>
              <span>Customer</span>
              <select
                className="form-control"
                required
                value={form.customerId}
                onChange={(event) => setForm({ ...form, customerId: event.target.value })}
              >
                <option value="">Select customer</option>
                {(customers.data ?? []).map((customer: any) => (
                  <option value={customer._id} key={customer._id}>
                    {customer.customerCode} · {customer.userId?.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Enrollment</span>
              <select
                className="form-control"
                required
                value={form.schemeId}
                onChange={(event) => setForm({ ...form, schemeId: event.target.value })}
              >
                <option value="">Select enrollment</option>
                {(enrollments.data ?? []).map((enrollment: any) => (
                  <option value={enrollment._id} key={enrollment._id}>
                    {enrollment.enrollmentNumber} · {enrollment.schemeType}
                  </option>
                ))}
              </select>
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
              <span>Method</span>
              <select
                className="form-control"
                required
                value={form.method}
                onChange={(event) => setForm({ ...form, method: event.target.value })}
              >
                {['CASH', 'UPI', 'BANK', 'CARD'].map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Payment date</span>
              <input
                className="form-control"
                type="datetime-local"
                required
                value={form.paymentDate}
                onChange={(event) => setForm({ ...form, paymentDate: event.target.value })}
              />
            </label>
            <label>
              <span>Reference</span>
              <input
                className="form-control"
                value={form.referenceNumber}
                onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })}
              />
            </label>
            <label className="full">
              <span>Notes</span>
              <input
                className="form-control"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
          </div>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Confirm and save'}
          </button>
        </form>
      </Modal>
    </Page>
  );
}
