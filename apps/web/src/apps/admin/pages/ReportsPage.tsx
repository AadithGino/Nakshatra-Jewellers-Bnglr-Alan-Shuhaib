import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Card, Metric, Page, QueryState, Status } from '../../../shared/components/ui';

const reports = [
  ['collection', 'Collections'],
  ['phonepe', 'PhonePe'],
  ['cash', 'Cash'],
  ['staff-performance', 'Staff performance'],
  ['gold-liability', 'Gold liability'],
  ['maturity', 'Maturity calendar'],
  ['customer-ledger', 'Customer ledger'],
  ['scheme-ledger', 'Scheme ledger'],
  ['cash-position', 'Cash position'],
  ['payouts', 'Payouts'],
] as const;
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const maturityDefaults = () => {
  const from = new Date();
  const to = new Date(from);
  to.setFullYear(to.getFullYear() + 1);
  return [isoDate(from), isoDate(to)] as const;
};
const render = (value: any, key = ''): any => {
  if (value === null || value === undefined || value === '') return '—';
  if (key.toLowerCase().includes('paise')) return money(value);
  if (key.toLowerCase().includes('date') || key.endsWith('At')) return date(value);
  if (key === 'status') return <Status value={String(value)} />;
  if (typeof value === 'object')
    return (
      value.userId?.name ??
      value.name ??
      value.customerCode ??
      value.enrollmentNumber ??
      value._id ??
      '—'
    );
  return String(value);
};
type ChartPoint = { label: string; value: number; display?: string };

function ReportChart({ title, points }: { title: string; points: ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <Card title={title} className="report-chart">
      <div className="bar-chart">
        {points.length ? (
          points.slice(0, 12).map((point) => (
            <div className="bar-row" key={point.label}>
              <span title={point.label}>{point.label}</span>
              <div>
                <i style={{ width: `${Math.max(2, (point.value / max) * 100)}%` }} />
              </div>
              <b>{point.display ?? point.value.toLocaleString('en-IN')}</b>
            </div>
          ))
        ) : (
          <p className="helper">No chart data for this selection.</p>
        )}
      </div>
    </Card>
  );
}

