type LogoVariant = 'badge' | 'white' | 'gold' | 'wine';

const sources: Record<LogoVariant, string> = {
  badge: '/logo-badge.png',
  white: '/logo-white.png',
  gold: '/logo-gold.png',
  wine: '/logo-wine.png',
};

export function BrandLogo({
  variant = 'badge',
  size = 40,
  className = '',
  alt = 'Nakshathra Jewellers',
}: {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      className={`brand-logo brand-logo-${variant} ${className}`.trim()}
      src={sources[variant]}
      width={size}
      height={size}
      alt={alt}
      decoding="async"
    />
  );
}

export function BrandMark({
  variant = 'badge',
  size = 40,
  title = 'Nakshathra',
  subtitle = 'Jewellery Savings Schemes',
  inverted = false,
  className = '',
}: {
  variant?: LogoVariant;
  size?: number;
  title?: string;
  subtitle?: string;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <div className={`brand-mark-row ${inverted ? 'inverted' : ''} ${className}`.trim()}>
      <BrandLogo variant={variant} size={size} />
      <div>
        <b>{title}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
    </div>
  );
}
