export const isoDate = (value: Date) => value.toISOString().slice(0, 10);

export function currentMonthRange(): [string, string] {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [isoDate(from), isoDate(to)];
}

export function maturityDefaultRange(): [string, string] {
  const from = new Date();
  const to = new Date(from);
  to.setFullYear(to.getFullYear() + 1);
  return [isoDate(from), isoDate(to)];
}

export function formatReportDateRange(from: string, to: string): string {
  if (!from || !to) return 'Select date range';
  const format = (iso: string, withYear: boolean) =>
    new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'Asia/Kolkata',
    }).format(new Date(`${iso}T00:00:00`));
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const currentYear = String(new Date().getFullYear());
  const showYear = !sameYear || from.slice(0, 4) !== currentYear;
  return `${format(from, false)} - ${format(to, showYear)}`;
}

export function eachDayInRange(from: string, to: string): string[] {
  if (!from || !to) return [];
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    days.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function shortDayLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${iso}T00:00:00`));
}