export function ReportsPage({ initial = 'collection' }: { initial?: string }) {
  const initialDates = initial === 'maturity' ? maturityDefaults() : ['', ''];
  const [report, setReport] = useState(initial);
  const [from, setFrom] = useState(initialDates[0]);
  const [to, setTo] = useState(initialDates[1]);
  const [recordId, setRecordId] = useState('');
  const customerRecords = useQuery({
    queryKey: ['report-customers'],
    queryFn: () => api<any[]>('/admin/customers?limit=100'),
    enabled: report === 'customer-ledger',
  });
  const enrollmentRecords = useQuery({
    queryKey: ['report-enrollments'],
    queryFn: () => api<any[]>('/admin/enrollments?limit=100'),
    enabled: report === 'scheme-ledger',
  });
  const query = useQuery({
    queryKey: ['admin-report', report, from, to, recordId],
    queryFn: () =>
      api<any>(`/admin/reports/${report}?from=${from}&to=${to}&id=${encodeURIComponent(recordId)}`),
    enabled: !['customer-ledger', 'scheme-ledger'].includes(report) || Boolean(recordId),
  });
  const rows = useMemo(
    () =>
      Array.isArray(query.data)
        ? query.data
        : (query.data?.payments ?? query.data?.enrollments ?? []),
    [query.data],
  );
  const keys = rows[0]
    ? Object.keys(rows[0])
        .filter((key) => !['__v', 'updatedAt', 'originalSnapshot'].includes(key))
        .slice(0, 12)
    : [];
  const chart = useMemo<ChartPoint[]>(() => {
    if (query.data?.summary)
      return query.data.summary.map((item: any) => ({
        label: item._id,
        value: item.totalPaise,
        display: money(item.totalPaise),
      }));
    if (report === 'staff-performance')
      return rows.map((item: any) => ({
        label: item.userId?.name ?? item.employeeCode,
        value: item.totalPaise ?? 0,
        display: money(item.totalPaise),
      }));
    if (report === 'gold-liability')
      return rows.map((item: any) => ({
        label: item.customerId?.userId?.name ?? item.enrollmentNumber,
        value: item.totalGoldWeightMg ?? 0,
        display: `${((item.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g`,
      }));
    if (report === 'maturity') {
      const grouped = new Map<string, number>();
      for (const item of rows) {
        const key = new Date(item.maturityDate).toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        });
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      }
      return [...grouped].map(([label, value]) => ({ label, value }));
    }
    if (report === 'payouts') {
      const grouped = new Map<string, number>();
      for (const item of rows)
        grouped.set(item.payoutType, (grouped.get(item.payoutType) ?? 0) + item.amountPaise);
      return [...grouped].map(([label, value]) => ({ label, value, display: money(value) }));
    }
    if (report === 'cash-position' && query.data)
      return [
        'cashInVaultPaise',
        'cashWithStaffPaise',
        'cashSubmittedPaise',
        'totalGivenToCustomersPaise',
      ].map((key) => ({
        label: key.replaceAll(/([A-Z])/g, ' $1'),
        value: query.data[key] ?? 0,
        display: money(query.data[key]),
      }));
    return [];
  }, [query.data, report, rows]);
  const chooseReport = (value: string) => {
    setReport(value);
    setRecordId('');
    if (value === 'maturity' && (!from || !to)) {
      const [start, end] = maturityDefaults();
      setFrom(start);
      setTo(end);
    }
  };
  const exportCsv = () => {
    if (!rows.length) return;
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      keys.map(escape).join(','),
      ...rows.map((row: any) =>
        keys
          .map((key) => escape(typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key]))
          .join(','),
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nakshathra-${report}-${isoDate(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      title={report === 'maturity' ? 'Maturity calendar' : 'Reports'}
      subtitle="Live ledger reports with summaries, visual comparisons, full details and CSV export."
      actions={
        <button className="secondary" disabled={!rows.length} onClick={exportCsv}>
          <Download /> Export CSV
        </button>
      }
    >
      <Card className="stack">
        <div className="filters">
          {reports.map(([key, label]) => (
            <button
              className={report === key ? 'primary' : 'secondary'}
              key={key}
              onClick={() => chooseReport(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filters">
          <label>
            <span>From</span>
            <input
              className="form-control"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              className="form-control"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        {['customer-ledger', 'scheme-ledger'].includes(report) && (
          <label>
            <span>{report === 'customer-ledger' ? 'Customer' : 'Enrollment'}</span>
            <select
              className="form-control"
              value={recordId}
              onChange={(event) => setRecordId(event.target.value)}
            >
              <option value="">Select a record</option>
              {(report === 'customer-ledger'
                ? (customerRecords.data ?? [])
                : (enrollmentRecords.data ?? [])
              ).map((record: any) => (
                <option value={record._id} key={record._id}>
                  {report === 'customer-ledger'
                    ? `${record.customerCode} · ${record.userId?.name}`
                    : `${record.enrollmentNumber} · ${record.schemeType}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </Card>
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {query.data?.summary && (
          <div className="metrics">
            {query.data.summary.map((item: any) => (
              <Metric
                key={item._id}
                label={item._id}
                value={money(item.totalPaise)}
                note={`${item.count} payments`}
              />
            ))}
          </div>
        )}
        {report === 'cash-position' && query.data && (
          <div className="metrics">
            <Metric label="Cash in vault" value={money(query.data.cashInVaultPaise)} />
            <Metric label="Cash with staff" value={money(query.data.cashWithStaffPaise)} />
            <Metric label="Total collection" value={money(query.data.totalCollectionPaise)} />
            <Metric label="Customer payouts" value={money(query.data.totalGivenToCustomersPaise)} />
          </div>
        )}
        {report === 'gold-liability' && query.data && (
          <div className="metrics">
            <Metric
              label="Total 916 gold liability"
              value={`${((query.data.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g`}
              note={`${rows.length} active / matured schemes`}
            />
          </div>
        )}
        {report === 'customer-ledger' && query.data?.customer && (
          <div className="metrics">
            <Metric
              label="Customer"
              value={query.data.customer.userId?.name}
              note={query.data.customer.customerCode}
            />
            <Metric label="Schemes" value={query.data.enrollments?.length ?? 0} />
            <Metric label="Payments" value={query.data.payments?.length ?? 0} />
            <Metric label="Payouts" value={query.data.payouts?.length ?? 0} />
          </div>
        )}
        <ReportChart
          title={report === 'maturity' ? 'Maturities by month' : 'Report visualization'}
          points={chart}
        />
        <Card
          title={
            report === 'maturity'
              ? `Maturities from ${from || 'today'} to ${to || 'next year'}`
              : 'Detailed records'
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {keys.map((key) => (
                    <th key={key}>{key.replaceAll(/([A-Z])/g, ' $1')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, index: number) => (
                  <tr key={row._id ?? index}>
                    {keys.map((key) => (
                      <td key={key}>{render(row[key], key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="helper">No records match the selected report and period.</p>
          )}
        </Card>
      </QueryState>
    </Page>
  );
}
