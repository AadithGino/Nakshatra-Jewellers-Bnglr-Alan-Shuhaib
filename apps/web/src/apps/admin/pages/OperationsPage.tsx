import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Database, Plus, Search, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, money } from '../../../shared/utils/format';
import { Select } from '../../../shared/components/Select';
import { Card, Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

export type Field = {
  key: string;
  label: string;
  type?: string;
  source?: 'customers' | 'staff' | 'plans' | 'enrollments';
  options?: string[];
};
export type Config = {
  title: string;
  endpoint: string;
  columns: [string, string][];
  fields?: Field[];
  createLabel?: string;
};

// Shared with the dedicated record page; the exports intentionally live beside the list UI.
// eslint-disable-next-line react-refresh/only-export-components
export const operationConfigs: Record<string, Config> = {
  'scheme-plans': {
    title: 'Scheme plans',
    endpoint: '/admin/scheme-plans',
    createLabel: 'Create plan',
    columns: [
      ['name', 'Plan'],
      ['type', 'Type'],
      ['minimumPaymentPaise', 'Minimum'],
      ['status', 'Status'],
    ],
    fields: [
      { key: 'name', label: 'Plan name' },
      { key: 'type', label: 'Type', options: ['GOLD_WEIGHT', 'CASH'] },
      { key: 'durationMonths', label: 'Duration months', type: 'number' },
      { key: 'minimumPaymentRupees', label: 'Minimum payment ₹', type: 'number' },
      { key: 'termsText', label: 'Terms' },
      { key: 'benefitText', label: 'Benefit' },
      { key: 'makingChargeBenefit', label: 'Making charge benefit' },
      { key: 'wastageBenefit', label: 'Wastage benefit' },
      { key: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE'] },
    ],
  },
  enrollments: {
    title: 'Scheme enrollments',
    endpoint: '/admin/enrollments',
    createLabel: 'Enroll customer',
    columns: [
      ['enrollmentNumber', 'Enrollment'],
      ['customerId.customerCode', 'Customer'],
      ['schemeType', 'Type'],
      ['totalPaidPaise', 'Paid'],
      ['status', 'Status'],
    ],
    fields: [
      { key: 'customerId', label: 'Customer', source: 'customers' },
      { key: 'schemePlanId', label: 'Scheme plan', source: 'plans' },
      { key: 'startDate', label: 'Start date', type: 'date' },
    ],
  },
  'gold-rates': {
    title: 'Gold rate management',
    endpoint: '/admin/gold-rates',
    createLabel: 'Add gold rate',
    columns: [
      ['effectiveFrom', 'Effective'],
      ['purity', 'Purity'],
      ['ratePerGramPaise', 'Rate / gram'],
      ['usageCount', 'Payments'],
      ['status', 'Status'],
    ],
    fields: [
      { key: 'rateRupees', label: 'Rate per gram ₹', type: 'number' },
      { key: 'effectiveFrom', label: 'Effective date/time', type: 'datetime-local' },
      { key: 'notes', label: 'Notes' },
      { key: 'status', label: 'Status', options: ['ACTIVE', 'INACTIVE'] },
    ],
  },
  payments: {
    title: 'Payment management',
    endpoint: '/admin/payments',
    createLabel: 'Record payment',
    columns: [
      ['receiptNumber', 'Receipt'],
      ['paymentDate', 'Date'],
      ['method', 'Method'],
      ['amountPaise', 'Amount'],
      ['status', 'Status'],
    ],
    fields: [
      { key: 'customerId', label: 'Customer', source: 'customers' },
      { key: 'schemeId', label: 'Enrollment', source: 'enrollments' },
      { key: 'amountRupees', label: 'Amount ₹', type: 'number' },
      { key: 'method', label: 'Method', options: ['CASH', 'UPI', 'BANK', 'CARD'] },
      { key: 'paymentDate', label: 'Payment date', type: 'datetime-local' },
      { key: 'referenceNumber', label: 'Reference number' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  'cash-submissions': {
    title: 'Cash submissions',
    endpoint: '/admin/cash-submissions',
    createLabel: 'Record submission',
    columns: [
      ['submissionDate', 'Date'],
      ['staffId', 'Staff'],
      ['amountPaise', 'Amount'],
      ['status', 'Status'],
    ],
    fields: [
      { key: 'staffId', label: 'Staff', source: 'staff' },
      { key: 'amountRupees', label: 'Amount ₹', type: 'number' },
      { key: 'submissionDate', label: 'Submission date', type: 'datetime-local' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  corrections: {
    title: 'Correction requests',
    endpoint: '/admin/corrections',
    columns: [
      ['correctionType', 'Type'],
      ['reason', 'Reason'],
      ['status', 'Status'],
      ['createdAt', 'Requested'],
    ],
  },
  payouts: {
    title: 'Redeem and payout history',
    endpoint: '/admin/payouts',
    columns: [
      ['payoutDate', 'Date'],
      ['payoutType', 'Settlement'],
      ['method', 'Method'],
      ['amountPaise', 'Amount'],
      ['goldWeightMg', 'Gold weight'],
      ['status', 'Status'],
    ],
  },
  'phonepe-transactions': {
    title: 'PhonePe transactions',
    endpoint: '/admin/phonepe-transactions',
    columns: [
      ['merchantTransactionId', 'Merchant transaction'],
      ['customerId.customerCode', 'Customer'],
      ['schemeId.enrollmentNumber', 'Scheme'],
      ['status', 'Status'],
      ['amountPaise', 'Amount'],
      ['webhookStatus', 'Webhook'],
      ['receiptStatus', 'Receipt'],
      ['createdAt', 'Created'],
    ],
  },
  'audit-logs': {
    title: 'Audit logs',
    endpoint: '/admin/audit-logs',
    columns: [
      ['createdAt', 'Time'],
      ['actorRole', 'Actor'],
      ['action', 'Action'],
      ['entityType', 'Entity'],
    ],
  },
};

// eslint-disable-next-line react-refresh/only-export-components
export const getOperationValue = (object: any, path: string) =>
  path.split('.').reduce((value, key) => value?.[key], object);
const paise = (value: string) => Math.round(Number(value) * 100);
// eslint-disable-next-line react-refresh/only-export-components
export const displayOperationValue = (key: string, value: any) =>
  key === 'goldWeightMg' ? (
    `${((value ?? 0) / 1000).toFixed(3)} g`
  ) : key === 'payoutType' ? (
    value === 'REDEEM' ? (
      'Redeem gold'
    ) : value === 'PAYOUT' ? (
      'Payout amount'
    ) : (
      String(value ?? '—')
    )
  ) : key.endsWith('Paise') ? (
    money(value)
  ) : key.toLowerCase().includes('date') || key === 'createdAt' || key === 'effectiveFrom' ? (
    date(value)
  ) : key === 'status' ? (
    <Status value={String(value)} />
  ) : typeof value === 'object' ? (
    String(value?._id ?? '—')
  ) : (
    String(value ?? '—')
  );

export function OperationsPage({ module }: { module: string }) {
  const config = operationConfigs[module];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(params.get('action') === 'create');
  const [values, setValues] = useState<Record<string, string>>(() =>
    params.get('action') === 'create'
      ? {
          paymentDate: new Date().toISOString().slice(0, 16),
          submissionDate: new Date().toISOString().slice(0, 16),
          payoutDate: new Date().toISOString().slice(0, 10),
          startDate: new Date().toISOString().slice(0, 10),
          durationMonths: '11',
          status: 'ACTIVE',
        }
      : ({} as Record<string, string>),
  );
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const list = useQuery({
    queryKey: [config.endpoint],
    queryFn: () => api<any[]>(config.endpoint),
  });
  const customers = useQuery({
    queryKey: ['operation-customers'],
    queryFn: () => api<any[]>('/admin/customers?limit=100'),
    enabled: Boolean(config.fields?.some((field) => field.source === 'customers')),
  });
  const staff = useQuery({
    queryKey: ['operation-staff'],
    queryFn: () => api<any[]>('/admin/staff?limit=100'),
    enabled: Boolean(config.fields?.some((field) => field.source === 'staff')),
  });
  const plans = useQuery({
    queryKey: ['operation-plans'],
    queryFn: () => api<any[]>('/admin/scheme-plans'),
    enabled: Boolean(config.fields?.some((field) => field.source === 'plans')),
  });
  const enrollments = useQuery({
    queryKey: ['operation-enrollments'],
    queryFn: () => api<any[]>('/admin/enrollments?limit=100'),
    enabled: Boolean(config.fields?.some((field) => field.source === 'enrollments')),
  });

  const references = useMemo(
    () => ({
      customers: customers.data ?? [],
      staff: staff.data ?? [],
      plans: plans.data ?? [],
      enrollments: enrollments.data ?? [],
    }),
    [customers.data, staff.data, plans.data, enrollments.data],
  );
  const save = useMutation({
    mutationFn: () => {
      const body: any = { ...values };
      if (values.amountRupees) {
        body.amountPaise = paise(values.amountRupees);
        delete body.amountRupees;
      }
      if (values.minimumPaymentRupees) {
        body.minimumPaymentPaise = paise(values.minimumPaymentRupees);
        delete body.minimumPaymentRupees;
      }
      if (values.rateRupees) {
        body.ratePerGramPaise = paise(values.rateRupees);
        delete body.rateRupees;
      }
      for (const key of ['durationMonths', 'flexibleMonths', 'capMonths'])
        if (body[key]) body[key] = Number(body[key]);
      body.idempotencyKey = crypto.randomUUID();
      const endpoints: Record<string, string> = {
        'scheme-plans': '/admin/scheme-plans',
        enrollments: '/admin/enrollments',
        'gold-rates': '/admin/gold-rates',
        payments: '/admin/payments/manual',
        'cash-submissions': '/admin/cash-submissions',
        payouts: '/admin/payouts',
      };
      return api(endpoints[module], {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setFormOpen(false);
      setMessage('Saved successfully.');
      setValues({});
      await queryClient.invalidateQueries({ queryKey: [config.endpoint] });
    },
    onError: (requestError) =>
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to save record.'),
  });

  const optionsFor = (field: Field) => {
    if (!field.source) return field.options?.map((value) => ({ value, label: value }));
    return references[field.source].map((record: any) =>
      field.source === 'customers'
        ? { value: record._id, label: `${record.customerCode} · ${record.userId?.name}` }
        : field.source === 'staff'
          ? { value: record.userId?._id, label: `${record.employeeCode} · ${record.userId?.name}` }
          : field.source === 'plans'
            ? { value: record._id, label: `${record.name} · ${record.type}` }
            : { value: record._id, label: `${record.enrollmentNumber} · ${record.schemeType}` },
    );
  };
  const visibleRows = (list.data ?? []).filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Page
      title={config.title}
      subtitle="Validated server-side workflows with audit and transactional financial updates."
      actions={
        config.fields ? (
          <button
            className="primary"
            onClick={() => {
              setValues({
                paymentDate: new Date().toISOString().slice(0, 16),
                submissionDate: new Date().toISOString().slice(0, 16),
                payoutDate: new Date().toISOString().slice(0, 10),
                startDate: new Date().toISOString().slice(0, 10),
                durationMonths: '11',
                status: 'ACTIVE',
              });
              setError('');
              setFormOpen(true);
            }}
          >
            <Plus /> {config.createLabel}
          </button>
        ) : undefined
      }
    >
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <section className="module-overview">
        <article><span><Database /></span><div><small>Total records</small><strong>{list.data?.length ?? 0}</strong><p>In this operational ledger</p></div></article>
        <article><span><ShieldCheck /></span><div><small>Active / successful</small><strong>{list.data?.filter((row) => ['ACTIVE', 'SUCCESS', 'APPROVED', 'COMPLETED'].includes(row.status)).length ?? 0}</strong><p>Completed or enabled records</p></div></article>
        <article><span><Activity /></span><div><small>Pending attention</small><strong>{list.data?.filter((row) => ['PENDING', 'INITIATED'].includes(row.status)).length ?? 0}</strong><p>Requires workflow follow-up</p></div></article>
      </section>
      <Card>
        <div className="list-command-bar"><label className="admin-list-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}`} /></label><span>{visibleRows.length} visible records</span></div>
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
                  {config.columns.map(([, label]) => (
                    <th key={label}>{label}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row._id}>
                    {config.columns.map(([key]) => (
                      <td key={key}>{displayOperationValue(key, getOperationValue(row, key))}</td>
                    ))}
                    <td>
                      <button
                        className="secondary"
                        onClick={() =>
                          navigate(`/admin/${module}/${row._id}`, { state: { record: row } })
                        }
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
      <Modal
        title={config.createLabel ?? 'Create'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="form-grid">
            {config.fields?.map((field) => (
              <label
                className={field.key.includes('Text') || field.key === 'notes' ? 'full' : ''}
                key={field.key}
              >
                <span>{field.label}</span>
                {field.options || field.source ? (
                  <Select
                    required
                    placeholder="Select"
                    value={values[field.key] ?? ''}
                    options={(optionsFor(field) ?? []).map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    onChange={(value) => setValues({ ...values, [field.key]: value })}
                  />
                ) : (
                  <input
                    className="form-control"
                    type={field.type ?? 'text'}
                    required={
                      ![
                        'benefitText',
                        'makingChargeBenefit',
                        'wastageBenefit',
                        'notes',
                        'referenceNumber',
                      ].includes(field.key)
                    }
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          <Notice error>{error}</Notice>
          <button className="primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Confirm and save'}
          </button>
        </form>
      </Modal>
    </Page>
  );
}
