/**
 * Calendar dates (a date of birth, a date of death) as the day they are, in the browser's own
 * time zone. Date#toISOString() and new Date('YYYY-MM-DD') both work in UTC, so used for a
 * calendar date they give the day before - east of UTC for the first (a date shown in
 * Brisbane), west of UTC for the second (a date picked in New York).
 */

function pad(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

// 'YYYY-MM-DD', or a partial date - 'YYYY' or 'YYYY-MM' - as FHIR allows (e.g. a Patient.birthDate
// of '1980'), or exactly UTC midnight, which is how earlier versions saved a date answer
// ('2016-07-12T00:00:00.000Z' - its date part is the day it meant). Any other timestamp is a
// moment - e.g. a local-midnight Date saved by the undo stack or an internal save, which is
// '2016-07-11T14:00:00.000Z' in Brisbane - and is read as one, by its local day.
const ISO_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:$|T00:00:00(?:\.0+)?Z$)/;
const PARTIAL_DATE = /^\d{4}(?:-\d{2})?$/;

/**
 * A 'YYYY-MM-DD' string (or ISO timestamp) as that day at local midnight; any other value as
 * new Date() reads it. Returns null for an empty or unreadable value, including a day or month
 * that doesn't exist ('2020-13-01' isn't rolled over into 2021).
 */
export function parseLocalIsoDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const match = ISO_DATE.exec(String(value));
  if (!match) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  // A partial date is its first day.
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) - 1 : 0;
  const day = match[3] ? Number(match[3]) : 1;
  const d = new Date(2000, month, day);
  d.setFullYear(year); // not new Date(year, ...), which puts years 0-99 in the 1900s
  return (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) ? d : null;
}

/**
 * The local calendar day of a Date, or of a date string (e.g. 'Tue Jul 12 2016', which is how a
 * person's dates are kept, or 'YYYY-MM-DD'), as 'YYYY-MM-DD'. '' for an empty or unreadable value.
 */
export function toLocalIsoDate(value: any): string {
  const d = parseLocalIsoDate(value);
  if (!d) {
    return '';
  }
  const year = String(d.getFullYear());
  return '0000'.slice(year.length) + year + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
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

/**
 * The one form a date answer is kept and compared in: a partial date ('1980', '1980-05') as
 * written - its precision is part of the answer - and anything else (a full date, an earlier
 * version's UTC timestamp, a Date) as its 'YYYY-MM-DD' day. An unreadable value is returned
 * as it is.
 */
export function dateAnswer(value: any): any {
  if (typeof value === 'string' && PARTIAL_DATE.test(value) && parseLocalIsoDate(value)) {
    return value;
  }
  return toLocalIsoDate(value) || value;
}
