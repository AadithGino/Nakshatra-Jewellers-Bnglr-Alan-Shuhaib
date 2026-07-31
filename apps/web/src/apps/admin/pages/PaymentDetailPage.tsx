import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  ReceiptText,
  RotateCcw,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';

const customerName = (record: any) =>
  record?.customerId?.userId?.name ?? record?.customerId?.customerCode ?? '—';
const customerPhone = (record: any) => record?.customerId?.userId?.phone ?? '—';
const schemeLabel = (record: any) =>
  record?.schemeId?.schemePlanId?.name ?? record?.schemeId?.enrollmentNumber ?? '—';
const collectorName = (record: any) => record?.collectedBy?.name ?? record?.collectorRole ?? '—';

const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
};

const methodLabel = (method?: string) => {
  if (method === 'CASH') return 'Cash';
  if (method === 'PHONEPE' || method === 'UPI') return 'UPI';
  if (method === 'BANK') return 'Bank';
  if (method === 'CARD') return 'Card';
  return method ?? '—';
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="phonepe-fact">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function CopyChip({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <button
      type="button"
      className="phonepe-copy-chip"
      title={`Copy ${label}`}
      onClick={() => void navigator.clipboard.writeText(value)}
    >
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
      <Copy />
    </button>
  );
}

export function PaymentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const detail = useQuery({
    queryKey: ['admin-payment', id],
    queryFn: () => api<any>(`/admin/payments/${id}`),
    enabled: Boolean(id),
  });
  const record = detail.data;

  const reverse = useMutation({
    mutationFn: (reason: string) =>
      api(`/admin/payments/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setMessage('Payment reversed successfully.');
      await queryClient.invalidateQueries({ queryKey: ['admin-payment', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to reverse payment.',
      ),
  });

  const timeline = useMemo(() => {
    if (!record) return [];
    const steps = [
      {
        title: 'Recorded',
        detail: date(record.paymentDate),
        state: record.status === 'REVERSED' ? ('error' as const) : ('done' as const),
      },
      {
        title: 'Receipt',
        detail: record.receiptNumber ?? 'Pending',
        state: record.receiptNumber ? ('done' as const) : ('pending' as const),
      },
    ];
    if (record.status === 'REVERSED') {
      steps.push({
        title: 'Reversed',
        detail: record.reversedAt ? date(record.reversedAt) : 'Reversed',
        state: 'error' as const,
      });
    }
    return steps;
  }, [record]);

  const handleReverse = () => {
    const reason = window.prompt('Reason for payment reversal');
    if (!reason?.trim()) return;
    reverse.mutate(reason.trim());
  };

  return (
    <Page
      title="Payment"
      actions={
        <button className="secondary" onClick={() => navigate('/admin/payments')}>
          <ArrowLeft /> Back
        </button>
      }
    >
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        empty={!detail.isLoading && !record}
        retry={() => void detail.refetch()}
      >
        {record && (
          <div className="phonepe-detail-stack">
            <section className="phonepe-detail-hero">
              <div className="phonepe-brand-badge payment">
                <ReceiptText />
              </div>
              <div className="phonepe-detail-main">
                <div className="phonepe-detail-title-row">
                  <h2>{money(record.amountPaise)}</h2>
                  <div className="phonepe-detail-badges">
                    <Status value={record.status} />
                    <span className="phonepe-pill">{methodLabel(record.method)}</span>
                    {record.receiptNumber && (
                      <span className="phonepe-pill generated">
                        Receipt · {record.receiptNumber}
                      </span>
                    )}
                  </div>
                </div>
                <p>{record.receiptNumber ?? record.merchantTransactionId ?? record._id}</p>
              </div>
              <div className="phonepe-detail-actions">
                {(record.status === 'SUCCESS' || record.status === 'REVERSED') && (
                  <button className="secondary" onClick={() => setReceiptOpen(true)}>
                    <ReceiptText /> Receipt
                  </button>
                )}
                {record.status === 'SUCCESS' && (
                  <button className="danger" onClick={handleReverse} disabled={reverse.isPending}>
                    <RotateCcw /> Reverse
                  </button>
                )}
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-facts-row">
                <button
                  type="button"
                  className="phonepe-fact link"
                  onClick={() => {
                    const customer = resolveId(record.customerId);
                    if (customer) navigate(`/admin/customers/${customer}`);
                  }}
                >
                  <small>Customer</small>
                  <b>{customerName(record)}</b>
                  <em>{customerPhone(record)}</em>
                </button>
                <button
                  type="button"
                  className="phonepe-fact link"
                  onClick={() => {
                    const enrollment = resolveId(record.schemeId);
                    if (enrollment) navigate(`/admin/enrollments/${enrollment}`);
                  }}
                >
                  <small>Scheme</small>
                  <b>{schemeLabel(record)}</b>
                  <em>{record.schemeId?.enrollmentNumber ?? '—'}</em>
                </button>
                <Fact label="Collector" value={collectorName(record)} />
                <Fact label="Gold weight" value={goldGrams(record.goldWeightMg) ?? '—'} />
                <Fact
                  label="Gold rate"
                  value={
                    record.goldRatePerGramPaise
                      ? `${money(record.goldRatePerGramPaise)}/g`
                      : '—'
                  }
                />
                <Fact label="Scheme month" value={String(record.schemeMonth ?? '—')} />
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Timeline</h2>
              </div>
              <div className="phonepe-timeline">
                {timeline.map((step) => (
                  <article className={`phonepe-timeline-step ${step.state}`} key={step.title}>
                    <span>
                      {step.state === 'done' ? <CheckCircle2 /> : <Clock3 />}
                    </span>
                    <div>
                      <b>{step.title}</b>
                      <small>{step.detail}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Reference IDs</h2>
              </div>
              <div className="phonepe-copy-list">
                <CopyChip label="Receipt" value={record.receiptNumber} />
                <CopyChip label="Reference" value={record.referenceNumber} />
                <CopyChip label="Merchant TXN" value={record.merchantTransactionId} />
                <CopyChip label="Provider TXN" value={record.providerTransactionId} />
                <CopyChip label="Idempotency" value={record.idempotencyKey} />
              </div>
              {record.notes && (
                <p className="helper" style={{ marginTop: 10 }}>
                  Notes: {record.notes}
                </p>
              )}
              {record.reversalReason && (
                <p className="helper" style={{ marginTop: 6 }}>
                  Reversal reason: {record.reversalReason}
                </p>
              )}
            </section>
          </div>
        )}
      </QueryState>

      <Modal title="Official payment receipt" open={receiptOpen} onClose={() => setReceiptOpen(false)}>
        {record && <ReceiptSheet payment={record} title="Collection receipt" />}
      </Modal>
    </Page>
  );
}
