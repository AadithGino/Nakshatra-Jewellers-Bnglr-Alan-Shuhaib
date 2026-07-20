import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ReceiptText, Search, UserRound, X } from 'lucide-react';
import { api, ApiError } from '../../../shared/services/api.client';
import { goldGrams, money } from '../../../shared/utils/format';
import { ReceiptSheet } from '../../../shared/components/ReceiptSheet';
import { Notice, QueryState } from '../../../shared/components/ui';

const toPaise = (value: string) => Math.round(Number(value) * 100);

export function StaffCollectPaymentPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customerId, setCustomerId] = useState(params.get('customer') ?? '');
  const [amount, setAmount] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [error, setError] = useState('');
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
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError ? requestError.message : 'Payment collection failed.',
      ),
  });

  const resetCustomer = () => {
    setCustomerId('');
    setAmount('');
    setDebouncedAmount('');
    setReferenceNumber('');
    setError('');
    setReceipt(null);
    setSearch('');
  };

  const needsReference = method !== 'CASH';
  const canCollect =
    Boolean(customerId && schemeId && Number(amount) > 0 && preview.data && !preview.isError);

  if (receipt) {
    return (
      <div className="collect-screen">
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
                Collect another payment
              </button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="collect-screen">
      <header className="collect-top">
        <div>
          <p>Staff collection</p>
          <h1>Collect payment</h1>
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
                    setError('');
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
            collect.mutate();
          }}
        >
          <section className="collect-selected">
            <span className="directory-avatar">
              <UserRound />
            </span>
            <div>
              <b>{selectedCustomer?.userId?.name ?? 'Customer'}</b>
              <small>
                {selectedCustomer?.customerCode} · {selectedCustomer?.userId?.phone}
              </small>
            </div>
            <button type="button" className="collect-clear" onClick={resetCustomer} aria-label="Clear customer">
              <X />
            </button>
          </section>

          <QueryState
            loading={customer.isLoading}
            error={customer.error}
            empty={!customer.isLoading && !activeScheme}
            retry={() => void customer.refetch()}
          >
            {activeScheme && (
              <>
                <section className={`collect-scheme-strip ${isGold ? 'gold' : 'cash'}`}>
                  <div>
                    <small>{isGold ? '916 gold scheme' : 'Cash scheme'}</small>
                    <b>{activeScheme.enrollmentNumber}</b>
                  </div>
                  <div>
                    <small>Paid so far</small>
                    <b>{money(activeScheme.totalPaidPaise ?? 0)}</b>
                  </div>
                  {isGold && (
                    <div>
                      <small>Gold so far</small>
                      <b>{((activeScheme.totalGoldWeightMg ?? 0) / 1000).toFixed(3)} g</b>
                    </div>
                  )}
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
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                </label>

                <div className="collect-method-row">
                  {(['CASH', 'UPI', 'BANK', 'CARD'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={method === option ? 'active' : ''}
                      onClick={() => setMethod(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                {needsReference && (
                  <label className="collect-reference">
                    <span>Reference number</span>
                    <input
                      className="form-control"
                      required
                      value={referenceNumber}
                      onChange={(event) => setReferenceNumber(event.target.value)}
                      placeholder="UPI / bank / card ref"
                    />
                  </label>
                )}

                <section className="collect-preview">
                  {!amountPaise ? (
                    <p>Enter amount to preview this collection.</p>
                  ) : preview.isFetching && !preview.data ? (
                    <p>Checking contribution…</p>
                  ) : preview.error ? (
                    <p className="error">
                      {preview.error instanceof Error
                        ? preview.error.message
                        : 'Unable to preview payment.'}
                    </p>
                  ) : (
                    <>
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
                      {isGold && preview.data?.goldWeightMg ? (
                        <div className="highlight">
                          <small>Gold credit</small>
                          <b>{goldGrams(preview.data.goldWeightMg)}</b>
                        </div>
                      ) : (
                        <div>
                          <small>Type</small>
                          <b>Cash contribution</b>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}
          </QueryState>

          {!customer.isLoading && customerId && !activeScheme && (
            <p className="helper collect-empty">
              This customer has no active scheme. Enroll them before collecting.
            </p>
          )}

          <Notice error>{error}</Notice>

          <div className="collect-footer">
            <button
              type="submit"
              className="primary wide-action"
              disabled={collect.isPending || !canCollect || (needsReference && !referenceNumber)}
            >
              {collect.isPending ? 'Posting…' : 'Collect payment'}
            </button>
            {preview.data && amountPaise > 0 && (
              <small>
                <ReceiptText /> Receipt will generate instantly after collection
              </small>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
