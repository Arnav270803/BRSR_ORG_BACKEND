export function now(): Date {
  return new Date();
}

export function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

export function addMinutes(date: Date, minutes: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCMinutes(nextDate.getUTCMinutes() + minutes);
  return nextDate;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}
