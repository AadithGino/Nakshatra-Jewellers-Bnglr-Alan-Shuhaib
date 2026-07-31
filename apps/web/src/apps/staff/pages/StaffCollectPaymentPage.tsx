import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Banknote,
  CreditCard,
  ExternalLink,
  Landmark,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { goldGrams, money } from '../../../shared/utils/format';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';
import { Modal, Notice, QueryState } from '../../../shared/components/ui';

const toPaise = (value: string) => Math.round(Number(value) * 100);

const METHODS = [
  { id: 'CASH' as const, label: 'Cash', icon: Banknote },
  { id: 'UPI' as const, label: 'UPI', icon: QrCode },
  { id: 'BANK' as const, label: 'Bank', icon: Landmark },
  { id: 'CARD' as const, label: 'Card', icon: CreditCard },
];

export function StaffCollectPaymentPage() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customerId, setCustomerId] = useState(params.get('customer') ?? '');
  const [amount, setAmount] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [phonePeOrderId, setPhonePeOrderId] = useState('');
  const [upiModalOpen, setUpiModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [receipt, setReceipt] = useState<any>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedAmount(amount), 280);
    return () => window.clearTimeout(timer);
  }, [amount]);

  const customers = useQuery({
    queryKey: ['collect-customers', debouncedSearch],
    queryFn: () => api<any[]>(`/staff/customers?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: !customerId && !receipt,
  });
  const customer = useQuery({
    queryKey: ['collect-customer', customerId],
    queryFn: () => api<any>(`/staff/customers/${customerId}`),
    enabled: Boolean(customerId),
  });

  const activeScheme =
    customer.data?.schemes?.find((scheme: any) => scheme.status === 'ACTIVE') ?? null;
  const schemeId = activeScheme?._id ?? '';
  const selectedCustomer = customer.data?.customer;
  const isGold = activeScheme?.schemeType === 'GOLD_WEIGHT';
  const amountPaise = Number(debouncedAmount) > 0 ? toPaise(debouncedAmount) : 0;

  const preview = useQuery({
    queryKey: ['payment-preview', schemeId, amountPaise],
    queryFn: () =>
      api<any>(`/staff/schemes/${schemeId}/payment-preview?amountPaise=${amountPaise}`),
    enabled: Boolean(schemeId && amountPaise > 0),
    retry: false,
    placeholderData: (previous) => previous,
  });

  const collect = useMutation({
    mutationFn: () =>
      api<any>('/staff/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          schemeId,
          amountPaise: toPaise(amount),
          method,
          paymentDate: new Date().toISOString(),
          referenceNumber: referenceNumber || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    onSuccess: (data) => {
      setReceipt(data);
      setAmount('');
      setDebouncedAmount('');
      setReferenceNumber('');
      setError('');
      setInfo('');
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Payment collection failed.',
      ),
  });

  const initiatePhonePe = useMutation({
    mutationFn: () =>
      api<any>('/staff/payments/phonepe', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          schemeId,
          amountPaise: toPaise(amount),
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    onSuccess: (data) => {
      setPhonePeOrderId(String(data.merchantTransactionId));
      setUpiModalOpen(true);
      setError('');
      setInfo('');
    },
    onError: (requestError) => {
      setUpiModalOpen(false);
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to create UPI QR.');
    },
  });

  const phonePeIntent = useQuery({
    queryKey: ['staff-phonepe-intent', phonePeOrderId],
    queryFn: () => api<any>(`/staff/payment-intents/${encodeURIComponent(phonePeOrderId)}`),
    enabled: Boolean(phonePeOrderId),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ||
      query.state.data?.status === 'INITIATED' ||
      (query.state.data?.status === 'SUCCESS' && !query.state.data?.payment)
        ? 2_000
        : false,
  });

  useEffect(() => {
    if (!phonePeIntent.data) return;
    if (phonePeIntent.data.status === 'SUCCESS' && phonePeIntent.data.payment) {
      setReceipt(phonePeIntent.data.payment);
      setAmount('');
      setDebouncedAmount('');
      setReferenceNumber('');
      setPhonePeOrderId('');
      setUpiModalOpen(false);
      setError('');
      setInfo('');
      void queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
      return;
    }
    if (phonePeIntent.data.status === 'SUCCESS' && !phonePeIntent.data.payment) {
      setInfo('Payment received. Finalizing receipt…');
      return;
    }
    if (
      ['FAILED', 'CANCELLED', 'EXPIRED'].includes(String(phonePeIntent.data.status)) &&
      !error
    ) {
      setError('UPI payment did not complete. You can retry with a new QR.');
      setInfo('');
      setPhonePeOrderId('');
      setUpiModalOpen(false);
    }
  }, [phonePeIntent.data, error, queryClient]);

  const resetCustomer = () => {
    setCustomerId('');
    setAmount('');
    setDebouncedAmount('');
    setReferenceNumber('');
    setPhonePeOrderId('');
    setUpiModalOpen(false);
    setError('');
    setInfo('');
    setReceipt(null);
    setSearch('');
  };

  const closeUpiModal = () => {
    setUpiModalOpen(false);
    setPhonePeOrderId('');
    setInfo('');
  };

  const needsReference = method !== 'CASH' && method !== 'UPI';
  const isUpiQr = method === 'UPI';
  const phonePeCheckoutUrl = phonePeIntent.data?.checkoutUrl ?? '';
  const phonePeQrSrc = phonePeCheckoutUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(phonePeCheckoutUrl)}`
    : '';
  const phonePeStatus = String(phonePeIntent.data?.status ?? '');
  const phonePeStateLabel =
    phonePeStatus === 'INITIATED'
      ? 'Initiated'
      : phonePeStatus === 'PENDING'
        ? 'Awaiting payment'
        : phonePeStatus === 'SUCCESS'
          ? 'Paid'
          : phonePeStatus === 'FAILED'
            ? 'Failed'
            : phonePeStatus === 'CANCELLED'
              ? 'Cancelled'
              : phonePeStatus === 'EXPIRED'
                ? 'Expired'
                : 'Not started';
  const phonePeIsPending = ['PENDING', 'INITIATED'].includes(phonePeStatus);
  const canCollect =
    Boolean(customerId && schemeId && Number(amount) > 0 && preview.data && !preview.isError);

  if (receipt) {
    return (
      <div className="collect-screen v2">
        <header className="collect-top">
          <div>
            <p>Payment recorded</p>
            <h1>Receipt ready</h1>
          </div>
        </header>
        <section className="collect-receipt-card">
          <ReceiptSheet
            payment={receipt}
            title="Collection receipt"
            amountLabel="Amount collected"
            showPrint
            actions={
              <button type="button" className="primary wide-action" onClick={resetCustomer}>
                Collect another
              </button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="collect-screen v2">
      <header className="collect-top">
        <div>
          <h1>Collect</h1>
          <p>{customerId ? 'Enter amount and method' : 'Search customer to start'}</p>
        </div>
        {customerId ? (
          <button type="button" className="collect-change" onClick={resetCustomer}>
            Change
          </button>
        ) : null}
      </header>

      {!customerId ? (
        <section className="collect-search-panel">
          <div className="mobile-search">
            <Search />
            <input
              value={search}
              autoFocus
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, phone or customer ID"
            />
          </div>
          <QueryState
            loading={customers.isLoading}
            error={customers.error}
            empty={!customers.isLoading && !customers.data?.length}
            retry={() => void customers.refetch()}
          >
            <div className="collect-customer-list">
              {customers.data?.slice(0, 5).map((item) => (
                <button
                  type="button"
                  key={item._id}
                  onClick={() => {
                    setCustomerId(item._id);
                    setReceipt(null);
                    setPhonePeOrderId('');
                    setError('');
                    setInfo('');
                  }}
                >
                  <span className="directory-avatar">
                    <UserRound />
                  </span>
                  <div>
                    <b>{item.userId?.name}</b>
                    <small>
                      {item.customerCode} · {item.userId?.phone}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          </QueryState>
        </section>
      ) : (
        <form
          className="collect-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setError('');
            if (!canCollect) return;
            if (isUpiQr) {
              setUpiModalOpen(true);
              initiatePhonePe.mutate();
              return;
            }
            collect.mutate();
          }}
        >
          <QueryState
            loading={customer.isLoading}
            error={customer.error}
            empty={!customer.isLoading && !activeScheme}
            retry={() => void customer.refetch()}
          >
            {activeScheme && (
              <>
                <section className="collect-card">
                  <div className="collect-card-head">
                    <span className="directory-avatar">
                      <UserRound />
                    </span>
                    <div>
                      <b>{selectedCustomer?.userId?.name ?? 'Customer'}</b>
                      <small>
                        {selectedCustomer?.customerCode} · {selectedCustomer?.userId?.phone}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="collect-clear"
                      onClick={resetCustomer}
                      aria-label="Clear customer"
                    >
                      <X />
                    </button>
                  </div>
                  <div className={`collect-card-stats ${isGold ? 'gold' : 'cash'}`}>
                    <div>
                      <small>Scheme</small>
                      <b>{activeScheme.enrollmentNumber}</b>
                    </div>
                    <div>
                      <small>Paid</small>
                      <b>{money(activeScheme.totalPaidPaise ?? 0)}</b>
                    </div>
                    {isGold ? (
                      <div>
                        <small>Gold</small>
                        <b>{((activeScheme.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g</b>
                      </div>
                    ) : null}
                  </div>
                </section>

                <label className="collect-amount">
                  <span>Amount</span>
                  <div>
                    <em>₹</em>
                    <input
                      inputMode="decimal"
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      autoFocus
                      placeholder="0"
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value);
                        setPhonePeOrderId('');
                        setUpiModalOpen(false);
                        setInfo('');
                      }}
                    />
                  </div>
                </label>

                <div className="collect-method-row">
                  {METHODS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={method === option.id ? 'active' : ''}
                        onClick={() => {
                          setMethod(option.id);
                          setPhonePeOrderId('');
                          setUpiModalOpen(false);
                          setInfo('');
                        }}
                      >
                        <Icon />
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {needsReference && (
                  <label className="collect-reference">
                    <span>Reference number</span>
                    <input
                      className="form-control"
                      required
                      value={referenceNumber}
                      onChange={(event) => setReferenceNumber(event.target.value)}
                      placeholder="Bank / card ref"
                    />
                  </label>
                )}

                {amountPaise > 0 ? (
                  <section className="collect-preview-lite">
                    {preview.isFetching && !preview.data ? (
                      <p>Checking contribution…</p>
                    ) : preview.error ? (
                      <Notice error>
                        {preview.error instanceof Error
                          ? preview.error.message
                          : 'Unable to preview payment.'}
                      </Notice>
                    ) : (
                      <div className="collect-preview-lite-grid">
                        <div>
                          <small>Collecting</small>
                          <b>{money(amountPaise)}</b>
                        </div>
                        {isGold && preview.data?.goldRatePerGramPaise ? (
                          <div>
                            <small>916 rate</small>
                            <b>{money(preview.data.goldRatePerGramPaise)}/g</b>
                          </div>
                        ) : null}
                        {isUpiQr ? (
                          <div>
                            <small>Method</small>
                            <b>UPI QR</b>
                          </div>
                        ) : isGold && preview.data?.goldWeightMg ? (
                          <div>
                            <small>Gold credit</small>
                            <b>{goldGrams(preview.data.goldWeightMg)}</b>
                          </div>
                        ) : (
                          <div>
                            <small>Type</small>
                            <b>Cash</b>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                ) : null}
              </>
            )}
          </QueryState>

          {!customer.isLoading && customerId && !activeScheme ? (
            <Notice error>No active scheme. Enroll this customer before collecting.</Notice>
          ) : null}

          <Notice>{info}</Notice>
          <Notice error>{error}</Notice>

          <div className="collect-footer">
            <button
              type="submit"
              className="primary wide-action collect-submit"
              disabled={
                collect.isPending ||
                initiatePhonePe.isPending ||
                !canCollect ||
                (!isUpiQr && needsReference && !referenceNumber)
              }
            >
              {collect.isPending || initiatePhonePe.isPending
                ? 'Working…'
                : isUpiQr
                  ? 'Collect with UPI QR'
                  : 'Collect payment'}
            </button>
            {preview.data && amountPaise > 0 ? (
              <small>
                <ReceiptText />
                {isUpiQr ? 'QR opens after you tap collect' : 'Receipt generates instantly'}
              </small>
            ) : (
              <small>Enter an amount to enable collection</small>
            )}
          </div>
        </form>
      )}

      <Modal title="Scan to pay" open={upiModalOpen} onClose={closeUpiModal}>
        <div className="upi-qr-modal">
          {initiatePhonePe.isPending ||
          (phonePeOrderId && (phonePeIntent.isLoading || !phonePeIntent.data)) ? (
            <div className="upi-qr-modal-loading">
              <RefreshCw className="spin" />
              <p>Generating UPI QR…</p>
            </div>
          ) : phonePeOrderId && phonePeIntent.data ? (
            <>
              <div className="upi-qr-modal-hero">
                <strong>{money(toPaise(amount) || amountPaise)}</strong>
                <span className={`upi-qr-status-pill ${phonePeIsPending ? 'pending' : ''}`}>
                  {phonePeStateLabel}
                </span>
              </div>
              <p className="upi-qr-modal-customer">
                {selectedCustomer?.userId?.name ?? 'Customer'}
                {selectedCustomer?.customerCode ? ` · ${selectedCustomer.customerCode}` : ''}
              </p>

              <div className="upi-qr-modal-frame">
                {phonePeQrSrc ? (
                  <img src={phonePeQrSrc} alt="UPI payment QR" />
                ) : (
                  <div className="upi-qr-modal-empty">QR is preparing…</div>
                )}
              </div>

              <p className="upi-qr-modal-hint">
                {phonePeIsPending
                  ? 'Ask the customer to scan with any UPI app.'
                  : info || 'Payment not completed. Generate a new QR to retry.'}
              </p>
              <code className="upi-qr-modal-order">{phonePeIntent.data.merchantTransactionId}</code>

              <div className="upi-qr-modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void phonePeIntent.refetch()}
                >
                  <RefreshCw size={16} /> Refresh status
                </button>
                {phonePeCheckoutUrl ? (
                  <a
                    href={phonePeCheckoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary"
                  >
                    <ExternalLink size={16} /> Open checkout
                  </a>
                ) : null}
              </div>

              <button
                type="button"
                className="primary wide-action upi-qr-regenerate"
                disabled={initiatePhonePe.isPending}
                onClick={() => {
                  setPhonePeOrderId('');
                  setInfo('');
                  initiatePhonePe.mutate();
                }}
              >
                <QrCode size={16} />
                {initiatePhonePe.isPending ? 'Generating new QR…' : 'Generate new QR'}
              </button>
            </>
          ) : (
            <div className="upi-qr-modal-loading">
              <RefreshCw className="spin" />
              <p>Preparing payment…</p>
            </div>
          )}

          <Notice error>{error}</Notice>
        </div>
      </Modal>
    </div>
  );
}
