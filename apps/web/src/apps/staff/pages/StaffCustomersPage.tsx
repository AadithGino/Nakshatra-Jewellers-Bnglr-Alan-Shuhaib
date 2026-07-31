import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Landmark,
  Layers3,
  Phone,
  Plus,
  QrCode,
  ReceiptIndianRupee,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { useAuth } from '../../../shared/hooks/useAuth';
import { money } from '../../../shared/utils/format';
import { AadhaarUploadFields } from '../../../shared/components/AadhaarUploadFields';
import { Modal, Notice, Page, QueryState } from '../../../shared/components/ui';

type Step = 1 | 2 | 3 | 4;

type FormState = {
  name: string;
  phone: string;
  password: string;
  nomineeName: string;
  relationship: string;
  nomineePhone: string;
  aadhaarFrontKey: string;
  aadhaarBackKey: string;
  schemePlanId: string;
  schemeStartDate: string;
  amount: string;
  method: 'CASH' | 'UPI' | 'BANK' | 'CARD';
  referenceNumber: string;
};

const emptyForm = (): FormState => ({
  name: '',
  phone: '',
  password: '',
  nomineeName: '',
  relationship: '',
  nomineePhone: '',
  aadhaarFrontKey: '',
  aadhaarBackKey: '',
  schemePlanId: '',
  schemeStartDate: new Date().toISOString().slice(0, 10),
  amount: '',
  method: 'CASH',
  referenceNumber: '',
});

const STEPS = [
  { id: 1 as const, label: 'Customer' },
  { id: 2 as const, label: 'Scheme' },
  { id: 3 as const, label: 'Payment' },
];

const METHODS = [
  { id: 'CASH' as const, label: 'Cash', icon: Banknote },
  { id: 'UPI' as const, label: 'UPI', icon: QrCode },
  { id: 'BANK' as const, label: 'Bank', icon: Landmark },
  { id: 'CARD' as const, label: 'Card', icon: CreditCard },
];

function typeLabel(type?: string) {
  return type === 'GOLD_WEIGHT' ? 'Gold weight' : type === 'CASH' ? 'Cash' : type ?? '—';
}

