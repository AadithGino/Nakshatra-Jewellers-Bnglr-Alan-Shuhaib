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
}: {
  label: string;
  side: 'Front' | 'Back';
  url?: string | null;
  customerName?: string;
}) {
  if (!url) {
    return (
      <article className="aadhaar-doc-card empty">
        <div className="aadhaar-doc-empty">
          <IdCard />
          <strong>{side} not uploaded</strong>
          <small>No {label.toLowerCase()} on file yet</small>
        </div>
      </article>
    );
  }

  const pdf = isPdf(url);

  return (
    <article className="aadhaar-doc-card">
      <div className="aadhaar-doc-meta">
        <span>{side}</span>
        <a href={url} target="_blank" rel="noreferrer">
          Open <ExternalLink />
        </a>
      </div>
      {pdf ? (
        <a className="aadhaar-doc-pdf" href={url} target="_blank" rel="noreferrer">
          <FileText />
          <strong>PDF document</strong>
          <small>{side} side · tap to open</small>
        </a>
      ) : (
        <a className="aadhaar-doc-frame" href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={`${customerName ?? 'Customer'} Aadhaar ${side.toLowerCase()}`} />
        </a>
      )}
    </article>
  );
}

export function AadhaarDocumentSection({ aadhaar, customerName }: Props) {
  const hasAny = Boolean(aadhaar?.frontUrl || aadhaar?.backUrl || aadhaar?.frontKey || aadhaar?.backKey);

  return (
    <section className="aadhaar-doc-section">
      <div className="aadhaar-doc-head">
        <div className="aadhaar-doc-title">
          <span className="aadhaar-doc-icon">
            <IdCard />
          </span>
          <div>
            <small>KYC documents</small>
            <h2>Aadhaar verification</h2>
          </div>
        </div>
        <span className={`aadhaar-doc-badge ${hasAny ? 'ready' : ''}`}>
          <ShieldCheck />
          {aadhaar?.frontUrl && aadhaar?.backUrl
            ? 'Both sides on file'
            : hasAny
              ? 'Partial upload'
              : 'Not uploaded'}
        </span>
      </div>

      <div className="aadhaar-doc-grid">
        <SideCard
          label="Aadhaar front"
          side="Front"
          url={aadhaar?.frontUrl}
          customerName={customerName}
        />
        <SideCard
          label="Aadhaar back"
          side="Back"
          url={aadhaar?.backUrl}
          customerName={customerName}
        />
      </div>
    </section>
  );
}
