import { describe, it, expect, afterEach, vi } from 'vitest';
import { toLocalIsoDate, parseLocalIsoDate } from 'pedigree/model/localDate';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import PedigreeImport from 'pedigree/model/import';
import simpleGG from '../fixtures/simple-pedigree-gg.json';

// East of UTC, UTC itself, west of UTC, and a half-hour offset.
const ZONES = ['Australia/Brisbane', 'UTC', 'America/New_York', 'Asia/Kolkata'];
const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
  vi.useRealTimers();
});

describe.each(ZONES)('dates are calendar dates, whatever the time zone (%s)', (zone) => {
  it('formats a date as its own day', () => {
    process.env.TZ = zone;
    expect(toLocalIsoDate(new Date(2016, 6, 12))).toBe('2016-07-12');
    expect(toLocalIsoDate('Tue Jul 12 2016')).toBe('2016-07-12');
    expect(toLocalIsoDate('2016-07-12')).toBe('2016-07-12');
    expect(toLocalIsoDate('')).toBe('');
    expect(toLocalIsoDate(null)).toBe('');
    expect(toLocalIsoDate('not a date')).toBe('');
  });

  it('reads YYYY-MM-DD as that day, not as UTC midnight', () => {
    process.env.TZ = zone;
    const d = parseLocalIsoDate('2016-07-12');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2016, 6, 12]);
    expect(parseLocalIsoDate('')).toBeNull();
    expect(parseLocalIsoDate('nonsense')).toBeNull();
  });

  it('writes a date answer as a FHIR date', () => {
    process.env.TZ = zone;
    expect(GA4GHFHIRConverter.answerToFhirValue('date', 'Tue Feb 11 2020')).toEqual({ valueDate: '2020-02-11' });
    expect(GA4GHFHIRConverter.answerToFhirValue('date', new Date(2020, 1, 11))).toEqual({ valueDate: '2020-02-11' });
    expect(GA4GHFHIRConverter.answerToFhirValue('date', '2020-02-11')).toEqual({ valueDate: '2020-02-11' });
  });
});

describe('the bundle timestamp carries the local UTC offset', () => {
  vi.stubGlobal('editor', { getQuestionnaireConfig: () => null, getFhirTerminologyHelper: () => ({}) });
  it.each([
    ['Australia/Brisbane', '+10:00'],
    ['Asia/Kolkata', '+05:30'],
    ['UTC', '+00:00'],
    ['America/New_York', '-05:00'],
  ])('%s -> %s', (zone, offset) => {
    process.env.TZ = zone;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, 12, 0, 0))); // January: no daylight saving in New York
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG))) }, 'all', null, null));
    expect(exported.timestamp.endsWith(offset)).toBe(true);
    // And it names the right instant.
    expect(new Date(exported.timestamp).getTime()).toBe(Date.UTC(2026, 0, 15, 12, 0, 0));
  });
});
