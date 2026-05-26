import { describe, it, expect } from 'vitest';
import {
  isInt,
  replaceInArray,
  removeFirstOccurrenceByValue,
  filterUnique,
  arrayContains,
  clone2DArray,
} from 'pedigree/model/helpers';

describe('isInt', () => {
  it('accepts plain integers', () => {
    expect(isInt(42)).toBe(true);
    expect(isInt(0)).toBe(true);
    expect(isInt(-5)).toBe(true);
  });

  it('accepts numeric strings that are whole numbers', () => {
    expect(isInt('42')).toBe(true);
  });

  it('accepts floats with no fractional part', () => {
    expect(isInt(3.0)).toBe(true);
  });

  it('rejects floats with fractional part', () => {
    expect(isInt(3.5)).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(isInt('abc')).toBe(false);
  });

  it('rejects null', () => {
    expect(isInt(null)).toBe(false);
  });
});

describe('replaceInArray', () => {
  it('replaces the first occurrence only', () => {
    const arr = [1, 2, 1];
    replaceInArray(arr, 1, 9);
    expect(arr).toEqual([9, 2, 1]);
  });

  it('does nothing when value is not found', () => {
    const arr = [1, 2, 3];
    replaceInArray(arr, 5, 9);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('removeFirstOccurrenceByValue', () => {
  it('removes the first matching element', () => {
    const arr = [1, 2, 1, 3];
    removeFirstOccurrenceByValue(arr, 1);
    expect(arr).toEqual([2, 1, 3]);
  });

  it('does nothing when value is absent', () => {
    const arr = [1, 2, 3];
    removeFirstOccurrenceByValue(arr, 9);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('filterUnique', () => {
  it('removes duplicate values (each value appears exactly once)', () => {
    const result = filterUnique([1, 2, 1, 3]);
    expect(result.slice().sort()).toEqual([1, 2, 3]);
  });

  it('returns all values when all unique', () => {
    const result = filterUnique([1, 2, 3]);
    expect(result.slice().sort()).toEqual([1, 2, 3]);
  });

  it('returns empty array for empty input', () => {
    expect(filterUnique([])).toEqual([]);
  });
});

describe('arrayContains', () => {
  it('returns true when item is present', () => {
    expect(arrayContains([1, 2, 3], 2)).toBe(true);
  });

  it('returns false when item is absent', () => {
    expect(arrayContains([1, 2, 3], 9)).toBe(false);
  });
});

describe('clone2DArray', () => {
  it('produces a deep copy', () => {
    const original = [[1, 2], [3, 4]];
    const copy = clone2DArray(original);
    copy[0][0] = 99;
    expect(original[0][0]).toBe(1);
  });

  it('preserves values', () => {
    const original = [[1, 2], [3, 4]];
    expect(clone2DArray(original)).toEqual([[1, 2], [3, 4]]);
  });
});
