import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gem,
  HandCoins,
  Search,
} from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { Page, QueryState, Status } from '../../../shared/components/ui';

const PAGE_SIZE = 12;

const customerName = (row: any) =>
  row.customerId?.userId?.name ?? row.customerId?.customerCode ?? '—';
const customerPhone = (row: any) => row.customerId?.userId?.phone ?? '—';
const schemeLabel = (row: any) =>
  row.schemeId?.schemePlanId?.name ?? row.schemeId?.enrollmentNumber ?? '—';
const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
};
const payoutTypeLabel = (type?: string) =>
  type === 'REDEEM' ? 'Redeem gold' : type === 'PAYOUT' ? 'Payout amount' : (type ?? '—');
const methodLabel = (method?: string) => {
  if (method === 'CASH') return 'Cash';
  if (method === 'UPI') return 'UPI';
  if (method === 'BANK') return 'Bank';
  if (method === 'GOLD') return 'Gold';
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

export function PayoutsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => api<any[]>('/admin/payouts'),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = list.data ?? [];
    if (!term) return rows;
    return rows.filter((row) =>
      [
        customerName(row),
        customerPhone(row),
        schemeLabel(row),
        row.schemeId?.enrollmentNumber,
        row.payoutType,
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
    const success = data.filter((row) => row.status === 'SUCCESS');
    return {
      total: data.length,
      success: success.length,
      amountPaise: success.reduce((sum, row) => sum + (row.amountPaise ?? 0), 0),
      goldMg: success.reduce((sum, row) => sum + (row.goldWeightMg ?? 0), 0),
    };
  }, [list.data]);

  return (
    <Page
      title="Payouts"
      subtitle="Redeem and payout settlements across matured and completed schemes."
    >
      <div className="payouts-page">
        <div className="reports-kpi-grid">
          <article className="dashboard-kpi">
            <span>
              <HandCoins />
            </span>
            <div>
              <small>Total settlements</small>
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
              <small>Amount settled</small>
              <strong>{money(summary.amountPaise)}</strong>
            </div>
          </article>
          <article className="dashboard-kpi">
            <span>
              <Gem />
            </span>
            <div>
              <small>Gold redeemed</small>
              <strong>{goldGrams(summary.goldMg) ?? '0.000 g'}</strong>
            </div>
          </article>
        </div>

        <section className="reports-table-card">
          <div className="reports-table-head">
            <h2>Settlement ledger</h2>
            <label className="admin-list-search">
              <Search />
              <input
                placeholder="Search customer, enrollment, type, method..."
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
                    <th>Customer</th>
                    <th>Scheme</th>
                    <th>Settlement</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Gold</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => {
                    const customer = resolveId(row.customerId);
                    return (
                      <tr
                        key={row._id}
                        className="reports-clickable-row"
                        onClick={() => navigate(`/admin/payouts/${row._id}`)}
                      >
                        <td>{date(row.payoutDate)}</td>
                        <td>
                          <button
                            type="button"
                            className="reports-cell-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (customer) navigate(`/admin/customers/${customer}`);
                            }}
                          >
                            <span className="scheme-admin-name-cell">
                              <b>{customerName(row)}</b>
                              <small>{customerPhone(row)}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className="scheme-admin-name-cell">
                            <b className="reports-inline-link">{schemeLabel(row)}</b>
                            <small>{row.schemeId?.enrollmentNumber ?? '—'}</small>
                          </span>
                        </td>
                        <td>
                          <span
                            className={`payout-type-pill ${String(row.payoutType ?? '')
                              .toLowerCase()}`}
                          >
                            {payoutTypeLabel(row.payoutType)}
                          </span>
                        </td>
                        <td>{methodLabel(row.method)}</td>
                        <td>{money(row.amountPaise)}</td>
                        <td>{goldGrams(row.goldWeightMg) ?? '—'}</td>
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
    </Page>
  );
}
