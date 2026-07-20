import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  FileEdit,
  HandCoins,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

type Tab = 'payments' | 'submissions' | 'corrections';

export function StaffPaymentsPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('payments');
  const [selected, setSelected] = useState<any>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionType, setCorrectionType] = useState('CHANGE_NOTES');
  const [reason, setReason] = useState('');
  const [requestedValue, setRequestedValue] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const payments = useQuery({
    queryKey: ['staff-payments'],
    queryFn: () => api<any[]>('/staff/payments'),
  });
  const submissions = useQuery({
    queryKey: ['staff-submissions'],
    queryFn: () => api<any[]>('/staff/cash-submissions'),
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
  const todayTotal =
    payments.data
      ?.filter(
        (item) =>
          new Date(item.paymentDate).toDateString() === new Date().toDateString() &&
          item.status === 'SUCCESS',
      )
      .reduce((sum, item) => sum + item.amountPaise, 0) ?? 0;
  const openCorrections =
    corrections.data?.filter((item) => item.status === 'PENDING').length ?? 0;

  return (
    <Page
      title="Payment activity"
      subtitle="Receipts, cash submissions and correction requests."
    >
      <Notice>{message}</Notice>

      <div className="staff-payment-summary">
        <article>
          <span>
            <HandCoins />
          </span>
          <div>
            <small>Collected today</small>
            <strong>{money(todayTotal)}</strong>
          </div>
        </article>
        <article>
          <span>
            <ReceiptText />
          </span>
          <div>
            <small>Total receipts</small>
            <strong>{payments.data?.length ?? 0}</strong>
          </div>
        </article>
        <article>
          <span>
            <FileEdit />
          </span>
          <div>
            <small>Open corrections</small>
            <strong>{openCorrections}</strong>
          </div>
        </article>
      </div>

      <div className="segmented-tabs" role="tablist">
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
          <WalletCards /> Cash status
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
          loading={payments.isLoading}
          error={payments.error}
          empty={!payments.isLoading && !payments.data?.length}
          retry={() => void payments.refetch()}
        >
          <div className="passbook-ledger">
            {payments.data?.map((payment) => (
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
                    <b>{payment.receiptNumber ?? 'Pending receipt'}</b>
                    <small>
                      {date(payment.paymentDate)} · {payment.method}
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
                  {payment.goldWeightMg ? (
                    <em>{goldGrams(payment.goldWeightMg)} credited</em>
                  ) : (
                    <em className="cash">Cash contribution</em>
                  )}
                  <span>
                    Receipt
                    <ChevronRight />
                  </span>
                </div>
              </button>
            ))}
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
          empty={!corrections.isLoading && !corrections.data?.length}
          retry={() => void corrections.refetch()}
        >
          <div className="passbook-ledger">
            {corrections.data?.map((item) => (
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
                  <em className="cash">Correction request</em>
                  <span>Details</span>
                </div>
              </article>
            ))}
          </div>
        </QueryState>
      )}

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
            <select
              className="form-control"
              value={correctionType}
              onChange={(event) => setCorrectionType(event.target.value)}
            >
              {[
                'CHANGE_AMOUNT',
                'CHANGE_METHOD',
                'CHANGE_DATE',
                'CHANGE_REFERENCE',
                'CHANGE_NOTES',
                'REVERSE_PAYMENT',
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
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
