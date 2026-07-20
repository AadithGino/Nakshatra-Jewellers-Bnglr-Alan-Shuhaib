import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  Check,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/services/api.client';
import { money } from '../../../shared/utils/format';
import { BrandLogo } from '../../../shared/components/BrandLogo';
import { QueryState } from '../../../shared/components/ui';

function rupeesToPaise(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) return null;
  const [whole, decimal = ''] = value.split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}

function paiseToAmountInput(paise: number) {
  return (paise / 100).toFixed(paise % 100 === 0 ? 0 : 2);
}

function amountInWords(paise: number) {
  const rupees = Math.floor(paise / 100);
  if (rupees <= 0) return '';
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const chunk = (n: number): string => {
    if (n < 20) return ones[n] ?? '';
    if (n < 100) return `${tens[Math.floor(n / 10)] ?? ''}${n % 10 ? ` ${ones[n % 10] ?? ''}` : ''}`.trim();
    return `${ones[Math.floor(n / 100)] ?? ''} Hundred${n % 100 ? ` ${chunk(n % 100)}` : ''}`.trim();
  };
  if (rupees < 1000) return `Rupees ${chunk(rupees)} Only`;
  if (rupees < 100_000) {
    return `Rupees ${chunk(Math.floor(rupees / 1000))} Thousand${
      rupees % 1000 ? ` ${chunk(rupees % 1000)}` : ''
    } Only`;
  }
  return `Rupees ${money(paise).replace('₹', '').trim()} Only`;
}

type PaymentPreview = {
  schemeId: string;
  schemeName: string | null;
  schemeType: 'CASH' | 'GOLD_WEIGHT';
  enrollmentNumber: string;
  schemeMonth: number;
  phase: 'FLEXIBLE' | 'CAPPED';
  phaseLabel: string;
  flexibleThroughout: boolean;
  amountPaise: number;
  minimumPaymentPaise: number;
  capApplies: boolean;
  monthlyCapPaise: number | null;
  paidInCurrentMonthPaise: number;
  remainingCapPaise: number | null;
  paymentAllowed: boolean;
  validationMessage: string | null;
  purity: '916';
  goldRatePerGramPaise: number | null;
  goldWeightMg: number | null;
  calculatedAt: string;
  quoteExpiresAt: string;
  totalPaidPaise: number;
  totalGoldWeightMg: number;
  durationMonths: number;
  status: string;
};

const PREVIEW_DEBOUNCE_MS = 300;