export function StaffCustomersPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(params.get('action') === 'create');
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState(emptyForm);
  const [showNominee, setShowNominee] = useState(false);
  const [upiOrderId, setUpiOrderId] = useState('');
  const [created, setCreated] = useState<{
    customerId: string;
    customerCode?: string;
    schemeId?: string;
    enrollmentNumber?: string;
  } | null>(null);
  const [receipt, setReceipt] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const canEnroll = Boolean(session?.permissions.includes('canEnrollScheme'));
  const canCollect = Boolean(session?.permissions.includes('canCollectPayment'));
  const canCreate = Boolean(session?.permissions.includes('canCreateCustomer'));

  const handleCreateError = (requestError: unknown) => {
    if (!(requestError instanceof ApiError)) {
      setError('Unable to create customer.');
      return;
    }
    const detailPath = (requestError.details as Array<{ path?: string }> | undefined)?.find(
      (item) => item?.path === 'phone',
    );
    const isPhoneDuplicate =
      requestError.code === 'DUPLICATE_PHONE' ||
      Boolean(detailPath) ||
      /phone/i.test(requestError.message);

    if (isPhoneDuplicate) {
      setStep(1);
      setPhoneError(
        requestError.message || 'A customer with this phone number already exists',
      );
      setError('');
      return;
    }
    setPhoneError('');
    setError(requestError.message || 'Unable to create customer.');
  };

  const customers = useQuery({
    queryKey: ['staff-customers', search],
    queryFn: () => api<any[]>(`/staff/customers?search=${encodeURIComponent(search)}`),
  });

  const plans = useQuery({
    queryKey: ['staff-scheme-plans-for-create'],
    queryFn: () => api<any[]>('/staff/scheme-plans'),
    enabled: createOpen && canEnroll,
  });

  const activePlans = useMemo(
    () => (plans.data ?? []).filter((plan: any) => plan.status === 'ACTIVE'),
    [plans.data],
  );

  const selectedPlan = activePlans.find((plan: any) => plan._id === form.schemePlanId);
  const amountPaise = Math.round(Number(form.amount || 0) * 100);
  const isUpiQr = form.method === 'UPI';
  const needsReference = form.method !== 'CASH' && form.method !== 'UPI';
  const minPaise = Number(selectedPlan?.minimumPaymentPaise ?? 100);

  const resetWizard = () => {
    setStep(1);
    setForm(emptyForm());
    setShowNominee(false);
    setUpiOrderId('');
    setCreated(null);
    setReceipt(null);
    setError('');
    setPhoneError('');
  };

  const closeWizard = () => {
    if (create.isPending || collect.isPending) return;
    setCreateOpen(false);
    resetWizard();
  };

  const openWizard = () => {
    resetWizard();
    setCreateOpen(true);
  };

  const create = useMutation({
    mutationFn: () =>
      api<{ customer: any; enrollment: any }>('/staff/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          password: form.password,
          aadhaar:
            form.aadhaarFrontKey || form.aadhaarBackKey
              ? {
                  frontKey: form.aadhaarFrontKey || undefined,
                  backKey: form.aadhaarBackKey || undefined,
                }
              : undefined,
          nominee: form.nomineeName
            ? {
                name: form.nomineeName,
                relationship: form.relationship,
                phone: form.nomineePhone || undefined,
              }
            : undefined,
          enrollment:
            canEnroll && form.schemePlanId
              ? {
                  schemePlanId: form.schemePlanId,
                  startDate: form.schemeStartDate,
                }
              : undefined,
        }),
      }),
  });

  const collect = useMutation({
    mutationFn: (payload: { customerId: string; schemeId: string }) =>
      api<any>('/staff/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: payload.customerId,
          schemeId: payload.schemeId,
          amountPaise,
          method: form.method,
          paymentDate: new Date().toISOString(),
          referenceNumber: form.referenceNumber || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
  });

  const initiateUpi = useMutation({
    mutationFn: (payload: { customerId: string; schemeId: string }) =>
      api<any>('/staff/payments/phonepe', {
        method: 'POST',
        body: JSON.stringify({
          customerId: payload.customerId,
          schemeId: payload.schemeId,
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
    queryKey: ['staff-create-upi-intent', upiOrderId],
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
      setStep(4);
      setMessage('Customer created and first UPI payment collected.');
      void queryClient.invalidateQueries({ queryKey: ['staff-customers'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
      return;
    }
    if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(String(upiIntent.data.status))) {
      setError('UPI payment did not complete. Generate a new QR to retry.');
      setUpiOrderId('');
    }
  }, [upiIntent.data, queryClient]);

  const upiCheckoutUrl = upiIntent.data?.checkoutUrl ?? '';
  const upiQrSrc = upiCheckoutUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiCheckoutUrl)}`
    : '';

  const finishWithoutPayment = async (customerId: string) => {
    setCreateOpen(false);
    resetWizard();
    setMessage('Customer created successfully.');
    await queryClient.invalidateQueries({ queryKey: ['staff-customers'] });
    navigate(`/staff/customers/${customerId}`);
  };

  const goNextFromCustomer = () => {
    setError('');
    setPhoneError('');
    if (!form.name.trim() || !form.phone.trim() || form.password.length < 10) {
      setError('Enter name, phone, and a password of at least 10 characters.');
      return;
    }
    if (canEnroll) setStep(2);
    else {
      void (async () => {
        try {
          const data = await create.mutateAsync();
          const customerId = String(data.customer?._id ?? data.customer?.id ?? '');
          if (!customerId) throw new Error('Customer id missing');
          await finishWithoutPayment(customerId);
        } catch (requestError) {
          handleCreateError(requestError);
        }
      })();
    }
  };

  const createAndContinueToPayment = async () => {
    setError('');
    setPhoneError('');
    if (!form.schemePlanId) {
      setError('Select a scheme plan to continue.');
      return;
    }
    try {
      const data = await create.mutateAsync();
      const customerId = String(data.customer?._id ?? '');
      const schemeId = String(data.enrollment?._id ?? '');
      if (!customerId || !schemeId) throw new Error('Enrollment missing after create');
      setCreated({
        customerId,
        customerCode: data.customer?.customerCode,
        schemeId,
        enrollmentNumber: data.enrollment?.enrollmentNumber,
      });
      await queryClient.invalidateQueries({ queryKey: ['staff-customers'] });
      if (canCollect) {
        setStep(3);
      } else {
        setStep(4);
      }
    } catch (requestError) {
      handleCreateError(requestError);
    }
  };

  const createWithoutScheme = async () => {
    setError('');
    setPhoneError('');
    try {
      const data = await api<{ customer: any; enrollment: any }>('/staff/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          password: form.password,
          aadhaar:
            form.aadhaarFrontKey || form.aadhaarBackKey
              ? {
                  frontKey: form.aadhaarFrontKey || undefined,
                  backKey: form.aadhaarBackKey || undefined,
                }
              : undefined,
          nominee: form.nomineeName
            ? {
                name: form.nomineeName,
                relationship: form.relationship,
                phone: form.nomineePhone || undefined,
              }
            : undefined,
        }),
      });
      const customerId = String(data.customer?._id ?? '');
      await finishWithoutPayment(customerId);
    } catch (requestError) {
      handleCreateError(requestError);
    }
  };

  const submitFirstPayment = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!created?.customerId || !created.schemeId) {
      setError('Customer enrollment is incomplete.');
      return;
    }
    if (!Number.isFinite(amountPaise) || amountPaise < minPaise) {
      setError(`Enter at least ${money(minPaise)}.`);
      return;
    }
    if (isUpiQr) {
      initiateUpi.mutate({
        customerId: created.customerId,
        schemeId: created.schemeId,
      });
      return;
    }
    if (needsReference && !form.referenceNumber.trim()) {
      setError('Reference number is required for this method.');
      return;
    }
    try {
      const payment = await collect.mutateAsync({
        customerId: created.customerId,
        schemeId: created.schemeId,
      });
      setReceipt(payment);
      setStep(4);
      setMessage('Customer created and first payment collected.');
      await queryClient.invalidateQueries({ queryKey: ['staff-customers'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-payments'] });
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Customer was created, but first payment failed.',
      );
    }
  };

  const modalTitle =
    step === 1
      ? 'New customer'
      : step === 2
        ? 'Choose scheme'
        : step === 3
          ? 'First payment'
          : 'All set';

  return (
    <Page
      title="Customers"
      subtitle={
        params.get('action') === 'enroll'
          ? 'Select a customer to open details and enroll a scheme.'
          : 'Search and open a customer account.'
      }
      actions={
        canCreate ? (
          <button className="primary" type="button" onClick={openWizard}>
            <Plus /> New
          </button>
        ) : undefined
      }
    >
      <Notice>{message}</Notice>
      <div className="staff-list-stack">
        <div className="mobile-search">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, phone or customer ID"
          />
        </div>
        <div className="section-heading">
          <div>
            <span>Customer directory</span>
            <h2>All customers</h2>
          </div>
          <small>{customers.data?.length ?? 0} records</small>
        </div>
        <QueryState
          loading={customers.isLoading}
          error={customers.error}
          empty={!customers.isLoading && !customers.data?.length}
          retry={() => void customers.refetch()}
        >
          <div className="passbook-ledger">
            {customers.data?.map((customer) => (
              <button
                key={customer._id}
                type="button"
                className="passbook-entry directory-entry"
                onClick={() => navigate(`/staff/customers/${customer._id}`)}
              >
                <div className="passbook-entry-top">
                  <span className="directory-avatar" aria-hidden="true">
                    <UserRound />
                  </span>
                  <div className="passbook-entry-copy">
                    <b>{customer.userId?.name}</b>
                    <small>
                      {customer.customerCode}
                      <span aria-hidden="true">·</span>
                      <Phone />
                      {customer.userId?.phone}
                    </small>
                  </div>
                  <span className="verified-customer">
                    <ShieldCheck /> Verified
                  </span>
                </div>
                <div className="passbook-entry-footer">
                  <em className="cash">Open customer account</em>
                  <span>
                    View
                    <ChevronRight />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </QueryState>
      </div>

      <Modal title={modalTitle} open={createOpen} onClose={closeWizard}>
        {canEnroll && step <= 3 && (
          <div className="create-wizard-steps" aria-label="Creation steps">
            {STEPS.map((item) => (
              <div
                key={item.id}
                className={`create-wizard-step ${step === item.id ? 'active' : ''} ${
                  step > item.id ? 'done' : ''
                }`}
              >
                <span>{step > item.id ? <Check /> : item.id}</span>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <form
            className="create-wizard-form"
            onSubmit={(event) => {
              event.preventDefault();
              goNextFromCustomer();
            }}
          >
            <p className="create-wizard-lead">
              Passbook ID is generated automatically after create.
            </p>
            <div className="create-wizard-fields">
              <label>
                <span>Name</span>
                <input
                  className="form-control"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label className={phoneError ? 'has-error' : ''}>
                <span>Phone</span>
                <input
                  className={`form-control ${phoneError ? 'is-invalid' : ''}`}
                  required
                  value={form.phone}
                  aria-invalid={Boolean(phoneError)}
                  onChange={(event) => {
                    setForm({ ...form, phone: event.target.value });
                    if (phoneError) setPhoneError('');
                  }}
                />
                {phoneError ? <em className="field-error">{phoneError}</em> : null}
              </label>
              <label className="full">
                <span>Temporary password</span>
                <input
                  className="form-control"
                  type="password"
                  minLength={10}
                  required
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </label>

              <div className={`create-optional-accordion full ${showNominee ? 'open' : ''}`}>
                <button
                  type="button"
                  className="create-optional-trigger"
                  aria-expanded={showNominee}
                  onClick={() => setShowNominee((value) => !value)}
                >
                  <div>
                    <b>Nominee details</b>
                    <small>Optional · add only if available</small>
                  </div>
                  <ChevronRight className="create-optional-chevron" />
                </button>
                {showNominee && (
                  <div className="create-optional-body">
                    <label>
                      <span>Nominee name</span>
                      <input
                        className="form-control"
                        value={form.nomineeName}
                        onChange={(event) =>
                          setForm({ ...form, nomineeName: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Relationship</span>
                      <input
                        className="form-control"
                        value={form.relationship}
                        onChange={(event) =>
                          setForm({ ...form, relationship: event.target.value })
                        }
                      />
                    </label>
                    <label className="full">
                      <span>Nominee phone</span>
                      <input
                        className="form-control"
                        value={form.nomineePhone}
                        onChange={(event) =>
                          setForm({ ...form, nomineePhone: event.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="full">
                <AadhaarUploadFields
                  frontKey={form.aadhaarFrontKey || undefined}
                  backKey={form.aadhaarBackKey || undefined}
                  disabled={create.isPending}
                  onChange={({ frontKey, backKey }) =>
                    setForm({
                      ...form,
                      aadhaarFrontKey: frontKey ?? '',
                      aadhaarBackKey: backKey ?? '',
                    })
                  }
                />
              </div>
            </div>
            <Notice error>{error}</Notice>
            <div className="create-wizard-actions">
              <button type="button" className="secondary" onClick={closeWizard}>
                Cancel
              </button>
              <button className="primary" disabled={create.isPending}>
                {canEnroll ? 'Next · Scheme' : create.isPending ? 'Creating…' : 'Create customer'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="create-wizard-form">
            <p className="create-wizard-lead">
              Pick the scheme {form.name || 'this customer'} is joining.
            </p>

            <div className="create-plan-list">
              {activePlans.map((plan: any) => {
                const active = form.schemePlanId === plan._id;
                return (
                  <button
                    key={plan._id}
                    type="button"
                    className={`create-plan-card ${active ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, schemePlanId: plan._id })}
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
              <span>Scheme start date</span>
              <div>
                <CalendarDays />
                <input
                  className="form-control"
                  type="date"
                  value={form.schemeStartDate}
                  onChange={(event) =>
                    setForm({ ...form, schemeStartDate: event.target.value })
                  }
                />
              </div>
            </label>

            <Notice error>{error}</Notice>
            <div className="create-wizard-actions">
              <button
                type="button"
                className="secondary"
                disabled={create.isPending}
                onClick={() => {
                  setError('');
                  setStep(1);
                }}
              >
                <ArrowLeft /> Back
              </button>
              <button
                type="button"
                className="secondary"
                disabled={create.isPending}
                onClick={() => void createWithoutScheme()}
              >
                Skip scheme
              </button>
              <button
                type="button"
                className="primary"
                disabled={create.isPending || !form.schemePlanId}
                onClick={() => void createAndContinueToPayment()}
              >
                {create.isPending ? 'Creating…' : canCollect ? 'Next · Payment' : 'Create & enroll'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && created && (
          <form className="create-wizard-form" onSubmit={submitFirstPayment}>
            <div className="create-wizard-summary">
              <div>
                <small>Customer</small>
                <strong>{form.name}</strong>
                <em>{created.customerCode ?? 'Passbook assigned'}</em>
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
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </div>
              <small>Minimum {money(minPaise)}</small>
            </label>

            <div className="create-method-row">
              {METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    type="button"
                    className={form.method === method.id ? 'active' : ''}
                    onClick={() => {
                      setForm({ ...form, method: method.id });
                      setUpiOrderId('');
                    }}
                  >
                    <Icon />
                    {method.label}
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
                  value={form.referenceNumber}
                  onChange={(event) =>
                    setForm({ ...form, referenceNumber: event.target.value })
                  }
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
                onClick={() => void finishWithoutPayment(created.customerId)}
              >
                Skip payment
              </button>
              <button
                className="primary"
                disabled={collect.isPending || initiateUpi.isPending}
              >
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

        {step === 4 && (
          <div className="create-wizard-done">
            <span className="create-wizard-done-seal">
              <Check />
            </span>
            <h3>Customer ready</h3>
            <p>
              {form.name}
              {created?.customerCode ? ` · ${created.customerCode}` : ''}
            </p>
            {receipt ? (
              <p className="helper">
                First payment {money(receipt.amountPaise)} recorded
                {receipt.receiptNumber ? ` · ${receipt.receiptNumber}` : ''}.
              </p>
            ) : (
              <p className="helper">Account created. First payment can be collected later.</p>
            )}
            <div className="create-wizard-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setCreateOpen(false);
                  resetWizard();
                }}
              >
                Close
              </button>
              {created?.customerId ? (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setCreateOpen(false);
                    resetWizard();
                    navigate(`/staff/customers/${created.customerId}`);
                  }}
                >
                  <ReceiptIndianRupee /> Open customer
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
