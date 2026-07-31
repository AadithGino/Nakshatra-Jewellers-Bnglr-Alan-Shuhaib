import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Gem,
  IndianRupee,
  Landmark,
  Layers3,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { useAuth } from '../../../shared/hooks/useAuth';
import { date, money } from '../../../shared/utils/format';
import { AadhaarDocumentSection } from '../../../shared/components/AadhaarDocumentSection';
import { Select } from '../../../shared/components/Select';
import { Card, Modal, Notice, Page, QueryState, Status } from '../../../shared/components/ui';

const PAYMENTS_PAGE_SIZE = 10;

const METHODS = [
  { id: 'CASH' as const, label: 'Cash', icon: Banknote },
  { id: 'UPI' as const, label: 'UPI', icon: QrCode },
  { id: 'BANK' as const, label: 'Bank', icon: Landmark },
  { id: 'CARD' as const, label: 'Card', icon: CreditCard },
];

type EnrollStep = 1 | 2 | 3;

function typeLabel(type?: string) {
  return type === 'GOLD_WEIGHT' ? 'Gold weight' : type === 'CASH' ? 'Cash' : type ?? '—';
}

export function StaffCustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollStep, setEnrollStep] = useState<EnrollStep>(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [schemePlanId, setSchemePlanId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [createdSchemeId, setCreatedSchemeId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [upiOrderId, setUpiOrderId] = useState('');
  const [receipt, setReceipt] = useState<any>(null);

  const details = useQuery({
    queryKey: ['staff-customer-detail', id],
    queryFn: () => api<any>(`/staff/customers/${id}`),
    enabled: Boolean(id),
  });
  const plans = useQuery({
    queryKey: ['staff-scheme-plans'],
    queryFn: () => api<any[]>('/staff/scheme-plans'),
    enabled: enrollOpen,
  });

  const customer = details.data?.customer;
  const schemes = details.data?.schemes ?? [];
  const payments = details.data?.payments ?? [];
  const [paymentSchemeFilter, setPaymentSchemeFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [paymentPage, setPaymentPage] = useState(1);
  const [historyTab, setHistoryTab] = useState<'schemes' | 'payments'>('schemes');
  const canEnroll = session?.permissions.includes('canEnrollScheme');
  const canCollect = session?.permissions.includes('canCollectPayment');
  const hasActiveScheme = schemes.some((scheme: any) => scheme.status === 'ACTIVE');

  const activePlans = useMemo(
    () => (plans.data ?? []).filter((plan: any) => plan.status === 'ACTIVE'),
    [plans.data],
  );
  const selectedPlan = activePlans.find((plan: any) => plan._id === schemePlanId);
  const amountPaise = Math.round(Number(amount || 0) * 100);
  const isUpiQr = method === 'UPI';
  const needsReference = method !== 'CASH' && method !== 'UPI';
  const minPaise = Number(selectedPlan?.minimumPaymentPaise ?? 100);

  const resetEnroll = () => {
    setEnrollStep(1);
    setSchemePlanId('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setCreatedSchemeId('');
    setAmount('');
    setMethod('CASH');
    setReferenceNumber('');
    setUpiOrderId('');
    setReceipt(null);
    setError('');
    setErrorCode('');
  };

  const closeEnroll = () => {
    setEnrollOpen(false);
    resetEnroll();
  };

  const openEnroll = () => {
    resetEnroll();
    setMessage('');
    setEnrollOpen(true);
  };

  const enroll = useMutation({
    mutationFn: () =>
      api<any>('/staff/enrollments', {
        method: 'POST',
        body: JSON.stringify({ customerId: id, schemePlanId, startDate }),
      }),
  });

  const collect = useMutation({
    mutationFn: (schemeId: string) =>
      api<any>('/staff/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: id,
          schemeId,
          amountPaise,
          method,
          paymentDate: new Date().toISOString(),
          referenceNumber: referenceNumber || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
  });

  const initiateUpi = useMutation({
    mutationFn: (schemeId: string) =>
      api<any>('/staff/payments/phonepe', {
        method: 'POST',
        body: JSON.stringify({
          customerId: id,
          schemeId,
          amountPaise,
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    onSuccess: (data) => {
      setUpiOrderId(String(data.merchantTransactionId));
      setError('');
    },
    onError: (requestError) =>
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to create UPI QR.'),
  });

  const upiIntent = useQuery({
    queryKey: ['staff-enroll-upi-intent', upiOrderId],
    queryFn: () => api<any>(`/staff/payment-intents/${encodeURIComponent(upiOrderId)}`),
    enabled: Boolean(upiOrderId),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ||
      query.state.data?.status === 'INITIATED' ||
      (query.state.data?.status === 'SUCCESS' && !query.state.data?.payment)
        ? 2_000
        : false,
  });

  useEffect(() => {
    if (!upiIntent.data) return;
    if (upiIntent.data.status === 'SUCCESS' && upiIntent.data.payment) {
      setReceipt(upiIntent.data.payment);
      setUpiOrderId('');
      setEnrollStep(3);
      setMessage('Scheme enrolled and first UPI payment collected.');
      void details.refetch();
      void queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
      return;
    }
    if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(String(upiIntent.data.status))) {
      setError('UPI payment did not complete. Generate a new QR to retry.');
      setUpiOrderId('');
    }
  }, [upiIntent.data, details, queryClient]);

  const upiCheckoutUrl = upiIntent.data?.checkoutUrl ?? '';
  const upiQrSrc = upiCheckoutUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiCheckoutUrl)}`
    : '';

  const finishEnrollOnly = async () => {
    closeEnroll();
    setMessage('Customer enrolled successfully.');
    await details.refetch();
  };

  const enrollAndContinue = async () => {
    setError('');
    setErrorCode('');
    if (!schemePlanId) {
      setError('Select a scheme plan to continue.');
      return;
    }
    try {
      const enrollment = await enroll.mutateAsync();
      const schemeId = String(enrollment?._id ?? enrollment?.id ?? '');
      if (!schemeId) throw new Error('Enrollment id missing');
      setCreatedSchemeId(schemeId);
      await details.refetch();
      if (canCollect) {
        setEnrollStep(2);
      } else {
        await finishEnrollOnly();
      }
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setErrorCode(requestError.code);
        setError(requestError.message);
      } else {
        setErrorCode('');
        setError('Unable to enroll customer.');
      }
    }
  };

  const submitFirstPayment = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!createdSchemeId) {
      setError('Enrollment missing. Go back and enroll again.');
      return;
    }
    if (!amountPaise || amountPaise < minPaise) {
      setError(`Enter at least ${money(minPaise)}.`);
      return;
    }
    if (needsReference && !referenceNumber.trim()) {
      setError('Reference number is required for this method.');
      return;
    }
    try {
      if (isUpiQr) {
        await initiateUpi.mutateAsync(createdSchemeId);
        return;
      }
      const payment = await collect.mutateAsync(createdSchemeId);
      setReceipt(payment);
      setEnrollStep(3);
      setMessage('Scheme enrolled and first payment collected.');
      await details.refetch();
      void queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
    } catch (requestError) {
      setError(
        requestError instanceof ApiError ? requestError.message : 'Unable to collect payment.',
      );
    }
  };

  const schemeFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All schemes' },
      ...schemes.map((scheme: any) => ({
        value: String(scheme._id),
        label: scheme.enrollmentNumber,
        hint: scheme.schemePlanId?.name ?? scheme.schemeType,
      })),
    ],
    [schemes],
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All statuses' },
      { value: 'SUCCESS', label: 'SUCCESS' },
      { value: 'PENDING', label: 'PENDING' },
      { value: 'FAILED', label: 'FAILED' },
      { value: 'REVERSED', label: 'REVERSED' },
    ],
    [],
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((payment: any) => {
      const schemeId = String(payment.schemeId?._id ?? payment.schemeId ?? '');
      if (paymentSchemeFilter !== 'ALL' && schemeId !== paymentSchemeFilter) return false;
      if (paymentStatusFilter !== 'ALL' && payment.status !== paymentStatusFilter) return false;
      return true;
    });
  }, [payments, paymentSchemeFilter, paymentStatusFilter]);

  const pagedPayments = useMemo(() => {
    const start = (paymentPage - 1) * PAYMENTS_PAGE_SIZE;
    return filteredPayments.slice(start, start + PAYMENTS_PAGE_SIZE);
  }, [filteredPayments, paymentPage]);

  const paymentPages = Math.max(1, Math.ceil(filteredPayments.length / PAYMENTS_PAGE_SIZE));
  const visibleFrom = filteredPayments.length ? (paymentPage - 1) * PAYMENTS_PAGE_SIZE + 1 : 0;
  const visibleTo = Math.min(paymentPage * PAYMENTS_PAGE_SIZE, filteredPayments.length);

  const nomineeLabel = customer?.nomineeId?.name
    ? `${customer.nomineeId.name}${
        customer.nomineeId.relationship ? ` · ${customer.nomineeId.relationship}` : ''
      }`
    : null;

  return (
    <Page
      title={customer?.userId?.name ?? 'Customer'}
      subtitle={
        customer ? `${customer.customerCode} · ${customer.userId?.phone}` : 'Customer details'
      }
      actions={
        <Link className="scheme-back-link" to="/staff/customers">
          <ArrowLeft />
          <span>Back</span>
        </Link>
      }
    >
      <Notice>{message}</Notice>
      {!enrollOpen ? <Notice error>{error}</Notice> : null}
      <QueryState
        loading={details.isLoading}
        error={details.error}
        retry={() => void details.refetch()}
      >
        {customer && (
          <div className="staff-customer-stack">
            <section className="staff-customer-summary">
              <div className="staff-customer-summary-main">
                <span className="staff-customer-avatar">
                  <UserRound />
                </span>
                <div>
                  <div className="staff-customer-name-row">
                    <b>{customer.userId?.name}</b>
                    <Status value={customer.status} />
                  </div>
                  <p>
                    <Phone /> {customer.userId?.phone}
                  </p>
                  <small>{customer.customerCode}</small>
                </div>
              </div>
              <div className="staff-customer-actions">
                {canCollect && hasActiveScheme ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => navigate(`/staff/collect?customer=${id}`)}
                  >
                    <WalletCards /> Collect
                  </button>
                ) : null}
                {canEnroll ? (
                  <button type="button" className="primary" onClick={openEnroll}>
                    <Plus /> Enroll
                  </button>
                ) : null}
              </div>
            </section>

            <AadhaarDocumentSection
              variant="chips"
              aadhaar={customer.aadhaar}
              customerName={customer.userId?.name}
            />

            {nomineeLabel ? (
              <div className="staff-meta-line">
                <UsersRound />
                <span>
                  <small>Nominee</small>
                  <b>{nomineeLabel}</b>
                </span>
              </div>
            ) : null}

            <div className="segmented-tabs tabs-2" role="tablist" aria-label="Customer history tabs">
              <button
                type="button"
                className={historyTab === 'schemes' ? 'active' : ''}
                onClick={() => setHistoryTab('schemes')}
              >
                Schemes ({schemes.length})
              </button>
              <button
                type="button"
                className={historyTab === 'payments' ? 'active' : ''}
                onClick={() => setHistoryTab('payments')}
              >
                Payments ({payments.length})
              </button>
            </div>

            {historyTab === 'schemes' && (
              <Card className="workspace-schemes-card">
                {schemes.length ? (
                  <div className="passbook-ledger">
                    {schemes.map((scheme: any) => {
                      const isGold = scheme.schemeType === 'GOLD_WEIGHT';
                      return (
                        <button
                          type="button"
                          className="passbook-entry passbook-entry-button"
                          key={scheme._id}
                          onClick={() => navigate(`/staff/enrollments/${scheme._id}`)}
                        >
                          <div className="passbook-entry-top">
                            <span className={`scheme-type-icon ${isGold ? 'gold' : ''}`}>
                              {isGold ? <Gem /> : <IndianRupee />}
                            </span>
                            <div className="passbook-entry-copy">
                              <b>{scheme.enrollmentNumber}</b>
                              <small>
                                {scheme.schemePlanId?.name ?? typeLabel(scheme.schemeType)}
                              </small>
                              <small>
                                <CalendarDays /> {date(scheme.maturityDate)}
                              </small>
                            </div>
                            <div className="passbook-entry-value">
                              <strong>{money(scheme.totalPaidPaise)}</strong>
                              <Status value={scheme.status} />
                              <ChevronRight className="passbook-entry-chevron" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="helper">No schemes enrolled yet.</p>
                )}
              </Card>
            )}

            {historyTab === 'payments' && (
              <Card className="workspace-payments-card">
                {payments.length ? (
                  <>
                    <div className="reports-toolbar-main" style={{ marginBottom: 8 }}>
                      <label>
                        <small>Scheme</small>
                        <Select
                          value={paymentSchemeFilter}
                          options={schemeFilterOptions}
                          onChange={(value) => {
                            setPaymentSchemeFilter(value);
                            setPaymentPage(1);
                          }}
                        />
                      </label>
                      <label>
                        <small>Status</small>
                        <Select
                          value={paymentStatusFilter}
                          options={statusFilterOptions}
                          onChange={(value) => {
                            setPaymentStatusFilter(value);
                            setPaymentPage(1);
                          }}
                        />
                      </label>
                    </div>
                    {!filteredPayments.length ? (
                      <p className="helper">No payments match current filters.</p>
                    ) : (
                      <div className="passbook-ledger">
                        {pagedPayments.map((payment: any) => (
                          <article className="passbook-entry" key={payment._id}>
                            <div className="passbook-entry-top">
                              <span className="ledger-status" aria-hidden="true">
                                <CheckCircle2 />
                              </span>
                              <div className="passbook-entry-copy">
                                <b>{payment.receiptNumber ?? 'Pending receipt'}</b>
                                <small>
                                  {date(payment.paymentDate)} · {payment.method}
                                </small>
                                <small>
                                  {payment.schemeId?.enrollmentNumber ?? 'Scheme'} ·{' '}
                                  {payment.status}
                                </small>
                              </div>
                              <div className="passbook-entry-value">
                                <strong>{money(payment.amountPaise)}</strong>
                                <button
                                  type="button"
                                  className="reports-cell-link"
                                  onClick={() =>
                                    navigate(`/staff/payments?receipt=${payment._id}`)
                                  }
                                >
                                  Receipt
                                  <ChevronRight />
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                    {filteredPayments.length > 0 && (
                      <div className="reports-pagination">
                        <span>
                          Showing {visibleFrom} to {visibleTo} of {filteredPayments.length}
                        </span>
                        <div>
                          <button
                            type="button"
                            disabled={paymentPage <= 1}
                            onClick={() => setPaymentPage((value) => Math.max(1, value - 1))}
                          >
                            Prev
                          </button>
                          <button type="button" className="active">
                            {paymentPage}
                          </button>
                          <button
                            type="button"
                            disabled={paymentPage >= paymentPages}
                            onClick={() =>
                              setPaymentPage((value) => Math.min(paymentPages, value + 1))
                            }
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="helper">No payments recorded.</p>
                )}
              </Card>
            )}
          </div>
        )}
      </QueryState>

      <Modal
        title={
          enrollStep === 1
            ? 'Enroll in scheme'
            : enrollStep === 2
              ? 'First payment'
              : 'Enrollment done'
        }
        open={enrollOpen}
        onClose={closeEnroll}
      >
        {enrollStep < 3 ? (
          <div className="create-wizard-steps steps-2">
            {[
              { id: 1 as const, label: 'Scheme' },
              { id: 2 as const, label: 'Payment' },
            ].map((step) => (
              <div
                key={step.id}
                className={`create-wizard-step ${
                  enrollStep === step.id ? 'active' : enrollStep > step.id ? 'done' : ''
                }`}
              >
                <span>{enrollStep > step.id ? <Check /> : step.id}</span>
                <small>{step.label}</small>
              </div>
            ))}
          </div>
        ) : null}

        {enrollStep === 1 && (
          <div className="create-wizard-form">
            <p className="create-wizard-lead">
              Choose the scheme {customer?.userId?.name ?? 'this customer'} is joining.
            </p>
            <div className="create-plan-list">
              {activePlans.map((plan: any) => {
                const active = schemePlanId === plan._id;
                return (
                  <button
                    key={plan._id}
                    type="button"
                    className={`create-plan-card ${active ? 'active' : ''}`}
                    onClick={() => {
                      setSchemePlanId(plan._id);
                      setError('');
                      setErrorCode('');
                    }}
                  >
                    <span className="create-plan-icon">
                      <Layers3 />
                    </span>
                    <div>
                      <b>{plan.name}</b>
                      <small>
                        {typeLabel(plan.type)} · {plan.durationMonths} months
                        {plan.minimumPaymentPaise
                          ? ` · Min ${money(plan.minimumPaymentPaise)}`
                          : ''}
                      </small>
                    </div>
                    <em className={active ? 'on' : ''}>{active ? <Check /> : null}</em>
                  </button>
                );
              })}
              {!plans.isLoading && !activePlans.length ? (
                <p className="helper">No active scheme plans available.</p>
              ) : null}
            </div>

            <label className="create-wizard-date">
              <span>Start date</span>
              <div>
                <CalendarDays />
                <input
                  className="form-control"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
            </label>

            <Notice
              error
              action={
                errorCode === 'CUSTOMER_ALREADY_ENROLLED' && canCollect ? (
                  <button
                    type="button"
                    className="ui-notice-btn"
                    onClick={() => {
                      closeEnroll();
                      navigate(`/staff/collect?customer=${id}`);
                    }}
                  >
                    Collect on active scheme
                  </button>
                ) : null
              }
            >
              {errorCode === 'CUSTOMER_ALREADY_ENROLLED'
                ? 'This customer already has an active scheme. Settle or complete it before enrolling again.'
                : error}
            </Notice>
            <div className="create-wizard-actions">
              <button type="button" className="secondary" onClick={closeEnroll}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={
                  enroll.isPending ||
                  !schemePlanId ||
                  errorCode === 'CUSTOMER_ALREADY_ENROLLED'
                }
                onClick={() => void enrollAndContinue()}
              >
                {enroll.isPending
                  ? 'Enrolling…'
                  : canCollect
                    ? 'Next · Payment'
                    : 'Enroll'}
              </button>
            </div>
          </div>
        )}

        {enrollStep === 2 && (
          <form className="create-wizard-form" onSubmit={(event) => void submitFirstPayment(event)}>
            <div className="create-wizard-summary">
              <div>
                <small>Customer</small>
                <strong>{customer?.userId?.name}</strong>
                <em>{customer?.customerCode}</em>
              </div>
              <div>
                <small>Scheme</small>
                <strong>{selectedPlan?.name ?? 'Enrolled'}</strong>
                <em>
                  {typeLabel(selectedPlan?.type)} · {selectedPlan?.durationMonths ?? '—'} months
                </em>
              </div>
            </div>

            <label className="create-amount">
              <span>First payment amount</span>
              <div>
                <em>₹</em>
                <input
                  inputMode="decimal"
                  type="number"
                  min={(minPaise / 100).toFixed(2)}
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <small>Minimum {money(minPaise)}</small>
            </label>

            <div className="create-method-row">
              {METHODS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={method === item.id ? 'active' : ''}
                    onClick={() => {
                      setMethod(item.id);
                      setUpiOrderId('');
                    }}
                  >
                    <Icon />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {isUpiQr && (
              <div className="create-upi-panel">
                {!upiOrderId ? (
                  <p>Tap collect to generate a UPI QR for the first payment.</p>
                ) : upiIntent.isLoading || !upiIntent.data ? (
                  <p>Generating UPI QR…</p>
                ) : (
                  <>
                    <div className="create-upi-meta">
                      <div>
                        <small>Amount</small>
                        <b>{money(amountPaise)}</b>
                      </div>
                      <div>
                        <small>Status</small>
                        <b>{String(upiIntent.data.status)}</b>
                      </div>
                    </div>
                    {upiQrSrc ? (
                      <img src={upiQrSrc} alt="UPI payment QR" width={200} height={200} />
                    ) : null}
                    <div className="create-upi-actions">
                      {upiCheckoutUrl ? (
                        <a
                          href={upiCheckoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary"
                        >
                          <ExternalLink size={14} /> Open checkout
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void upiIntent.refetch()}
                      >
                        <RefreshCw size={14} /> Refresh
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {needsReference && (
              <label>
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

            <Notice error>{error}</Notice>
            <div className="create-wizard-actions">
              <button
                type="button"
                className="secondary"
                disabled={collect.isPending || initiateUpi.isPending}
                onClick={() => void finishEnrollOnly()}
              >
                Skip payment
              </button>
              <button className="primary" disabled={collect.isPending || initiateUpi.isPending}>
                {collect.isPending || initiateUpi.isPending
                  ? 'Working…'
                  : isUpiQr
                    ? upiOrderId
                      ? 'Re-generate QR'
                      : 'Collect with UPI QR'
                    : 'Collect & finish'}
              </button>
            </div>
          </form>
        )}

        {enrollStep === 3 && (
          <div className="create-wizard-done">
            <span className="create-wizard-done-seal">
              <Check />
            </span>
            <h3>Enrollment ready</h3>
            <p>
              {customer?.userId?.name}
              {selectedPlan?.name ? ` · ${selectedPlan.name}` : ''}
            </p>
            {receipt ? (
              <p className="helper">
                First payment {money(receipt.amountPaise)} recorded
                {receipt.receiptNumber ? ` · ${receipt.receiptNumber}` : ''}.
              </p>
            ) : (
              <p className="helper">Scheme enrolled. Payment can be collected later.</p>
            )}
            <div className="create-wizard-actions">
              <button type="button" className="primary" onClick={closeEnroll}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
