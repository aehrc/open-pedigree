/**
 * Calendar dates (a date of birth, a date of death) as the day they are, in the browser's own
 * time zone. Date#toISOString() and new Date('YYYY-MM-DD') both work in UTC, so used for a
 * calendar date they give the day before - east of UTC for the first (a date shown in
 * Brisbane), west of UTC for the second (a date picked in New York).
 */

function pad(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A 'YYYY-MM-DD' string as that day at local midnight; any other value as new Date() reads it.
 * Returns null for an empty or unreadable value.
 */
export function parseLocalIsoDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const match = ISO_DATE.exec(String(value));
  const d = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * The local calendar day of a Date, or of a date string (e.g. 'Tue Jul 12 2016', which is how a
 * person's dates are kept, or 'YYYY-MM-DD'), as 'YYYY-MM-DD'. '' for an empty or unreadable value.
 */
export function toLocalIsoDate(value: any): string {
  const d = parseLocalIsoDate(value);
  return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : '';
}

/**
 * The local UTC offset of a moment, as '+HH:MM' / '-HH:MM' (ISO 8601). getTimezoneOffset() is
 * minutes *behind* UTC, so its sign is the opposite.
 */
export function localUtcOffset(when: Date): string {
  const minutesAhead = -when.getTimezoneOffset();
  const abs = Math.abs(minutesAhead);
  return (minutesAhead >= 0 ? '+' : '-') + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60);
}
