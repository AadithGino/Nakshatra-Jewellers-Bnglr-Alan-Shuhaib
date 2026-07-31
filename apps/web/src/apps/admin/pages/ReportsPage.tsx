import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Gem,
  HandCoins,
  IndianRupee,
  Landmark,
  Layers3,
  QrCode,
  ReceiptText,
  Search,
  Users,
  Wallet,
} from 'lucide-react';
import { DateRangePicker, ReportSelect } from '../components/ReportFilters';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import {
  currentMonthRange,
  eachDayInRange,
  isoDate,
  maturityDefaultRange,
  shortDayLabel,
} from '../../../shared/utils/reportDateRange';
import { Page, QueryState, Status, Modal } from '../../../shared/components/ui';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';

type ReportTab = 'collections' | 'staff' | 'schemes' | 'maturity';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'collections', label: 'Collections' },
  { id: 'staff', label: 'Staff' },
  { id: 'schemes', label: 'Schemes' },
  { id: 'maturity', label: 'Maturity' },
];

const DEFAULT_REPORT: Record<ReportTab, string> = {
  collections: 'collection',
  staff: 'staff-performance',
  schemes: 'gold-liability',
  maturity: 'maturity',
};

const REPORT_OPTIONS: Record<ReportTab, { value: string; label: string }[]> = {
  collections: [
    { value: 'collection', label: 'Collection Report' },
    { value: 'cash', label: 'Cash Report' },
    { value: 'phonepe', label: 'PhonePe Report' },
  ],
  staff: [{ value: 'staff-performance', label: 'Staff Performance Report' }],
  schemes: [
    { value: 'gold-liability', label: 'Gold Liability Report' },
    { value: 'all-schemes', label: 'All Schemes Report' },
  ],
  maturity: [{ value: 'maturity', label: 'Maturity Calendar' }],
};

const PAGE_SIZE = 10;
const METHOD_ORDER = ['CASH', 'UPI', 'BANK', 'CARD'] as const;

const methodLabel = (method?: string) => {
  const normalized = method === 'PHONEPE' ? 'UPI' : method;
  if (normalized === 'CASH') return 'Cash';
  if (normalized === 'UPI') return 'UPI';
  if (normalized === 'BANK') return 'Bank';
  if (normalized === 'CARD') return 'Card';
  return normalized ?? '—';
};
const schemeTypeLabel = (value?: string) =>
  value === 'GOLD_WEIGHT' ? 'Gold weight' : value === 'CASH' ? 'Cash' : value ?? '—';

const schemeLabel = (payment: any) =>
  payment.schemeId?.schemePlanId?.name ?? schemeTypeLabel(payment.schemeId?.schemeType);

const customerName = (row: any) =>
  row.customerId?.userId?.name ?? row.customerId?.name ?? row.userId?.name ?? '—';

const customerPhone = (row: any) => row.customerId?.userId?.phone ?? '—';

const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
};

const customerId = (row: any) => resolveId(row.customerId);
const enrollmentId = (row: any) => resolveId(row.schemeId) ?? resolveId(row._id);
const staffProfileId = (row: any) => resolveId(row._id);

const goldWeightLabel = (weightMg?: number | null) =>
  weightMg ? `${(weightMg / 1000).toFixed(3)} g` : '—';

function ReportCellLink({
  to,
  children,
  onNavigate,
}: {
  to: string | null;
  children: ReactNode;
  onNavigate?: (event: MouseEvent) => void;
}) {
  const navigate = useNavigate();
  if (!to) return <>{children}</>;
  return (
    <button
      type="button"
      className="reports-cell-link"
      onClick={(event) => {
        onNavigate?.(event);
        event.stopPropagation();
        navigate(to);
      }}
    >
      {children}
    </button>
  );
}

function chartTicks(maxValue: number) {
  const step = Math.max(50_000_00, Math.ceil(maxValue / 5 / 50_000_00) * 50_000_00);
  const ticks: number[] = [];
  for (let value = 0; value <= maxValue + step; value += step) ticks.push(value);
  if (ticks.length < 2) return [0, maxValue || 1];
  return ticks;
}

