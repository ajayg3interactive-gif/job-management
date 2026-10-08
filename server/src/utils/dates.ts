const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30).
export function isRealDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Date fields are stored as UTC dates, so convert at UTC midnight.
export const parseDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);
