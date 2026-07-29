import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  ReceiptText,
  Smartphone,
} from 'lucide-react';
import { api } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { Page, QueryState, Status, Modal } from '../../../shared/components/ui';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';

const customerName = (record: any) =>
  record?.customerId?.userId?.name ?? record?.customerId?.customerCode ?? '—';
const customerPhone = (record: any) => record?.customerId?.userId?.phone ?? '—';
const schemeLabel = (record: any) =>
  record?.schemeId?.schemePlanId?.name ?? record?.schemeId?.enrollmentNumber ?? '—';

const resolveId = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && '_id' in value)
    return String((value as { _id: string })._id);
  return String(value);
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

export function PhonePeTransactionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const detail = useQuery({
    queryKey: ['admin-phonepe-transaction', id],
    queryFn: () => api<any>(`/admin/phonepe-transactions/${id}`),
    enabled: Boolean(id),
  });
  const record = detail.data;

  const receipt = useQuery({
    queryKey: ['admin-payment-receipt', record?.paymentId],
    queryFn: () => api<any>(`/admin/operation-records/payments/${record!.paymentId}`),
    enabled: Boolean(record?.paymentId && receiptOpen),
  });

  const timeline = useMemo(() => {
    if (!record) return [];
    return [
      {
        title: 'Initiated',
        detail: date(record.createdAt),
        state:
          record.status === 'FAILED'
            ? ('error' as const)
            : record.status === 'SUCCESS'
              ? ('done' as const)
              : ('active' as const),
      },
      {
        title: 'Webhook',
        detail:
          record.webhookStatus === 'PROCESSED'
            ? 'Processed'
            : record.webhookStatus === 'RECEIVED'
              ? 'Received'
              : 'Waiting',
        state:
          record.webhookStatus === 'PROCESSED'
            ? ('done' as const)
            : record.webhookStatus === 'RECEIVED'
              ? ('active' as const)
              : ('pending' as const),
      },
      {
        title: 'Receipt',
        detail:
          record.receiptStatus === 'GENERATED'
            ? record.receiptNumber ?? 'Ready'
            : 'Pending',
        state: record.receiptStatus === 'GENERATED' ? ('done' as const) : ('pending' as const),
      },
    ];
  }, [record]);

  return (
    <Page
      title="PhonePe transaction"
      actions={
        <button className="secondary" onClick={() => navigate('/admin/phonepe-transactions')}>
          <ArrowLeft /> Back
        </button>
      }
    >
      <QueryState
        loading={detail.isLoading}
        error={detail.error}
        empty={!detail.isLoading && !record}
        retry={() => void detail.refetch()}
      >
        {record && (
          <div className="phonepe-detail-stack">
            <section className="phonepe-detail-hero">
              <div className="phonepe-brand-badge">
                <Smartphone />
              </div>
              <div className="phonepe-detail-main">
                <div className="phonepe-detail-title-row">
                  <h2>{money(record.amountPaise)}</h2>
                  <div className="phonepe-detail-badges">
                    <Status value={record.status} />
                    <span className={`phonepe-pill ${record.webhookStatus?.toLowerCase()}`}>
                      Webhook · {record.webhookStatus?.replaceAll('_', ' ')}
                    </span>
                    <span className={`phonepe-pill ${record.receiptStatus?.toLowerCase()}`}>
                      Receipt · {record.receiptStatus}
                    </span>
                  </div>
                </div>
                <p>{record.merchantTransactionId}</p>
              </div>
              <div className="phonepe-detail-actions">
                {record.paymentId && (
                  <button className="secondary" onClick={() => setReceiptOpen(true)}>
                    <ReceiptText /> Receipt
                  </button>
                )}
                {record.checkoutUrl && (
                  <a
                    className="secondary"
                    href={record.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink /> Checkout
                  </a>
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
                <Fact label="Gold weight" value={goldGrams(record.goldWeightMg) ?? '—'} />
                <Fact
                  label="Gold rate"
                  value={
                    record.goldRatePerGramPaise
                      ? `${money(record.goldRatePerGramPaise)}/g`
                      : '—'
                  }
                />
                <Fact label="Created" value={date(record.createdAt)} />
                <Fact
                  label="Expires"
                  value={record.expiresAt ? date(record.expiresAt) : '—'}
                />
              </div>
            </section>

            <section className="phonepe-panel">
              <div className="phonepe-panel-head">
                <h2>Timeline</h2>
              </div>
              <div className="phonepe-timeline">
                {timeline.map((step) => (
                  <article className={`phonepe-timeline-step ${step.state}`} key={step.title}>
                    <span>{step.state === 'done' ? <CheckCircle2 /> : <Clock3 />}</span>
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
                <CopyChip label="Merchant TXN" value={record.merchantTransactionId} />
                <CopyChip label="Provider TXN" value={record.providerTransactionId} />
                <CopyChip label="Order ID" value={record.providerOrderId} />
                <CopyChip label="Receipt" value={record.receiptNumber} />
                <CopyChip label="Idempotency" value={record.idempotencyKey} />
              </div>
            </section>

            {record.webhookEvents?.length > 0 && (
              <section className="phonepe-panel">
                <div className="phonepe-panel-head">
                  <h2>Webhook events</h2>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Event</th>
                        <th>Verified</th>
                        <th>Processed</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.webhookEvents.map((event: any) => (
                        <tr key={event._id}>
                          <td>{date(event.createdAt)}</td>
                          <td>{event.eventType ?? '—'}</td>
                          <td>{event.verified ? 'Yes' : 'No'}</td>
                          <td>{event.processedAt ? date(event.processedAt) : '—'}</td>
                          <td>{event.processingError ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </QueryState>

      <Modal title="Official payment receipt" open={receiptOpen} onClose={() => setReceiptOpen(false)}>
        <QueryState
          loading={receipt.isLoading}
          error={receipt.error}
          retry={() => void receipt.refetch()}
        >
          {receipt.data && <ReceiptSheet payment={receipt.data} title="PhonePe collection receipt" />}
        </QueryState>
      </Modal>
    </Page>
  );
}