function DailyCollectionChart({
  from,
  to,
  payments,
}: {
  from: string;
  to: string;
  payments: any[];
}) {
  const days = useMemo(() => eachDayInRange(from, to), [from, to]);
  const totals = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const day of days) grouped.set(day, 0);
    for (const payment of payments) {
      const key = isoDate(new Date(payment.paymentDate));
      if (grouped.has(key)) grouped.set(key, (grouped.get(key) ?? 0) + (payment.amountPaise ?? 0));
    }
    return days.map((day) => ({ day, label: shortDayLabel(day), value: grouped.get(day) ?? 0 }));
  }, [days, payments]);
  const max = Math.max(...totals.map((item) => item.value), 1);
  const ticks = chartTicks(max).reverse();
  const showEvery = totals.length > 20 ? 5 : totals.length > 14 ? 3 : 1;

  return (
    <section className="reports-chart-card">
      <h2>Daily Collection</h2>
      <div className="daily-collection-chart">
        <div className="daily-chart-y">
          {ticks.map((tick) => (
            <span key={tick}>₹{(tick / 100).toLocaleString('en-IN')}</span>
          ))}
        </div>
        <div className="daily-chart-body">
          <div className="daily-chart-grid">
            {ticks.map((tick) => (
              <i key={tick} />
            ))}
          </div>
          <div className="daily-chart-bars">
            {totals.length ? (
              totals.map((item, index) => (
                <div className="daily-bar-group" key={item.day} title={money(item.value)}>
                  <i style={{ height: `${Math.max(item.value ? 4 : 0, (item.value / max) * 100)}%` }} />
                  {index % showEvery === 0 ? <small>{item.label}</small> : <small aria-hidden />}
                </div>
              ))
            ) : (
              <p className="helper">No collection data for this period.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StaffCollectionChart({ rows }: { rows: any[] }) {
  const points = [...rows]
    .sort((a, b) => (b.totalPaise ?? 0) - (a.totalPaise ?? 0))
    .slice(0, 8);
  const max = Math.max(...points.map((row) => row.totalPaise ?? 0), 1);
  return (
    <section className="reports-chart-card">
      <h2>Staff Collections</h2>
      <div className="reports-bar-list">
        {points.length ? (
          points.map((row) => (
            <div className="reports-bar-row" key={row._id}>
              <span>{row.userId?.name ?? row.employeeCode}</span>
              <div>
                <i style={{ width: `${Math.max(4, ((row.totalPaise ?? 0) / max) * 100)}%` }} />
              </div>
              <b>{money(row.totalPaise)}</b>
            </div>
          ))
        ) : (
          <p className="helper">No staff collections for this period.</p>
        )}
      </div>
    </section>
  );
}

function MaturityChart({ rows }: { rows: any[] }) {
  const points = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of rows) {
      const key = new Date(row.maturityDate).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      });
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    return [...grouped].map(([label, value]) => ({ label, value }));
  }, [rows]);
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <section className="reports-chart-card">
      <h2>Maturities by Month</h2>
      <div className="reports-bar-list">
        {points.length ? (
          points.map((point) => (
            <div className="reports-bar-row" key={point.label}>
              <span>{point.label}</span>
              <div>
                <i style={{ width: `${Math.max(4, (point.value / max) * 100)}%` }} />
              </div>
              <b>{point.value}</b>
            </div>
          ))
        ) : (
          <p className="helper">No maturities in this period.</p>
        )}
      </div>
    </section>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const items: (number | 'ellipsis')[] = [];
  if (pages <= 7) {
    for (let index = 1; index <= pages; index += 1) items.push(index);
  } else {
    items.push(1, 2, 3, 'ellipsis', pages);
  }

  return (
    <div className="reports-pagination">
      <span>
        Showing {from} to {to} of {total.toLocaleString('en-IN')} entries
      </span>
      <div>
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft />
        </button>
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`}>…</span>
          ) : (
            <button
              type="button"
              key={item}
              className={page === item ? 'active' : ''}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

function ReportTableCard({
  title,
  search,
  onSearch,
  children,
  empty,
  pagination,
}: {
  title: string;
  search?: string;
  onSearch?: (value: string) => void;
  children: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  pagination?: ReactNode;
}) {
  return (
    <section className="reports-table-card">
      <div className="reports-table-head">
        <h2>{title}</h2>
        {onSearch && (
          <label className="admin-list-search">
            <Search />
            <input
              placeholder="Search..."
              value={search ?? ''}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
        )}
      </div>
      {children}
      {empty && <p className="helper">No records match the selected report and period.</p>}
      {pagination}
    </section>
  );
}

function usePagedRows<T>(rows: T[], search: string, matcher: (row: T, term: string) => boolean) {
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => matcher(row, term));
  }, [rows, search, matcher]);
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);
  return { filtered, paged, page, setPage, resetPage: () => setPage(1) };
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join(
    '\n',
  );
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage({ initial = 'collections' }: { initial?: string }) {
  const navigate = useNavigate();
  const initialTab: ReportTab =
    initial === 'maturity'
      ? 'maturity'
      : initial === 'staff-performance'
        ? 'staff'
        : initial === 'gold-liability'
          ? 'schemes'
          : 'collections';
  const [tab, setTab] = useState<ReportTab>(initialTab);
  const [reportType, setReportType] = useState(DEFAULT_REPORT[initialTab]);
  const [from, setFrom] = useState(
    initial === 'maturity' ? maturityDefaultRange()[0] : currentMonthRange()[0],
  );
  const [to, setTo] = useState(
    initial === 'maturity' ? maturityDefaultRange()[1] : currentMonthRange()[1],
  );
  const [tableSearch, setTableSearch] = useState('');
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  const receipt = useQuery({
    queryKey: ['admin-payment-receipt', receiptPaymentId],
    queryFn: () => api<any>(`/admin/operation-records/payments/${receiptPaymentId}`),
    enabled: Boolean(receiptPaymentId),
  });

  const dateFilterApplies = tab !== 'schemes';
  const query = useQuery({
    queryKey: ['admin-report', reportType, from, to],
    queryFn: () => api<any>(`/admin/reports/${reportType}?from=${from}&to=${to}`),
    enabled: dateFilterApplies ? Boolean(from && to) : true,
  });

  const rows = useMemo(
    () =>
      Array.isArray(query.data)
        ? query.data
        : (query.data?.payments ?? query.data?.enrollments ?? []),
    [query.data],
  );

  const collectionSummary = useMemo(() => {
    if (tab !== 'collections' || !query.data?.summary) return null;
    const summaryRows = query.data.summary as { _id: string; totalPaise: number; count: number }[];
    const byMethod = new Map<string, { totalPaise: number; count: number }>();
    for (const row of summaryRows) {
      const method = row._id === 'PHONEPE' ? 'UPI' : row._id;
      const current = byMethod.get(method) ?? { totalPaise: 0, count: 0 };
      byMethod.set(method, {
        totalPaise: current.totalPaise + (row.totalPaise ?? 0),
        count: current.count + (row.count ?? 0),
      });
    }
    const methodTotals = Object.fromEntries(
      METHOD_ORDER.map((method) => [
        method,
        byMethod.get(method) ?? { totalPaise: 0, count: 0 },
      ]),
    ) as Record<(typeof METHOD_ORDER)[number], { totalPaise: number; count: number }>;
    return {
      totalPaise: summaryRows.reduce((sum, row) => sum + row.totalPaise, 0),
      paymentCount: summaryRows.reduce((sum, row) => sum + row.count, 0),
      cashPaise: methodTotals.CASH.totalPaise,
      upiPaise: methodTotals.UPI.totalPaise,
      bankPaise: methodTotals.BANK.totalPaise,
      cardPaise: methodTotals.CARD.totalPaise,
      byMethod: methodTotals,
    };
  }, [query.data, tab]);

  const staffSummary = useMemo(() => {
    if (tab !== 'staff') return null;
    return {
      staffCount: rows.length,
      totalPaise: rows.reduce((sum: number, row: any) => sum + (row.totalPaise ?? 0), 0),
      cashCollectedPaise: rows.reduce(
        (sum: number, row: any) => sum + (row.cashCollectedPaise ?? 0),
        0,
      ),
      cashWithStaffPaise: rows.reduce(
        (sum: number, row: any) => sum + (row.cashWithStaffPaise ?? 0),
        0,
      ),
      paymentCount: rows.reduce((sum: number, row: any) => sum + (row.paymentCount ?? 0), 0),
    };
  }, [rows, tab]);

  const schemesSummary = useMemo(() => {
    if (tab !== 'schemes' || !query.data) return null;
    const activeSchemes = rows.filter((r: any) => r.status === 'ACTIVE').length;
    const maturedSchemes = rows.filter((r: any) => r.status === 'MATURED').length;
    return {
      totalGoldWeightMg:
        query.data.totalGoldWeightMg ??
        rows.reduce((sum: number, row: any) => sum + (row.totalGoldWeightMg ?? 0), 0),
      totalPaidPaise: rows.reduce((sum: number, row: any) => sum + (row.totalPaidPaise ?? 0), 0),
      activeSchemes: query.data.activeSchemes ?? activeSchemes,
      maturedSchemes: query.data.maturedSchemes ?? maturedSchemes,
      cashSchemes: query.data.cashSchemes ?? rows.filter((r: any) => r.schemeType === 'CASH').length,
      goldSchemes:
        query.data.goldSchemes ?? rows.filter((r: any) => r.schemeType === 'GOLD_WEIGHT').length,
    };
  }, [query.data, rows, tab]);

  const maturitySummary = useMemo(() => {
    if (tab !== 'maturity') return null;
    return {
      totalSchemes: rows.length,
      activeSchemes: rows.filter((row: any) => row.status === 'ACTIVE').length,
      totalPaidPaise: rows.reduce((sum: number, row: any) => sum + (row.totalPaidPaise ?? 0), 0),
      totalGoldWeightMg: rows.reduce(
        (sum: number, row: any) => sum + (row.totalGoldWeightMg ?? 0),
        0,
      ),
    };
  }, [rows, tab]);

  const collectionRows = usePagedRows(
    tab === 'collections' ? rows : [],
    tableSearch,
    (payment: any, term) =>
      [customerName(payment), payment.receiptNumber, schemeLabel(payment), methodLabel(payment.method)]
        .join(' ')
        .toLowerCase()
        .includes(term),
  );
  const staffRows = usePagedRows(
    tab === 'staff' ? rows : [],
    tableSearch,
    (row: any, term) =>
      [row.userId?.name, row.employeeCode, row.userId?.phone, row.userId?.status]
        .join(' ')
        .toLowerCase()
        .includes(term),
  );
  const schemeRows = usePagedRows(
    tab === 'schemes' ? rows : [],
    tableSearch,
    (row: any, term) =>
      [
        customerName(row),
        row.enrollmentNumber,
        row.schemePlanId?.name,
        row.schemeType,
        row.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
  );
  const maturityRows = usePagedRows(
    tab === 'maturity' ? rows : [],
    tableSearch,
    (row: any, term) =>
      [customerName(row), customerPhone(row), row.enrollmentNumber, row.schemePlanId?.name]
        .join(' ')
        .toLowerCase()
        .includes(term),
  );

  const switchTab = (next: ReportTab) => {
    setTab(next);
    setReportType(DEFAULT_REPORT[next]);
    setTableSearch('');
    collectionRows.resetPage();
    staffRows.resetPage();
    schemeRows.resetPage();
    maturityRows.resetPage();
    if (next === 'maturity') {
      const [start, end] = maturityDefaultRange();
      setFrom(start);
      setTo(end);
      return;
    }
    if (!from || !to) {
      const [start, end] = currentMonthRange();
      setFrom(start);
      setTo(end);
    }
  };

  const exportCsv = () => {
    if (!rows.length) return;
    if (tab === 'collections') {
      downloadCsv(
        `nakshathra-${reportType}-${isoDate(new Date())}.csv`,
        ['Date', 'Receipt', 'Customer', 'Scheme', 'Method', 'Amount', 'Status'],
        rows.map((payment: any) => [
          date(payment.paymentDate),
          payment.receiptNumber,
          customerName(payment),
          schemeLabel(payment),
          methodLabel(payment.method),
          (payment.amountPaise ?? 0) / 100,
          payment.status,
        ]),
      );
      return;
    }
    if (tab === 'staff') {
      downloadCsv(
        `nakshathra-staff-${isoDate(new Date())}.csv`,
        [
          'Staff',
          'Employee code',
          'Phone',
          'Status',
          'Payments',
          'Total collection',
          'Cash collected',
          'Cash submitted',
          'Cash with staff',
        ],
        rows.map((row: any) => [
          row.userId?.name,
          row.employeeCode,
          row.userId?.phone,
          row.userId?.status,
          row.paymentCount,
          (row.totalPaise ?? 0) / 100,
          (row.cashCollectedPaise ?? 0) / 100,
          (row.cashSubmittedPaise ?? 0) / 100,
          (row.cashWithStaffPaise ?? 0) / 100,
        ]),
      );
      return;
    }
    if (tab === 'schemes') {
      downloadCsv(
        `nakshathra-schemes-${isoDate(new Date())}.csv`,
        [
          'Customer',
          'Phone',
          'Enrollment',
          'Scheme',
          'Type',
          'Total paid',
          'Gold weight (g)',
          'Maturity date',
          'Status',
        ],
        rows.map((row: any) => [
          customerName(row),
          customerPhone(row),
          row.enrollmentNumber,
          row.schemePlanId?.name,
          schemeTypeLabel(row.schemeType),
          (row.totalPaidPaise ?? 0) / 100,
          ((row.totalGoldWeightMg ?? 0) / 1000).toFixed(3),
          date(row.maturityDate),
          row.status,
        ]),
      );
      return;
    }
    downloadCsv(
      `nakshathra-maturity-${isoDate(new Date())}.csv`,
      [
        'Customer',
        'Phone',
        'Enrollment',
        'Scheme',
        'Start date',
        'Maturity date',
        'Total paid',
        'Gold weight (g)',
        'Status',
      ],
      rows.map((row: any) => [
        customerName(row),
        customerPhone(row),
        row.enrollmentNumber,
        row.schemePlanId?.name,
        date(row.startDate),
        date(row.maturityDate),
        (row.totalPaidPaise ?? 0) / 100,
        ((row.totalGoldWeightMg ?? 0) / 1000).toFixed(3),
        row.status,
      ]),
    );
  };

  return (
    <Page title="Reports">
      <div className="reports-page">
        <div className="reports-tabs" role="tablist" aria-label="Report sections">
          {TABS.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => switchTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="reports-toolbar">
          <div className="reports-toolbar-filters">
            <ReportSelect
              value={reportType}
              options={REPORT_OPTIONS[tab]}
              onChange={(value) => {
                setReportType(value);
                collectionRows.resetPage();
                staffRows.resetPage();
                schemeRows.resetPage();
                maturityRows.resetPage();
              }}
            />
            {dateFilterApplies && (
              <DateRangePicker
                from={from}
                to={to}
                onChange={(nextFrom, nextTo) => {
                  setFrom(nextFrom);
                  setTo(nextTo);
                  collectionRows.resetPage();
                  staffRows.resetPage();
                  maturityRows.resetPage();
                }}
              />
            )}
          </div>
          <button
            type="button"
            className="primary reports-export"
            disabled={!rows.length}
            onClick={exportCsv}
          >
            <Download /> Export CSV
          </button>
        </div>

        <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
          {tab === 'collections' && (
            <>
              <div className="reports-kpi-grid reports-kpi-grid-methods">
                <article className="dashboard-kpi">
                  <span>
                    <IndianRupee />
                  </span>
                  <div>
                    <small>Total Collection</small>
                    <strong>{money(collectionSummary?.totalPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <Banknote />
                  </span>
                  <div>
                    <small>Cash</small>
                    <strong>{money(collectionSummary?.cashPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <QrCode />
                  </span>
                  <div>
                    <small>UPI</small>
                    <strong>{money(collectionSummary?.upiPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <Landmark />
                  </span>
                  <div>
                    <small>Bank</small>
                    <strong>{money(collectionSummary?.bankPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <CreditCard />
                  </span>
                  <div>
                    <small>Card</small>
                    <strong>{money(collectionSummary?.cardPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi success">
                  <span>
                    <ReceiptText />
                  </span>
                  <div>
                    <small>Payments</small>
                    <strong>{(collectionSummary?.paymentCount ?? 0).toLocaleString('en-IN')}</strong>
                  </div>
                </article>
              </div>
              <DailyCollectionChart from={from} to={to} payments={rows} />
              <ReportTableCard
                title="Collection Details"
                search={tableSearch}
                onSearch={(value) => {
                  setTableSearch(value);
                  collectionRows.resetPage();
                }}
                empty={!collectionRows.filtered.length}
                pagination={
                  <Pagination
                    page={collectionRows.page}
                    total={collectionRows.filtered.length}
                    pageSize={PAGE_SIZE}
                    onChange={collectionRows.setPage}
                  />
                }
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Receipt</th>
                        <th>Customer</th>
                        <th>Scheme</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionRows.paged.map((payment: any) => (
                        <tr
                          key={payment._id}
                          className="reports-clickable-row"
                          onClick={() => setReceiptPaymentId(payment._id)}
                        >
                          <td>{date(payment.paymentDate)}</td>
                          <td>
                            <span className="reports-inline-link">
                              {payment.receiptNumber ?? '—'}
                            </span>
                          </td>
                          <td>
                            <ReportCellLink to={customerId(payment) ? `/admin/customers/${customerId(payment)}` : null}>
                              {customerName(payment)}
                            </ReportCellLink>
                          </td>
                          <td>
                            <ReportCellLink
                              to={
                                enrollmentId(payment)
                                  ? `/admin/enrollments/${enrollmentId(payment)}`
                                  : null
                              }
                            >
                              {schemeLabel(payment)}
                            </ReportCellLink>
                          </td>
                          <td>{methodLabel(payment.method)}</td>
                          <td>{money(payment.amountPaise)}</td>
                          <td>
                            <Status value={payment.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ReportTableCard>
            </>
          )}

          {tab === 'staff' && (
            <>
              <div className="reports-kpi-grid">
                <article className="dashboard-kpi">
                  <span>
                    <Users />
                  </span>
                  <div>
                    <small>Staff members</small>
                    <strong>{staffSummary?.staffCount ?? 0}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <IndianRupee />
                  </span>
                  <div>
                    <small>Total collection</small>
                    <strong>{money(staffSummary?.totalPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <HandCoins />
                  </span>
                  <div>
                    <small>Cash collected</small>
                    <strong>{money(staffSummary?.cashCollectedPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi success">
                  <span>
                    <Wallet />
                  </span>
                  <div>
                    <small>Cash with staff</small>
                    <strong>{money(staffSummary?.cashWithStaffPaise)}</strong>
                  </div>
                </article>
              </div>
              <StaffCollectionChart rows={rows} />
              <ReportTableCard
                title="Staff Performance Details"
                search={tableSearch}
                onSearch={(value) => {
                  setTableSearch(value);
                  staffRows.resetPage();
                }}
                empty={!staffRows.filtered.length}
                pagination={
                  <Pagination
                    page={staffRows.page}
                    total={staffRows.filtered.length}
                    pageSize={PAGE_SIZE}
                    onChange={staffRows.setPage}
                  />
                }
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th>Employee code</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Payments</th>
                        <th>UPI</th>
                        <th>Bank</th>
                        <th>Card</th>
                        <th>Total collection</th>
                        <th>Cash collected</th>
                        <th>Cash submitted</th>
                        <th>Cash with staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffRows.paged.map((row: any) => (
                        <tr
                          key={row._id}
                          className="reports-clickable-row"
                          onClick={() => {
                            const id = staffProfileId(row);
                            if (id) navigate(`/admin/staff/${id}`);
                          }}
                        >
                          <td>
                            <ReportCellLink to={staffProfileId(row) ? `/admin/staff/${staffProfileId(row)}` : null}>
                              {row.userId?.name ?? '—'}
                            </ReportCellLink>
                          </td>
                          <td>{row.employeeCode ?? '—'}</td>
                          <td>{row.userId?.phone ?? '—'}</td>
                          <td>
                            <Status value={row.userId?.status ?? 'ACTIVE'} />
                          </td>
                          <td>{row.paymentCount ?? 0}</td>
                          <td>
                            {money(
                              row.byMethod?.find((method: any) => method.method === 'UPI')
                                ?.totalPaise ?? 0,
                            )}
                          </td>
                          <td>
                            {money(
                              row.byMethod?.find((method: any) => method.method === 'BANK')
                                ?.totalPaise ?? 0,
                            )}
                          </td>
                          <td>
                            {money(
                              row.byMethod?.find((method: any) => method.method === 'CARD')
                                ?.totalPaise ?? 0,
                            )}
                          </td>
                          <td>{money(row.totalPaise)}</td>
                          <td>{money(row.cashCollectedPaise)}</td>
                          <td>{money(row.cashSubmittedPaise)}</td>
                          <td>{money(row.cashWithStaffPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ReportTableCard>
            </>
          )}

          {tab === 'schemes' && (
            <>
              <div className="reports-kpi-grid">
                <article className="dashboard-kpi">
                  <span>
                    <Gem />
                  </span>
                  <div>
                    <small>Gold liability</small>
                    <strong>{((schemesSummary?.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <Layers3 />
                  </span>
                  <div>
                    <small>Active schemes</small>
                    <strong>{schemesSummary?.activeSchemes ?? 0}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <IndianRupee />
                  </span>
                  <div>
                    <small>Total paid</small>
                    <strong>{money(schemesSummary?.totalPaidPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi success">
                  <span>
                    <ReceiptText />
                  </span>
                  <div>
                    <small>Matured schemes</small>
                    <strong>{schemesSummary?.maturedSchemes ?? 0}</strong>
                  </div>
                </article>
              </div>
              <ReportTableCard
                title={reportType === 'gold-liability' ? 'Gold Liability Details' : 'All Schemes Details'}
                search={tableSearch}
                onSearch={(value) => {
                  setTableSearch(value);
                  schemeRows.resetPage();
                }}
                empty={!schemeRows.filtered.length}
                pagination={
                  <Pagination
                    page={schemeRows.page}
                    total={schemeRows.filtered.length}
                    pageSize={PAGE_SIZE}
                    onChange={schemeRows.setPage}
                  />
                }
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Enrollment</th>
                        <th>Scheme</th>
                        <th>Type</th>
                        <th>Total paid</th>
                        <th>Gold weight</th>
                        <th>Maturity date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemeRows.paged.map((row: any) => (
                        <tr
                          key={row._id}
                          className="reports-clickable-row"
                          onClick={() => {
                            const id = enrollmentId(row);
                            if (id) navigate(`/admin/enrollments/${id}`);
                          }}
                        >
                          <td>
                            <ReportCellLink
                              to={customerId(row) ? `/admin/customers/${customerId(row)}` : null}
                            >
                              {customerName(row)}
                            </ReportCellLink>
                          </td>
                          <td>{customerPhone(row)}</td>
                          <td>{row.enrollmentNumber ?? '—'}</td>
                          <td>
                            <ReportCellLink
                              to={
                                enrollmentId(row) ? `/admin/enrollments/${enrollmentId(row)}` : null
                              }
                            >
                              {row.schemePlanId?.name ?? '—'}
                            </ReportCellLink>
                          </td>
                          <td>{schemeTypeLabel(row.schemeType)}</td>
                          <td>{money(row.totalPaidPaise)}</td>
                          <td>{goldWeightLabel(row.totalGoldWeightMg)}</td>
                          <td>{date(row.maturityDate)}</td>
                          <td>
                            <Status value={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ReportTableCard>
            </>
          )}

          {tab === 'maturity' && (
            <>
              <div className="reports-kpi-grid">
                <article className="dashboard-kpi">
                  <span>
                    <CalendarClock />
                  </span>
                  <div>
                    <small>Schemes maturing</small>
                    <strong>{maturitySummary?.totalSchemes ?? 0}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <Layers3 />
                  </span>
                  <div>
                    <small>Active maturing</small>
                    <strong>{maturitySummary?.activeSchemes ?? 0}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi success">
                  <span>
                    <IndianRupee />
                  </span>
                  <div>
                    <small>Total paid value</small>
                    <strong>{money(maturitySummary?.totalPaidPaise)}</strong>
                  </div>
                </article>
                <article className="dashboard-kpi">
                  <span>
                    <Gem />
                  </span>
                  <div>
                    <small>Gold weight</small>
                    <strong>{goldWeightLabel(maturitySummary?.totalGoldWeightMg)}</strong>
                  </div>
                </article>
              </div>
              <MaturityChart rows={rows} />
              <ReportTableCard
                title="Maturity Calendar Details"
                search={tableSearch}
                onSearch={(value) => {
                  setTableSearch(value);
                  maturityRows.resetPage();
                }}
                empty={!maturityRows.filtered.length}
                pagination={
                  <Pagination
                    page={maturityRows.page}
                    total={maturityRows.filtered.length}
                    pageSize={PAGE_SIZE}
                    onChange={maturityRows.setPage}
                  />
                }
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Enrollment</th>
                        <th>Scheme</th>
                        <th>Start date</th>
                        <th>Maturity date</th>
                        <th>Total paid</th>
                        <th>Gold weight</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maturityRows.paged.map((row: any) => (
                        <tr
                          key={row._id}
                          className="reports-clickable-row"
                          onClick={() => {
                            const id = enrollmentId(row);
                            if (id) navigate(`/admin/enrollments/${id}`);
                          }}
                        >
                          <td>
                            <ReportCellLink
                              to={customerId(row) ? `/admin/customers/${customerId(row)}` : null}
                            >
                              {customerName(row)}
                            </ReportCellLink>
                          </td>
                          <td>{customerPhone(row)}</td>
                          <td>{row.enrollmentNumber ?? '—'}</td>
                          <td>
                            <ReportCellLink
                              to={
                                enrollmentId(row) ? `/admin/enrollments/${enrollmentId(row)}` : null
                              }
                            >
                              {row.schemePlanId?.name ?? schemeTypeLabel(row.schemeType)}
                            </ReportCellLink>
                          </td>
                          <td>{date(row.startDate)}</td>
                          <td>{date(row.maturityDate)}</td>
                          <td>{money(row.totalPaidPaise)}</td>
                          <td>{goldWeightLabel(row.totalGoldWeightMg)}</td>
                          <td>
                            <Status value={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ReportTableCard>
            </>
          )}
        </QueryState>
      </div>

      <Modal
        title="Official payment receipt"
        open={Boolean(receiptPaymentId)}
        onClose={() => setReceiptPaymentId(null)}
      >
        <QueryState
          loading={receipt.isLoading}
          error={receipt.error}
          retry={() => void receipt.refetch()}
        >
          {receipt.data && (
            <ReceiptSheet payment={receipt.data} title="Collection receipt" />
          )}
        </QueryState>
      </Modal>
    </Page>
  );
}
