import {
  chartPaths,
  rateWindow,
  sparklinePaths,
  trendTone,
  type GoldRatePoint,
} from '../utils/goldRateChart';

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  showEndDot?: boolean;
  id?: string;
};

export function GoldRateSparkline({
  values,
  width = 100,
  height = 36,
  className = '',
  showEndDot = true,
  id = 'spark',
}: SparklineProps) {
  const tone = trendTone(values);
  const { line, area } = sparklinePaths(values, width, height);
  if (!line) return <span className="gold-rate-sparkline empty">—</span>;

  const lastPoint = line.split(' ').at(-1)?.split(',') ?? ['0', '0'];
  const gradientId = `${id}-${tone}`;

  return (
    <span className={`gold-rate-sparkline ${tone} ${className}`.trim()} aria-hidden>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity=".28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline className="gold-rate-spark-area" points={area} fill={`url(#${gradientId})`} />
        <polyline className="gold-rate-spark-line" points={line} />
        {showEndDot && (
          <circle
            className="gold-rate-spark-dot"
            cx={lastPoint[0]}
            cy={lastPoint[1]}
            r="2.2"
          />
        )}
      </svg>
    </span>
  );
}

function formatAxisRupee(paise: number) {
  return (paise / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

function formatAxisDate(value?: string | Date) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function GoldRateTrendChart({
  rates,
  highlightId,
  windowSize = 24,
}: {
  rates: GoldRatePoint[];
  highlightId?: string;
  windowSize?: number;
}) {
  // Rates arrive newest-first; chart needs oldest → newest left to right.
  const chronological = [...rates].reverse().slice(-windowSize);
  const values = chronological.map((row) => row.ratePerGramPaise);
  const highlightIndex = chronological.findIndex((row) => String(row._id) === String(highlightId));

  const width = 720;
  const height = 220;
  const padding = 20;
  const { min, max, points } = chartPaths(
    values,
    width,
    height,
    padding,
    highlightIndex >= 0 ? highlightIndex : undefined,
  );

  if (!values.length) {
    return (
      <div className="gold-rate-trend-chart empty">
        <p>No nearby rate history to chart.</p>
      </div>
    );
  }

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const first = points[0];
  const last = points.at(-1);
  const areaPath =
    first && last
      ? [
          `M ${first.x} ${height - padding}`,
          ...points.map((point) => `L ${point.x} ${point.y}`),
          `L ${last.x} ${height - padding}`,
          'Z',
        ].join(' ')
      : '';

  const mid = (min + max) / 2;
  const startDate = chronological[0]?.effectiveFrom;
  const endDate = chronological.at(-1)?.effectiveFrom;
  const highlightPoint = highlightIndex >= 0 ? points[highlightIndex] : null;
  const highlightRate = highlightIndex >= 0 ? chronological[highlightIndex] : null;
  const pointRadius = points.length > 18 ? 2.4 : 3.2;

  return (
    <div className="gold-rate-trend-chart" aria-label="Gold rate trend chart">
      <div className="gold-rate-chart-y">
        <span>{formatAxisRupee(max)}</span>
        <span>{formatAxisRupee(mid)}</span>
        <span>{formatAxisRupee(min)}</span>
      </div>
      <div className="gold-rate-chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="goldRateChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c89222" stopOpacity=".32" />
              <stop offset="1" stopColor="#c89222" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((fraction) => {
            const y = padding + (height - padding * 2) * fraction;
            return (
              <line
                key={fraction}
                className="gold-rate-chart-grid"
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
              />
            );
          })}

          {areaPath ? <path className="gold-rate-chart-area" d={areaPath} /> : null}
          <polyline className="gold-rate-chart-line" points={linePoints} />

          {points.map((point) => (
            <circle
              key={point.index}
              className="gold-rate-chart-point"
              cx={point.x}
              cy={point.y}
              r={pointRadius}
            />
          ))}

          {highlightPoint && (
            <>
              <line
                className="gold-rate-chart-marker-line"
                x1={highlightPoint.x}
                x2={highlightPoint.x}
                y1={padding}
                y2={height - padding}
              />
              <circle
                className="gold-rate-chart-marker"
                cx={highlightPoint.x}
                cy={highlightPoint.y}
                r="6"
              />
            </>
          )}
        </svg>

        <div className="gold-rate-chart-x">
          <span>{formatAxisDate(startDate)}</span>
          {highlightRate && (
            <span className="gold-rate-chart-x-current">
              This rate · {formatAxisDate(highlightRate.effectiveFrom)} ·{' '}
              {formatAxisRupee(highlightRate.ratePerGramPaise)}
            </span>
          )}
          <span>{formatAxisDate(endDate)}</span>
        </div>
      </div>
    </div>
  );
}

export function rowSparklineValues(rates: GoldRatePoint[], index: number) {
  return rateWindow(rates, index, 8);
}
