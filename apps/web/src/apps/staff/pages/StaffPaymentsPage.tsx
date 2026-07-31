import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileEdit,
  Landmark,
  QrCode,
  ReceiptIndianRupee,
  ReceiptText,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';
import { Select } from '../../../shared/components/Select';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { todayRange } from '../../../shared/utils/reportDateRange';
import { StaffDateFilter } from '../components/StaffDateFilter';

type Tab = 'payments' | 'submissions' | 'corrections';

const METHOD_META = {
  CASH: { label: 'Cash', icon: Banknote, tone: 'cash' },
  UPI: { label: 'UPI', icon: QrCode, tone: 'upi' },
  BANK: { label: 'Bank', icon: Landmark, tone: 'bank' },
  CARD: { label: 'Card', icon: CreditCard, tone: 'card' },
} as const;

function inDateRange(iso: string | Date | undefined, from: string, to: string) {
  if (!iso) return false;
  const day = new Date(iso).toISOString().slice(0, 10);
  return day >= from && day <= to;
}

export function StaffPaymentsPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [from, setFrom] = useState(() => todayRange()[0]);
  const [to, setTo] = useState(() => todayRange()[1]);
  const [tab, setTab] = useState<Tab>('payments');
  const [selected, setSelected] = useState<any>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionType, setCorrectionType] = useState('CHANGE_NOTES');
  const [reason, setReason] = useState('');
  const [requestedValue, setRequestedValue] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const payments = useQuery({
    queryKey: ['staff-payments', from, to],
    queryFn: () => api<any[]>(`/staff/payments?from=${from}&to=${to}`),
  });
  const submissions = useQuery({
    queryKey: ['staff-submissions', from, to],
    queryFn: () => api<any[]>(`/staff/cash-submissions?from=${from}&to=${to}`),
  });
  const report = useQuery({
    queryKey: ['staff-collection-report', from, to],
    queryFn: () => api<any>(`/staff/reports/collection?from=${from}&to=${to}`),
  });
  const corrections = useQuery({
    queryKey: ['staff-corrections'],
    queryFn: () => api<any[]>('/staff/corrections'),
  });

  const receiptId = params.get('receipt');
  const activePayment =
    selected ??
    (receiptId ? (payments.data?.find((item) => item._id === receiptId) ?? null) : null);
  const receipt = useQuery({
    queryKey: ['staff-receipt', activePayment?._id],
    queryFn: () => api<any>(`/staff/payments/${activePayment!._id}/receipt`),
    enabled: Boolean(activePayment),
  });

  const correction = useMutation({
    mutationFn: () => {
      const requestedChanges: Record<string, unknown> = {};
      if (requestedValue) {
        if (correctionType === 'CHANGE_AMOUNT')
          requestedChanges.amountPaise = Math.round(Number(requestedValue) * 100);
        if (correctionType === 'CHANGE_METHOD') requestedChanges.method = requestedValue;
        if (correctionType === 'CHANGE_DATE') requestedChanges.paymentDate = requestedValue;
        if (correctionType === 'CHANGE_REFERENCE')
          requestedChanges.referenceNumber = requestedValue;
        if (correctionType === 'CHANGE_NOTES') requestedChanges.notes = requestedValue;
      }
      return api(`/staff/payments/${activePayment!._id}/corrections`, {
        method: 'POST',
        body: JSON.stringify({ correctionType, requestedChanges, reason }),
      });
    },
    onSuccess: async () => {
      setCorrectionOpen(false);
      setMessage('Correction request submitted for admin review.');
      await queryClient.invalidateQueries({ queryKey: ['staff-corrections'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to request correction.',
      ),
  });

  const closeReceipt = () => {
    setSelected(null);
    if (receiptId) {
      params.delete('receipt');
      setParams(params, { replace: true });
    }
  };

  const byMethod = report.data?.byMethod ?? [];
  const methodTotal = (method: string) =>
    byMethod.find((row: any) => row.method === method)?.totalPaise ?? 0;
  const methodCount = (method: string) =>
    byMethod.find((row: any) => row.method === method)?.count ?? 0;

  const filteredCorrections = useMemo(
    () =>
      (corrections.data ?? []).filter((item) =>
        inDateRange(item.createdAt ?? item.updatedAt, from, to),
      ),
    [corrections.data, from, to],
  );

  const openCorrectionsInRange = filteredCorrections.filter(
    (item) => item.status === 'PENDING',
  ).length;

  const totalCollected = report.data?.collectionPaise ?? 0;
  const paymentCount = report.data?.paymentCount ?? payments.data?.length ?? 0;
  const cashWithStaff = report.data?.cashWithStaffPaise ?? 0;

  return (
    <Page title="Payments" subtitle="Collections and submissions for the selected period.">
      <Notice>{message}</Notice>

      <div className="staff-payments-page">
        <StaffDateFilter from={from} to={to} onChange={(nextFrom, nextTo) => {
          setFrom(nextFrom);
          setTo(nextTo);
        }} />

        <section className="staff-payments-summary">
          <div>
            <span>
              <ReceiptIndianRupee />
            </span>
            <small>Collected</small>
            <b>{money(totalCollected)}</b>
          </div>
          <div>
            <span>
              <ReceiptText />
            </span>
            <small>Payments</small>
            <b>{paymentCount}</b>
          </div>
          <div>
            <span>
              <Wallet />
            </span>
            <small>Cash with you</small>
            <b>{money(cashWithStaff)}</b>
          </div>
        </section>

        <section className="staff-method-list">
          <div className="staff-method-list-head">
            <h2>Payment type split</h2>
            {openCorrectionsInRange > 0 ? (
              <small>{openCorrectionsInRange} open correction{openCorrectionsInRange === 1 ? '' : 's'}</small>
            ) : null}
          </div>
          <div className="staff-method-rows">
            {(['CASH', 'UPI', 'BANK', 'CARD'] as const).map((method) => {
              const meta = METHOD_META[method];
              const Icon = meta.icon;
              const total = methodTotal(method);
              const count = methodCount(method);
              return (
                <div className={`staff-method-row ${meta.tone}`} key={method}>
                  <span>
                    <Icon />
                  </span>
                  <div>
                    <b>{meta.label}</b>
                    <small>
                      {count} payment{count === 1 ? '' : 's'}
                    </small>
                  </div>
                  <strong>{money(total)}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <div className="segmented-tabs staff-payments-tabs" role="tablist">
          <button
            type="button"
            className={tab === 'payments' ? 'active' : ''}
            onClick={() => setTab('payments')}
          >
            <ReceiptText /> Payments
          </button>
          <button
            type="button"
            className={tab === 'submissions' ? 'active' : ''}
            onClick={() => setTab('submissions')}
          >
            <WalletCards /> Submissions
          </button>
          <button
            type="button"
            className={tab === 'corrections' ? 'active' : ''}
            onClick={() => setTab('corrections')}
          >
            <FileEdit /> Corrections
          </button>
        </div>

        {tab === 'payments' && (
          <QueryState
            loading={payments.isLoading || report.isLoading}
            error={payments.error ?? report.error}
            empty={!payments.isLoading && !payments.data?.length}
            retry={() => {
              void payments.refetch();
              void report.refetch();
            }}
          >
            <div className="passbook-ledger">
              {payments.data?.map((payment) => {
                const customerName =
                  payment.customerId?.userId?.name ??
                  payment.customerId?.customerCode ??
                  'Customer';
                const customerCode = payment.customerId?.customerCode;
                const enrollment = payment.schemeId?.enrollmentNumber;
                return (
                  <button
                    key={payment._id}
                    type="button"
                    className="passbook-entry"
                    onClick={() => setSelected(payment)}
                  >
                    <div className="passbook-entry-top">
                      <span className="ledger-status" aria-hidden="true">
                        <CheckCircle2 />
                      </span>
                      <div className="passbook-entry-copy">
                        <b>{customerName}</b>
                        <small>
                          {date(payment.paymentDate)} ·{' '}
                          {payment.method === 'PHONEPE' ? 'UPI' : payment.method}
                          {customerCode ? ` · ${customerCode}` : ''}
                        </small>
                      </div>
                      <div className="passbook-entry-value">
                        <strong>{money(payment.amountPaise)}</strong>
                        {payment.goldWeightMg ? (
                          <small>{goldGrams(payment.goldWeightMg)}</small>
                        ) : (
                          <Status value={payment.status} />
                        )}
                      </div>
                    </div>
                    <div className="passbook-entry-footer">
                      <em>
                        {payment.receiptNumber ?? 'Pending receipt'}
                        {enrollment ? ` · ${enrollment}` : ''}
                      </em>
                      <span>
                        Receipt
                        <ChevronRight />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </QueryState>
        )}

        {tab === 'submissions' && (
          <QueryState
            loading={submissions.isLoading}
            error={submissions.error}
            empty={!submissions.isLoading && !submissions.data?.length}
            retry={() => void submissions.refetch()}
          >
            <div className="passbook-ledger">
              {submissions.data?.map((item) => (
                <article className="passbook-entry" key={item._id}>
                  <div className="passbook-entry-top">
                    <span className="transaction-icon">
                      <WalletCards />
                    </span>
                    <div className="passbook-entry-copy">
                      <b>{date(item.submissionDate)}</b>
                      <small>{item.notes ?? 'Marked by administrator'}</small>
                    </div>
                    <div className="passbook-entry-value">
                      <strong>{money(item.amountPaise)}</strong>
                      <Status value={item.status} />
                    </div>
                  </div>
                  <div className="passbook-entry-footer">
                    <em className="cash">Cash submission</em>
                    <span>Recorded</span>
                  </div>
                </article>
              ))}
            </div>
          </QueryState>
        )}

        {tab === 'corrections' && (
          <QueryState
            loading={corrections.isLoading}
            error={corrections.error}
            empty={!corrections.isLoading && !filteredCorrections.length}
            retry={() => void corrections.refetch()}
          >
            <div className="passbook-ledger">
              {filteredCorrections.map((item) => (
                <article className="passbook-entry" key={item._id}>
                  <div className="passbook-entry-top">
                    <span className="transaction-icon">
                      <FileEdit />
                    </span>
                    <div className="passbook-entry-copy">
                      <b>{item.correctionType.replaceAll('_', ' ')}</b>
                      <small>{item.reason}</small>
                    </div>
                    <div className="passbook-entry-value">
                      <Status value={item.status} />
                    </div>
                  </div>
                  <div className="passbook-entry-footer">
                    <em className="cash">
                      {item.createdAt ? date(item.createdAt) : 'Correction request'}
                    </em>
                    <span>Details</span>
                  </div>
                </article>
              ))}
            </div>
          </QueryState>
        )}
      </div>

      <Modal title="Official payment receipt" open={Boolean(activePayment)} onClose={closeReceipt}>
        <QueryState
          loading={receipt.isLoading}
          error={receipt.error}
          retry={() => void receipt.refetch()}
        >
          {receipt.data?.payment ? (
            <ReceiptSheet
              payment={receipt.data.payment}
              title="Collection receipt"
              amountLabel="Amount collected"
              actions={
                <button
                  type="button"
                  className="secondary wide-action"
                  onClick={() => {
                    setError('');
                    setCorrectionOpen(true);
                  }}
                >
                  Request correction
                </button>
              }
            />
          ) : null}
        </QueryState>
      </Modal>

      <Modal
        title="Request payment correction"
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            correction.mutate();
          }}
        >
          <label>
            <span>Correction type</span>
            <Select
              value={correctionType}
              options={[
                'CHANGE_AMOUNT',
                'CHANGE_METHOD',
                'CHANGE_DATE',
                'CHANGE_REFERENCE',
                'CHANGE_NOTES',
                'REVERSE_PAYMENT',
              ].map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
              onChange={setCorrectionType}
            />
          </label>
          {correctionType !== 'REVERSE_PAYMENT' && (
            <label>
              <span>Requested value</span>
              <input
                className="form-control"
                required
                value={requestedValue}
                onChange={(event) => setRequestedValue(event.target.value)}
              />
            </label>
          )}
          <label>
            <span>Reason</span>
            <textarea
              className="form-control"
              minLength={5}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <Notice error>{error}</Notice>
          <button className="primary wide-action" disabled={correction.isPending}>
            Submit for admin review
          </button>
        </form>
      </Modal>
    </Page>
  );
}
