// Every number the app saves for a tournament is a whole number.
// Decimals (e.g. Fortnite Tracker PR points like 45.5) are rounded down before saving.

export function toWhole(value: number): number {
  return Number.isFinite(value) ? Math.floor(value) : 0;
}

export function toWholeOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.floor(value);
}
