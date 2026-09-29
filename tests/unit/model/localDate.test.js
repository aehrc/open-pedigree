import { describe, it, expect, afterEach, vi } from 'vitest';
import { toLocalIsoDate, parseLocalIsoDate, dateAnswer } from 'pedigree/model/localDate';
import { evaluateEnableWhen } from 'pedigree/questionnaire/enableWhenEvaluator';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import PedigreeImport from 'pedigree/model/import';
import simpleGG from '../fixtures/simple-pedigree-gg.json';
import { isUnusableAnswer } from 'pedigree/recordLinkProvider/linkedRecordRefresh';

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

  it('rejects a day or month that doesn\'t exist, rather than rolling it over', () => {
    process.env.TZ = zone;
    expect(parseLocalIsoDate('2020-13-01')).toBeNull();
    expect(parseLocalIsoDate('2020-00-10')).toBeNull();
    expect(parseLocalIsoDate('2021-02-29')).toBeNull();
    expect(toLocalIsoDate('2020-13-45')).toBe('');
    // So a record's mistyped date is still skipped, not written as some other day.
    expect(isUnusableAnswer('setBirthDate', '2020-13-45')).toBe(true);
    expect(isUnusableAnswer('setBirthDate', '2020-02-29')).toBe(false);
  });

  it('keeps a year below 100 as written', () => {
    process.env.TZ = zone;
    expect(parseLocalIsoDate('0050-06-01').getFullYear()).toBe(50);
    expect(toLocalIsoDate('0050-06-01')).toBe('0050-06-01');
  });

  it('reads a local-midnight date that went through JSON (the undo stack, an internal save) as its day', () => {
    process.env.TZ = zone;
    const saved = JSON.parse(JSON.stringify({ dob: new Date(2016, 6, 12) })).dob; // e.g. a GEDCOM-imported dob
    expect(toLocalIsoDate(saved)).toBe('2016-07-12');
    const d = parseLocalIsoDate(saved);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2016, 6, 12]);
    expect(dateAnswer(saved)).toBe('2016-07-12');
  });

  it('reads an ISO timestamp (how earlier versions saved a date answer) as its date', () => {
    process.env.TZ = zone;
    expect(toLocalIsoDate('2016-07-12T00:00:00.000Z')).toBe('2016-07-12');
    const d = parseLocalIsoDate('2016-07-12T00:00:00.000Z');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2016, 6, 12]);
    expect(GA4GHFHIRConverter.answerToFhirValue('date', '2016-07-12T00:00:00.000Z')).toEqual({ valueDate: '2016-07-12' });
  });

  it('reads a partial date (a year, or a year and month) as its first day, locally', () => {
    process.env.TZ = zone;
    const year = parseLocalIsoDate('1980');
    const month = parseLocalIsoDate('1980-05');
    expect([year.getFullYear(), year.getMonth(), year.getDate()]).toEqual([1980, 0, 1]);
    expect([month.getFullYear(), month.getMonth(), month.getDate()]).toEqual([1980, 4, 1]);
    expect(parseLocalIsoDate('1980-13')).toBeNull();
  });

  it('keeps a date answer in one form: partial as written, otherwise YYYY-MM-DD', () => {
    process.env.TZ = zone;
    expect(dateAnswer('1980')).toBe('1980');
    expect(dateAnswer('1980-05')).toBe('1980-05');
    expect(dateAnswer('2016-07-12')).toBe('2016-07-12');
    expect(dateAnswer('2016-07-12T00:00:00.000Z')).toBe('2016-07-12');
    expect(dateAnswer(new Date(2016, 6, 12))).toBe('2016-07-12');
    expect(GA4GHFHIRConverter.answerToFhirValue('date', '1980-05')).toEqual({ valueDate: '1980-05' });
    expect(GA4GHFHIRConverter.fhirValueToAnswer('date', { valueDate: '2016-07-12T00:00:00.000Z' })).toBe('2016-07-12');
    expect(GA4GHFHIRConverter.fhirValueToAnswer('date', { valueDate: '1980' })).toBe('1980');
  });

  it('compares an older, timestamp-form date answer by its date in enableWhen', () => {
    process.env.TZ = zone;
    const rule = (operator) => [{ question: 'visit', operator, answerDate: '2016-07-12' }];
    for (const saved of ['2016-07-12T00:00:00.000Z', '2016-07-12', new Date(2016, 6, 12)]) {
      expect(evaluateEnableWhen(rule('='), 'all', { visit: saved })).toBe(true);
      expect(evaluateEnableWhen(rule('<='), 'all', { visit: saved })).toBe(true);
      expect(evaluateEnableWhen(rule('>'), 'all', { visit: saved })).toBe(false);
    }
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
