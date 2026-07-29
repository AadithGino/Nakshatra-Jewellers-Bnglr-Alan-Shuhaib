import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock3,
  ReceiptText,
  Search,
  Smartphone,
  Webhook,
} from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Page, QueryState, Status } from '../../../shared/components/ui';

const customerName = (row: any) => row.customerId?.userId?.name ?? row.customerId?.customerCode ?? '—';
const schemeLabel = (row: any) =>
  row.schemeId?.schemePlanId?.name ?? row.schemeId?.enrollmentNumber ?? '—';
const customerId = (row: any) => {
  const id = row.customerId?._id ?? row.customerId;
  return id ? String(id) : null;
};

export function PhonePeTransactionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const list = useQuery({
    queryKey: ['admin-phonepe-transactions'],
    queryFn: () => api<any[]>('/admin/phonepe-transactions'),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return list.data ?? [];
    return (list.data ?? []).filter((row) =>
      [
        row.merchantTransactionId,
        customerName(row),
        schemeLabel(row),
        row.status,
        row.webhookStatus,
        row.receiptStatus,
        row.receiptNumber,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [list.data, search]);

  const summary = useMemo(() => {
    const data = list.data ?? [];
    return {
      total: data.length,
      success: data.filter((row) => row.status === 'SUCCESS').length,
      pending: data.filter((row) => ['INITIATED', 'PENDING'].includes(row.status)).length,
      webhookPending: data.filter((row) => row.webhookStatus === 'NOT_RECEIVED').length,
    };
  }, [list.data]);

  return (
    <Page title="PhonePe transactions" subtitle="Online checkout intents, webhook status and receipts.">
      <div className="phonepe-page">
        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <Smartphone />
            </span>
            <div>
              <small>Total transactions</small>
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
              <Clock3 />
            </span>
            <div>
              <small>Pending</small>
              <strong>{summary.pending.toLocaleString('en-IN')}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Webhook />
            </span>
            <div>
              <small>Webhook pending</small>
              <strong>{summary.webhookPending.toLocaleString('en-IN')}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card">
          <div className="reports-table-head">
            <h2>Transaction ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search merchant ID, customer, scheme..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
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
                    <th>Merchant transaction</th>
                    <th>Customer</th>
                    <th>Scheme</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Webhook</th>
                    <th>Receipt</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row._id}
                      className="reports-clickable-row"
                      onClick={() => navigate(`/admin/phonepe-transactions/${row._id}`)}
                    >
                      <td>
                        <span className="reports-inline-link">{row.merchantTransactionId}</span>
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
                      <td>{schemeLabel(row)}</td>
                      <td>{money(row.amountPaise)}</td>
                      <td>
                        <Status value={row.status} />
                      </td>
                      <td>
                        <span className={`phonepe-pill ${row.webhookStatus?.toLowerCase()}`}>
                          {row.webhookStatus?.replaceAll('_', ' ') ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`phonepe-pill ${row.receiptStatus?.toLowerCase()}`}>
                          <ReceiptText />
                          {row.receiptStatus ?? '—'}
                        </span>
                      </td>
                      <td>{date(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </section>
      </div>
    </Page>
  );
}