export function CustomerPayPage() {
  const { id = '' } = useParams();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [debouncedPaise, setDebouncedPaise] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [now] = useState(() => Date.now());
  const amountPaise = useMemo(() => rupeesToPaise(amount), [amount]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.mobile-shell > main')?.scrollTo(0, 0);
    const timer = window.setTimeout(() => amountRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedPaise(amountPaise), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [amountPaise]);

  const schemeQuery = useQuery({
    queryKey: ['customer-scheme-detail', id],
    queryFn: () => api<any>(`/customer/schemes/${id}`),
    enabled: Boolean(id),
  });

  const preview = useQuery({
    queryKey: ['customer-payment-preview', id, debouncedPaise],
    queryFn: () =>
      api<PaymentPreview>(
        `/customer/schemes/${id}/payment-preview?amountPaise=${debouncedPaise}`,
      ),
    enabled: Boolean(id && debouncedPaise && debouncedPaise > 0),
    retry: false,
    placeholderData: (previous) => previous,
  });

  const stablePreview = debouncedPaise ? (preview.data ?? null) : null;

  const pay = useMutation({
    mutationFn: () =>
      api<{ checkoutUrl: string }>('/customer/payments/phonepe', {
        method: 'POST',
        body: JSON.stringify({
          schemeId: id,
          amountPaise: debouncedPaise,
          idempotencyKey,
        }),
      }),
    onSuccess: (data) => {
      location.assign(data.checkoutUrl);
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to start PhonePe checkout.',
      ),
  });

  const scheme = schemeQuery.data?.scheme;
  const status = schemeQuery.data?.schemeStatus;
  const isGold = scheme?.schemeType === 'GOLD_WEIGHT';
  const currentRate =
    stablePreview?.goldRatePerGramPaise ??
    schemeQuery.data?.currentGoldRate?.ratePerGramPaise ??
    null;

  const previewMatchesInput =
    Boolean(debouncedPaise) &&
    amountPaise === debouncedPaise &&
    stablePreview?.amountPaise === debouncedPaise;

  const quoteExpired =
    stablePreview?.quoteExpiresAt != null &&
    new Date(stablePreview.quoteExpiresAt).getTime() <= now;

  const calculating =
    Boolean(debouncedPaise) &&
    (preview.isFetching || amountPaise !== debouncedPaise || !previewMatchesInput);

  const phase = stablePreview?.phase ?? status?.phase ?? 'FLEXIBLE';
  const capped =
    phase === 'CAPPED' && !(stablePreview?.flexibleThroughout ?? status?.flexibleThroughout);
  const minimumPaise = stablePreview?.minimumPaymentPaise ?? status?.minimumPaymentPaise ?? 0;
  const remainingCap = stablePreview?.remainingCapPaise ?? status?.remainingCapPaise ?? null;
  const maxPaise = capped && remainingCap != null ? remainingCap : null;

  const validationMessage =
    stablePreview?.validationMessage ??
    (preview.error instanceof ApiError ? preview.error.message : null) ??
    error;

  const amountInvalid = Boolean(
    validationMessage && previewMatchesInput && stablePreview && !stablePreview.paymentAllowed,
  );

  const withinLimit =
    Boolean(previewMatchesInput && stablePreview?.paymentAllowed) && !amountInvalid && !calculating;

  const canPay =
    previewMatchesInput &&
    !calculating &&
    !quoteExpired &&
    !pay.isPending &&
    stablePreview?.paymentAllowed === true &&
    scheme?.status === 'ACTIVE' &&
    (!isGold || Boolean(stablePreview.goldRatePerGramPaise));

  const buttonLabel = (() => {
    if (pay.isPending) return 'Opening PhonePe…';
    if (calculating && amountPaise) return 'Checking…';
    if (preview.isError || quoteExpired) return 'Retry preview';
    if (stablePreview && !stablePreview.paymentAllowed) return 'Not allowed';
    return 'Pay with PhonePe';
  })();

  const hasAmount = Boolean(amountPaise || debouncedPaise);

  const goldGrams =
    stablePreview?.goldWeightMg != null
      ? (stablePreview.goldWeightMg / 1000).toFixed(3)
      : null;
  const displayAmountPaise = previewMatchesInput
    ? debouncedPaise
    : (stablePreview?.amountPaise ?? debouncedPaise);

  const useMax = () => {
    if (maxPaise == null || maxPaise <= 0) return;
    setAmount(paiseToAmountInput(maxPaise));
    setError('');
  };

  return (
    <div className="pay-screen nsk-pay">
      <header className="nsk-pay-header">
        <Link
          className="nsk-pay-back"
          to={scheme ? `/customer/schemes/${scheme._id}` : '/customer/schemes'}
          aria-label="Back to scheme"
        >
          <ArrowLeft />
        </Link>
        <h1>Make payment</h1>
        <span className="nsk-pay-secure">
          <ShieldCheck /> Secure · PhonePe
        </span>
      </header>

      <QueryState
        loading={schemeQuery.isLoading}
        error={schemeQuery.error}
        empty={!schemeQuery.isLoading && !scheme}
        retry={() => void schemeQuery.refetch()}
      >
        {scheme && (
          <>
            <div className="nsk-pay-body">
              <section className="nsk-pay-scheme">
                <div className="nsk-pay-scheme-top">
                  <BrandLogo variant="badge" size={42} className="nsk-pay-logo" />
                  <div className="nsk-pay-scheme-copy">
                    <div className="nsk-pay-name-row">
                      <h2>
                        {scheme.schemePlanId?.name ??
                          (isGold ? 'Gold Weight Scheme' : 'Cash Scheme')}
                      </h2>
                      <span className="nsk-active-pill">ACTIVE</span>
                    </div>
                    <div className="nsk-pay-meta-row">
                      <span>
                        <FileText /> {scheme.enrollmentNumber}
                      </span>
                      <span>
                        <CalendarDays /> Month {status?.schemeMonth ?? '—'} of{' '}
                        {scheme.durationMonths}
                      </span>
                    </div>
                    <span className={`nsk-phase-pill ${capped ? 'capped' : 'flexible'}`}>
                      <RefreshCw /> {capped ? 'Capped phase' : 'Flexible phase'}
                    </span>
                  </div>
                </div>
                <div className="nsk-pay-split">
                  <div>
                    <small>Total</small>
                    <b>{money(scheme.totalPaidPaise ?? 0)}</b>
                  </div>
                  <i aria-hidden="true" />
                  <div>
                    <small>{isGold ? '916 rate' : 'Duration'}</small>
                    <b>
                      {isGold
                        ? currentRate != null
                          ? `${money(currentRate)}/g`
                          : '—'
                        : `${scheme.durationMonths} months`}
                    </b>
                  </div>
                </div>
                {capped && (
                  <p className="nsk-pay-cap-note">
                    {money(remainingCap ?? 0)} available this month
                  </p>
                )}
              </section>

              <section className="nsk-amount-section">
                <label htmlFor="customer-pay-amount">Enter amount</label>
                <div className={`nsk-amount-box ${amountInvalid ? 'invalid' : ''}`}>
                  <span>₹</span>
                  <input
                    id="customer-pay-amount"
                    ref={amountRef}
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    placeholder="0"
                    aria-invalid={amountInvalid}
                    disabled={
                      scheme.status !== 'ACTIVE' || (capped && (remainingCap ?? 1) <= 0)
                    }
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setError('');
                    }}
                  />
                  {maxPaise != null && maxPaise > 0 && (
                    <button type="button" className="nsk-use-max" onClick={useMax}>
                      Use max
                    </button>
                  )}
                </div>
                <div className="nsk-amount-meta">
                  <small>
                    {minimumPaise > 0 ? `Min ${money(minimumPaise)}` : 'Any permitted amount'}
                    {maxPaise != null ? ` · Max ${money(maxPaise)}` : ''}
                  </small>
                  {withinLimit ? (
                    <em>
                      <Check /> Within limit
                    </em>
                  ) : amountInvalid ? (
                    <em className="bad">{validationMessage}</em>
                  ) : null}
                </div>
              </section>

              <section
                className={`nsk-conversion ${isGold ? 'gold' : 'cash'} ${hasAmount ? 'filled' : 'idle'}`}
                aria-live="polite"
              >
                <h3>{isGold ? '✦ GOLD CONVERSION ✦' : '✦ CASH CONTRIBUTION ✦'}</h3>
                {isGold ? (
                  <div className="nsk-conversion-grid">
                    <div>
                      <small>You Pay</small>
                      <b>
                        {hasAmount
                          ? money(displayAmountPaise ?? debouncedPaise ?? 0)
                          : '₹ —'}
                      </b>
                      <em>
                        {hasAmount && displayAmountPaise
                          ? amountInWords(displayAmountPaise)
                          : hasAmount && calculating
                            ? 'Calculating…'
                            : 'Type an amount above'}
                      </em>
                    </div>
                    <span className="nsk-swap" aria-hidden="true">
                      <ArrowLeftRight />
                    </span>
                    <div>
                      <small>You Receive</small>
                      <b>
                        {hasAmount
                          ? calculating && !goldGrams
                            ? '…'
                            : `${goldGrams ?? '—'} g`
                          : '— g'}
                      </b>
                      <em>
                        {hasAmount
                          ? calculating
                            ? 'Calculating gold weight…'
                            : currentRate != null
                              ? `At ${money(currentRate)}/g · 916`
                              : '(At 916 purity)'
                          : currentRate != null
                            ? `Live rate ${money(currentRate)}/g`
                            : '916 purity'}
                      </em>
                    </div>
                  </div>
                ) : (
                  <div className="nsk-conversion-grid cash">
                    <div>
                      <small>You Pay</small>
                      <b>
                        {hasAmount
                          ? money(displayAmountPaise ?? debouncedPaise ?? 0)
                          : '₹ —'}
                      </b>
                      <em>
                        {hasAmount
                          ? 'Credited to your cash scheme'
                          : 'Type an amount above'}
                      </em>
                    </div>
                  </div>
                )}
                {preview.isError && (
                  <button type="button" className="nsk-retry" onClick={() => void preview.refetch()}>
                    Retry preview
                  </button>
                )}
              </section>

              <div className="nsk-phonepe-trust">
                <span className="nsk-pe">Pe</span>
                <p>Secure payment powered by PhonePe · UPI · Instant confirmation</p>
                <Lock />
              </div>
            </div>

            <footer className="nsk-pay-footer">
              <div className="nsk-footer-summary">
                {hasAmount ? (
                  isGold ? (
                    <>
                      <b>
                        {money(amountPaise ?? debouncedPaise ?? 0)}
                        <span aria-hidden="true"> → </span>
                        {previewMatchesInput && goldGrams && !calculating
                          ? `${goldGrams} g`
                          : calculating || goldGrams
                            ? `${goldGrams ?? '…'} g`
                            : '— g'}
                      </b>
                      <small>
                        <span>You pay</span>
                        <span>You receive</span>
                      </small>
                    </>
                  ) : (
                    <>
                      <b>{money(amountPaise ?? debouncedPaise ?? 0)}</b>
                      <small>
                        <span>You pay</span>
                      </small>
                    </>
                  )
                ) : (
                  <>
                    <b className="muted">Enter amount</b>
                    <small>
                      <span>{isGold ? 'Gold weight appears here' : 'Contribution preview'}</span>
                    </small>
                  </>
                )}
              </div>
              <button
                type="button"
                className="nsk-phonepe-btn"
                disabled={!(canPay || preview.isError || quoteExpired)}
                onClick={() => {
                  setError('');
                  if (preview.isError || quoteExpired) {
                    void preview.refetch();
                    return;
                  }
                  if (!canPay) return;
                  pay.mutate();
                }}
              >
                <span className="nsk-pe light">Pe</span>
                {buttonLabel}
              </button>
            </footer>
          </>
        )}
      </QueryState>
    </div>
  );
}
