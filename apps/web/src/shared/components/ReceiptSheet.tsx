import type { ReactNode } from 'react';
import { CheckCircle2, Download, IndianRupee } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Status } from './ui';
import { date, goldGrams, money } from '../utils/format';

export type ReceiptPayment = {
  receiptNumber?: string;
  amountPaise?: number;
  paymentDate?: string | Date;
  method?: string;
  status?: string;
  referenceNumber?: string | null;
  goldRatePerGramPaise?: number | null;
  goldWeightMg?: number | null;
  goldPurity?: string | null;
  customerId?: {
    customerCode?: string;
    userId?: { name?: string; phone?: string } | null;
  } | null;
  schemeId?: {
    enrollmentNumber?: string;
    schemeType?: string;
  } | null;
};

function safeDate(value?: string | Date | null) {
  if (value == null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return date(parsed);
}

export function ReceiptSheet({
  payment,
  title = 'Payment receipt',
  brand = 'NAKSHATHRA JEWELLERS',
  amountLabel = 'Payment received',
  footerNote = 'This receipt is generated from the permanent payment ledger.',
  actions,
  showPrint = true,
}: {
  payment: ReceiptPayment;
  title?: string;
  brand?: string;
  amountLabel?: string;
  footerNote?: string;
  actions?: ReactNode;
  showPrint?: boolean;
}) {
  const weightLabel = goldGrams(payment.goldWeightMg);
  const amountPaise = Number(payment.amountPaise ?? 0);
  const paymentDateLabel = safeDate(payment.paymentDate);
  const statusValue =
    typeof payment.status === 'string' && payment.status.trim() ? payment.status : null;
  const customerName = payment.customerId?.userId?.name;
  const customerCode = payment.customerId?.customerCode;
  const enrollment = payment.schemeId?.enrollmentNumber;

  return (
    <div className="receipt-sheet">
      <header className="receipt-brand">
        <BrandLogo variant="badge" size={52} className="receipt-brand-logo" />
        <small>{brand}</small>
        <h2>{title}</h2>
        <p>{payment.receiptNumber ?? 'Pending receipt'}</p>
      </header>

      <div className="receipt-paid">
        <CheckCircle2 />
        <span>
          <small>{amountLabel}</small>
          <strong>{money(Number.isFinite(amountPaise) ? amountPaise : 0)}</strong>
        </span>
      </div>

      <div className="receipt-lines">
        {customerName && (
          <div>
            <span>Customer</span>
            <b>{customerName}</b>
          </div>
        )}
        {customerCode && (
          <div>
            <span>Passbook ID</span>
            <b>{customerCode}</b>
          </div>
        )}
        {enrollment && (
          <div>
            <span>Enrollment</span>
            <b>{enrollment}</b>
          </div>
        )}
        {paymentDateLabel && (
          <div>
            <span>Date</span>
            <b>{paymentDateLabel}</b>
          </div>
        )}
        {payment.method && (
          <div>
            <span>Payment method</span>
            <b>{payment.method}</b>
          </div>
        )}
        {statusValue && (
          <div>
            <span>Status</span>
            <Status value={statusValue} />
          </div>
        )}
        <div>
          <span>Reference</span>
          <b>{payment.referenceNumber || '—'}</b>
        </div>
        {payment.goldRatePerGramPaise ? (
          <div>
            <span>{payment.goldPurity ?? '916'} gold rate</span>
            <b>{money(payment.goldRatePerGramPaise)} / g</b>
          </div>
        ) : null}
        {weightLabel ? (
          <div className="receipt-highlight">
            <span>Gold credited</span>
            <b>{weightLabel}</b>
          </div>
        ) : null}
      </div>

      <p className="receipt-note">
        <IndianRupee /> {footerNote}
      </p>

      {showPrint ? (
        <button type="button" className="secondary wide-action receipt-print" onClick={() => window.print()}>
          <Download /> Print / save receipt
        </button>
      ) : null}
      {actions}
    </div>
  );
}
