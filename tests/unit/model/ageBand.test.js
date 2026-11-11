import { describe, it, expect } from 'vitest';
import { ageBand, deidentifiedAgeLabel } from 'pedigree/model/ageBand';

const TODAY = new Date(2026, 10, 11);
const born = (y, m, d) => new Date(y, m - 1, d);

describe('ageBand', () => {
  it.each([
    [born(2026, 8, 11), 'infant'],
    [born(2025, 11, 12), 'infant'], // a day short of 1
    [born(2025, 11, 11), 'child'],  // 1 today
    [born(2017, 1, 1), 'child'],    // 9
    [born(2016, 11, 11), 'teen'],   // 10
    [born(2007, 1, 1), 'teen'],     // 19
    [born(2006, 11, 11), '20s'],    // 20
    [born(1981, 5, 1), '40s'],      // 45
    [born(1926, 1, 1), '100s'],
  ])('born %s is %s', (birth, band) => {
    expect(ageBand(birth, null, TODAY)).toBe(band);
  });

  it('measures to the date of death', () => {
    expect(ageBand(born(1926, 6, 1), born(1998, 7, 1), TODAY)).toBe('70s');
  });

  it('has no band without a birth date, or with a birth after the end', () => {
    expect(ageBand(null, null, TODAY)).toBeNull();
    expect(ageBand(new Date('x'), null, TODAY)).toBeNull();
    expect(ageBand(born(2027, 1, 1), null, TODAY)).toBeNull();
  });
});

describe('deidentifiedAgeLabel', () => {
  it('writes the band', () => {
    expect(deidentifiedAgeLabel(born(1981, 5, 1), null, false, TODAY)).toBe('40s');
  });

  it('writes "d." and the band at death for someone deceased', () => {
    expect(deidentifiedAgeLabel(born(1926, 6, 1), born(1998, 7, 1), true, TODAY)).toBe('d. 70s');
  });

  it('writes "d." alone for someone deceased with no birth date', () => {
    expect(deidentifiedAgeLabel(null, born(1998, 7, 1), true, TODAY)).toBe('d.');
  });

  it('writes "d." alone for someone deceased with no date of death (their age at death is unknown)', () => {
    expect(deidentifiedAgeLabel(born(1981, 5, 1), null, true, TODAY)).toBe('d.');
  });

  it('writes nothing for a living person with no birth date', () => {
    expect(deidentifiedAgeLabel(null, null, false, TODAY)).toBeNull();
  });
});
