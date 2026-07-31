import { ExternalLink, FileText, IdCard, ShieldCheck } from 'lucide-react';

type AadhaarDocs = {
  frontUrl?: string | null;
  backUrl?: string | null;
  frontKey?: string | null;
  backKey?: string | null;
} | null;

type Props = {
  aadhaar?: AadhaarDocs;
  customerName?: string;
  /** Large previews (admin). Staff should use `chips`. */
  compact?: boolean;
  variant?: 'cards' | 'chips';
};

function isPdf(url?: string | null) {
  if (!url) return false;
  return /\.pdf($|\?)/i.test(url);
}

function SideCard({
  label,
  side,
  url,
  customerName,
  compact,
}: {
  label: string;
  side: 'Front' | 'Back';
  url?: string | null;
  customerName?: string;
  compact?: boolean;
}) {
  if (!url) {
    return (
      <article className={`aadhaar-doc-card empty${compact ? ' compact' : ''}`}>
        <div className="aadhaar-doc-empty">
          <IdCard />
          <strong>{side} missing</strong>
          {!compact ? <small>No {label.toLowerCase()} on file yet</small> : null}
        </div>
      </article>
    );
  }

  const pdf = isPdf(url);

  return (
    <article className={`aadhaar-doc-card${compact ? ' compact' : ''}`}>
      <div className="aadhaar-doc-meta">
        <span>{side}</span>
        <a href={url} target="_blank" rel="noreferrer">
          Open <ExternalLink />
        </a>
      </div>
      {pdf ? (
        <a className="aadhaar-doc-pdf" href={url} target="_blank" rel="noreferrer">
          <FileText />
          <strong>PDF</strong>
          {!compact ? <small>{side} side · tap to open</small> : null}
        </a>
      ) : (
        <a className="aadhaar-doc-frame" href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={`${customerName ?? 'Customer'} Aadhaar ${side.toLowerCase()}`} />
        </a>
      )}
    </article>
  );
}

function ChipSide({ side, url }: { side: 'Front' | 'Back'; url?: string | null }) {
  if (!url) {
    return (
      <span className="aadhaar-chip missing">
        <IdCard />
        {side} missing
      </span>
    );
  }

  return (
    <a className="aadhaar-chip" href={url} target="_blank" rel="noreferrer">
      {isPdf(url) ? <FileText /> : <IdCard />}
      {side}
      <ExternalLink />
    </a>
  );
}

export function AadhaarDocumentSection({
  aadhaar,
  customerName,
  compact = false,
  variant = 'cards',
}: Props) {
  const hasAny = Boolean(aadhaar?.frontUrl || aadhaar?.backUrl || aadhaar?.frontKey || aadhaar?.backKey);
  const mode = variant === 'chips' || compact ? (variant === 'chips' ? 'chips' : 'cards') : 'cards';

  if (mode === 'chips' || variant === 'chips') {
    return (
      <section className="aadhaar-chip-row">
        <div className="aadhaar-chip-label">
          <IdCard />
          <span>Aadhaar</span>
          <em className={hasAny ? 'ready' : ''}>
            <ShieldCheck />
            {aadhaar?.frontUrl && aadhaar?.backUrl ? 'On file' : hasAny ? 'Partial' : 'Missing'}
          </em>
        </div>
        <div className="aadhaar-chip-actions">
          <ChipSide side="Front" url={aadhaar?.frontUrl} />
          <ChipSide side="Back" url={aadhaar?.backUrl} />
        </div>
      </section>
    );
  }

  return (
    <section className={`aadhaar-doc-section${compact ? ' compact' : ''}`}>
      <div className="aadhaar-doc-head">
        <div className="aadhaar-doc-title">
          <span className="aadhaar-doc-icon">
            <IdCard />
          </span>
          <div>
            <small>KYC</small>
            <h2>{compact ? 'Aadhaar' : 'Aadhaar verification'}</h2>
          </div>
        </div>
        <span className={`aadhaar-doc-badge ${hasAny ? 'ready' : ''}`}>
          <ShieldCheck />
          {aadhaar?.frontUrl && aadhaar?.backUrl
            ? compact
              ? 'On file'
              : 'Both sides on file'
            : hasAny
              ? 'Partial'
              : 'Missing'}
        </span>
      </div>

      <div className="aadhaar-doc-grid">
        <SideCard
          label="Aadhaar front"
          side="Front"
          url={aadhaar?.frontUrl}
          customerName={customerName}
          compact={compact}
        />
        <SideCard
          label="Aadhaar back"
          side="Back"
          url={aadhaar?.backUrl}
          customerName={customerName}
          compact={compact}
        />
      </div>
    </section>
  );
}
