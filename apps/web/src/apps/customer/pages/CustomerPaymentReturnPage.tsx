import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../shared/services/api.client';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';
import { Card, Page, QueryState, Status } from '../../../shared/components/ui';

export function CustomerPaymentReturnPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const order = searchParams.get('order') ?? '';
  const intent = useQuery({
    queryKey: ['customer-payment-intent', order],
    queryFn: () => api<any>(`/customer/payment-intents/${encodeURIComponent(order)}`),
    enabled: Boolean(order),
    refetchInterval: (query) =>
      !query.state.data || query.state.data.status === 'PENDING' ? 2_000 : false,
  });

  useEffect(() => {
    if (intent.data?.status !== 'SUCCESS') return;
    void queryClient.invalidateQueries({ queryKey: ['customer-home'] });
    void queryClient.invalidateQueries({ queryKey: ['/customer/schemes'] });
    void queryClient.invalidateQueries({ queryKey: ['customer-scheme-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
    void queryClient.invalidateQueries({ queryKey: ['customer-payment-preview'] });
  }, [intent.data?.status, queryClient]);

  return (
    <Page title="Payment status" subtitle="PhonePe responses are verified by the server.">
      {!order ? (
        <Card>
          <p>The payment reference is missing. Open payment history to check your account.</p>
          <Link className="primary" to="/customer/payments">
            View payments
          </Link>
        </Card>
      ) : (
        <QueryState
          loading={intent.isLoading}
          error={intent.error}
          retry={() => void intent.refetch()}
        >
          {intent.data && (
            <div className="return-status-stack">
              {intent.data.status === 'SUCCESS' && intent.data.payment ? (
                <Card className="return-receipt-card">
                  <ReceiptSheet payment={intent.data.payment} showPrint />
                </Card>
              ) : (
                <Card title="PhonePe payment" className="stack">
                  <div className="detail-grid">
                    <div className="detail-item">
                      <small>Order</small>
                      <b>{intent.data.merchantTransactionId}</b>
                    </div>
                    <div className="detail-item">
                      <small>Status</small>
                      <Status value={intent.data.status} />
                    </div>
                  </div>
                  {intent.data.status === 'PENDING' && (
                    <p className="helper">
                      Verification is in progress. This page updates automatically.
                    </p>
                  )}
                  {intent.data.status === 'FAILED' && (
                    <p className="form-error">
                      The payment was not completed. No amount was credited.
                    </p>
                  )}
                </Card>
              )}
              <div className="customer-return-actions">
                {intent.data.payment?._id && (
                  <Link
                    className="primary"
                    to={`/customer/payments?receipt=${intent.data.payment._id}`}
                  >
                    Open in passbook
                  </Link>
                )}
                <Link className="secondary" to="/customer">
                  Back to home
                </Link>
              </div>
            </div>
          )}
        </QueryState>
      )}
    </Page>
  );
}
