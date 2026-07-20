import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Gem,
  ReceiptText,
  Search,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../shared/services/api.client';
import { date, goldGrams, money } from '../../../shared/utils/format';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';
import { Modal, Page, QueryState, Status } from '../../../shared/components/ui';

export function CustomerPaymentsPage() {
  const [params] = useSearchParams();
  const [paymentId, setPaymentId] = useState(params.get('receipt') ?? '');
  const [search, setSearch] = useState('');
  const payments = useQuery({
    queryKey: ['customer-payments'],
    queryFn: () => api<any[]>('/customer/payments'),
  });
  const receipt = useQuery({
    queryKey: ['customer-receipt', paymentId],
    queryFn: () => api<any>(`/customer/payments/${paymentId}/receipt`),
    enabled: Boolean(paymentId),
  });
  const visible = useMemo(
    () =>
      payments.data?.filter((item) =>
        `${item.receiptNumber ?? ''} ${item.method} ${item.amountPaise}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ) ?? [],
    [payments.data, search],
  );
  const total =
    payments.data
      ?.filter((item) => item.status === 'SUCCESS')
      .reduce((sum, item) => sum + item.amountPaise, 0) ?? 0;
  const payment = receipt.data?.payment;

  return (
    <Page title="Payments" subtitle="Your digital passbook and official receipts.">
      <QueryState
        loading={payments.isLoading}
        error={payments.error}
        empty={!payments.isLoading && !payments.data?.length}
        retry={() => void payments.refetch()}
      >
        <div className="payments-page-stack">
          <section className="passbook-summary">
            <div>
              <span className="passbook-icon">
                <ReceiptText />
              </span>
              <div>
                <small>Total successful contributions</small>
                <strong>{money(total)}</strong>
                <p>{payments.data?.length ?? 0} payment records</p>
              </div>
            </div>
            <CheckCircle2 />
          </section>

          <div className="mobile-search">
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search receipt or payment method"
            />
          </div>

          <div className="section-heading">
            <div>
              <span>Passbook entries</span>
              <h2>Payment history</h2>
            </div>
            <small>{visible.length} records</small>
          </div>

          <div className="passbook-ledger">
            {visible.map((item) => {
              const isGold = Boolean(item.goldWeightMg);
              return (
                <button
                  key={item._id}
                  type="button"
                  className="passbook-entry"
                  onClick={() => setPaymentId(item._id)}
                >
                  <div className="passbook-entry-top">
                    <span className="ledger-status" aria-hidden="true">
                      <CheckCircle2 />
                    </span>
                    <div className="passbook-entry-copy">
                      <b>{item.receiptNumber ?? item.merchantTransactionId ?? 'Processing'}</b>
                      <small>
                        <CalendarDays />
                        {date(item.paymentDate)} · {item.method}
                      </small>
                    </div>
                    <div className="passbook-entry-value">
                      <strong>{money(item.amountPaise)}</strong>
                      {isGold ? (
                        <small>{goldGrams(item.goldWeightMg)}</small>
                      ) : (
                        <Status value={item.status} />
                      )}
                    </div>
                  </div>

                  <div className="passbook-entry-footer">
                    {item.goldRatePerGramPaise ? (
                      <em>
                        <Gem />
                        916 rate {money(item.goldRatePerGramPaise)}/g
                      </em>
                    ) : (
                      <em className="cash">Cash contribution</em>
                    )}
                    <span>
                      Receipt
                      <ChevronRight />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </QueryState>

      <Modal
        title="Official payment receipt"
        open={Boolean(paymentId)}
        onClose={() => setPaymentId('')}
      >
        <QueryState
          loading={receipt.isLoading}
          error={receipt.error}
          retry={() => void receipt.refetch()}
        >
          {payment ? <ReceiptSheet payment={payment} /> : null}
        </QueryState>
      </Modal>
    </Page>
  );
}
