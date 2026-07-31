import type { ReactNode } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, Inbox, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Nakshathra Jewellers</p>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Metric({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <Card className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </Card>
  );
}

export function GoldRateBanner({
  ratePaise,
  updatedAt,
}: {
  ratePaise?: number;
  updatedAt?: string | Date;
}) {
  const updatedDate = updatedAt
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(updatedAt))
    : null;
  const updatedTime = updatedAt
    ? new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(new Date(updatedAt))
    : null;

  return (
    <section className="gold-rate-banner">
      <BrandLogo variant="badge" size={40} className="gold-rate-icon" />
      <div className="gold-rate-main">
        <small>Current 916 gold rate</small>
        <strong>
          {ratePaise ? `₹${(ratePaise / 100).toLocaleString('en-IN')}/g` : 'Not set'}
        </strong>
      </div>
      <div className="gold-rate-meta">
        <span>
          <ArrowUpRight /> Live
        </span>
        {updatedDate && updatedTime ? (
          <small>
            <em>{updatedDate}</em>
            <em>{updatedTime}</em>
          </small>
        ) : (
          <small>Awaiting update</small>
        )}
      </div>
    </section>
  );
}
export function QueryState({
  loading,
  error,
  empty,
  retry,
  children,
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  retry?: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="state">
        <LoaderCircle className="spin" />
        <p>Loading secure data…</p>
      </div>
    );
  if (error)
    return (
      <div className="state error">
        <AlertCircle />
        <p>{error.message}</p>
        {retry && (
          <button onClick={retry}>
            <RefreshCw />
            Retry
          </button>
        )}
      </div>
    );
  if (empty)
    return (
      <div className="state">
        <Inbox />
        <p>No records found.</p>
      </div>
    );
  return <>{children}</>;
}
export function Status({ value }: { value: string }) {
  return <span className={`status ${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span>;
}

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Notice({
  children,
  error = false,
  action,
}: {
  children?: ReactNode;
  error?: boolean;
  action?: ReactNode;
}) {
  if (!children) return null;
  return (
    <div className={`ui-notice ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>
      <span className="ui-notice-icon" aria-hidden="true">
        {error ? <AlertCircle /> : <CheckCircle2 />}
      </span>
      <div className="ui-notice-body">
        <p>{children}</p>
        {action ? <div className="ui-notice-action">{action}</div> : null}
      </div>
    </div>
  );
}
