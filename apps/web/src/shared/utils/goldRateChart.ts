export type GoldRatePoint = {
  _id?: string;
  ratePerGramPaise: number;
  effectiveFrom?: string | Date;
};

export function rateWindow(rates: GoldRatePoint[], index: number, size = 8): number[] {
  const slice = rates.slice(index, Math.min(rates.length, index + size));
  return [...slice].reverse().map((row) => row.ratePerGramPaise);
}

export function dayChange(current: number, previous?: number) {
  if (!previous) return { paise: 0, percent: null as number | null };
  const paise = current - previous;
  const percent = (paise / previous) * 100;
  return { paise, percent };
}

export function sparklinePaths(
  values: number[],
  width = 100,
  height = 36,
  padding = 3,
) {
  if (!values.length) return { line: '', area: '', min: 0, max: 0, last: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const last = values.at(-1) ?? 0;
  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + (height - padding * 2) * (1 - (value - min) / range);
    return `${x},${y}`;
  });
  const line = points.join(' ');
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  return { line, area, min, max, last };
}

export function trendTone(values: number[]) {
  if (values.length < 2) return 'flat' as const;
  const delta = values.at(-1)! - values[0]!;
  if (delta > 0) return 'up' as const;
  if (delta < 0) return 'down' as const;
  return 'flat' as const;
}

export function formatPercent(value: number | null, digits = 2) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function chartPaths(
  values: number[],
  width = 100,
  height = 100,
  padding = 4,
  highlightIndex?: number,
) {
  if (!values.length) {
    return {
      line: '',
      area: '',
      min: 0,
      max: 0,
      points: [] as { x: number; y: number; value: number; index: number }[],
      highlight: null as { x: number; y: number } | null,
    };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + (height - padding * 2) * (1 - (value - min) / range);
    return { x, y, value, index };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const highlight =
    highlightIndex != null && points[highlightIndex]
      ? { x: points[highlightIndex].x, y: points[highlightIndex].y }
      : null;
  return { line, area, min, max, points, highlight };
}
