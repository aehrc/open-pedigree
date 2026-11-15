import { describe, it, expect } from 'vitest';
import CTSSTerminology from 'pedigree/terminology/CTSSTerminology';

const BASE = 'https://clinicaltables.nlm.nih.gov/api/hpo/v3/search';
const terminology = new CTSSTerminology('phenotype', /.*/, 20, BASE, 'id', 'name');
// The query a lookup URL asks for (its q parameter, decoded). IDs usually reach getLookupURL
// sanitized, where a character sanitizeID has no code for comes back as a space; the tests passing a
// raw ID check the escaping for one that reaches it any other way.
const lookupQuery = (id) => new URL(terminology.getLookupURL(id)).searchParams.get('q');

describe('CTSSTerminology lookup URL', () => {
  it('asks for the ID as a phrase in the value column', () => {
    expect(lookupQuery(terminology.sanitizeID('HP:0001250'))).toBe('id:"HP:0001250"');
  });

  it('keeps every colon in the ID, not just the first', () => {
    expect(lookupQuery(terminology.sanitizeID('ORPHA:123:456'))).toBe('id:"ORPHA:123:456"');
  });

  it('keeps an ID with a space whole', () => {
    expect(lookupQuery(terminology.sanitizeID('Seizure (finding)'))).toBe('id:"Seizure (finding)"');
  });

  it('escapes quotes and backslashes inside the phrase', () => {
    expect(lookupQuery('a"b\\c')).toBe('id:"a\\"b\\\\c"');
  });

  it('keeps characters that would end the parameter (& # +) in the ID', () => {
    expect(lookupQuery('A&B#C+D')).toBe('id:"A&B#C+D"');
  });

  it('sends the terms parameter the service requires, even though it is empty', () => {
    // (the NLM service answers "Bad request" without one)
    expect(new URL(terminology.getLookupURL('HP_C_0001250')).searchParams.has('terms')).toBe(true);
  });

  it('asks for the service\'s largest page, as a short code can be part of many others', () => {
    expect(new URL(terminology.getLookupURL('E11')).searchParams.get('maxList')).toBe('500');
  });

  it('asks for the value and text columns, as the text is read from the second', () => {
    expect(new URL(terminology.getLookupURL('HP_C_0001250')).searchParams.get('df')).toBe('id,name');
  });
});

describe('CTSSTerminology search URL', () => {
  it('keeps characters that would end the parameter (& # +) in the search term', () => {
    expect(new URL(terminology.getSearchURL('A&B #1+2')).searchParams.get('terms')).toBe('A&B #1+2');
  });
});

describe('CTSSTerminology lookup response', () => {
  const response = (rows) => ({ responseText: JSON.stringify([rows.length, rows.map((r) => r[0]), null, rows]) });

  it('gives the text of the row for the code asked for', () => {
    expect(terminology.processLookupResponse('HP_C_0001250', response([['HP:0001250', 'Seizure']]))).toBe('Seizure');
  });

  it('skips a row for another code the search also matched', () => {
    expect(terminology.processLookupResponse('HP_C_0001250', response([['HP:0001250X', 'Other'], ['HP:0001250', 'Seizure']])))
      .toBe('Seizure');
    expect(() => terminology.processLookupResponse('HP_C_0001250', response([['HP:0001250X', 'Other']]))).toThrow();
  });

  it('finds a code with characters IDs are not kept with (sanitized to the same ID)', () => {
    expect(terminology.processLookupResponse(terminology.sanitizeID('A+B'), response([['A+B', 'Plus']]))).toBe('Plus');
  });

  it('takes the code in the same case before one differing only in case', () => {
    expect(terminology.processLookupResponse('AB1', response([['ab1', 'Other'], ['AB1', 'Wanted']]))).toBe('Wanted');
  });

  it('takes the code whatever its case', () => {
    expect(terminology.processLookupResponse('hp_C_0001250', response([['HP:0001250', 'Seizure']]))).toBe('Seizure');
  });

  it('fails when nothing is found', () => {
    expect(() => terminology.processLookupResponse('HP_C_0001250', response([]))).toThrow('Failed to find result in response');
  });
});

describe('CTSSTerminology column names', () => {
  it('are encoded whole', () => {
    const odd = new CTSSTerminology('phenotype', /.*/, 20, BASE, 'code&x', 'name');
    expect(new URL(odd.getLookupURL('A')).searchParams.get('df')).toBe('code&x,name');
    expect(new URL(odd.getSearchURL('A')).searchParams.get('df')).toBe('code&x,name');
  });
});
