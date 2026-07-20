export const money = (paise: number = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);

export const date = (value: string | Date) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(
    new Date(value),
  );

/** Format milligrams from the ledger as grams for display. */
export const goldGrams = (weightMg?: number | null) => {
  if (weightMg == null || !Number.isFinite(weightMg) || weightMg <= 0) return null;
  return `${(weightMg / 1000).toFixed(3)} g`;
};
