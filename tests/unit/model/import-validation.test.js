import { describe, it, expect } from 'vitest';
import PedigreeImport from 'pedigree/model/import';

const DISCONNECTED = 'Unsupported pedigree: some components of the imported pedigree are disconnected from each other';

// A stand-in graph whose validate() fails with the given error.
const failingWith = (err) => ({
  validate: () => {
    throw err;
  },
});

describe('PedigreeImport.validateBaseGraph', () => {
  it('reports a disconnected pedigree as disconnected', () => {
    // two unrelated people: nothing links them
    expect(() => PedigreeImport.initFromPED('fam 1 0 0 1 1\nfam 2 0 0 2 1', false, false, true))
      .toThrow(DISCONNECTED);
  });

  it('says where, as validate gives it, for a real disconnected pedigree', () => {
    expect(() => PedigreeImport.initFromPED('fam 1 0 0 1 1\nfam 2 0 0 2 1', false, false, true))
      .toThrow(/^Unsupported pedigree: .* disconnected from each other \(disconnected component detected \(\[id: \d+, .*type: [A-Z]+\]\)\)$/);
  });

  it('says who is disconnected, without the internal "Assertion failed"', () => {
    expect(() => PedigreeImport.validateBaseGraph(failingWith('Assertion failed: disconnected component detected (person 7)')))
      .toThrow(DISCONNECTED + ' (disconnected component detected (person 7))');
  });

  it('imports a connected pedigree', () => {
    expect(() => PedigreeImport.initFromPED('fam 1 0 0 1 1\nfam 2 0 0 2 1\nfam 3 1 2 1 1', false, false, true))
      .not.toThrow();
  });

  it('gives any other validation failure as itself, not as disconnected', () => {
    expect(() => PedigreeImport.validateBaseGraph(failingWith('Assertion failed: person 3 has two sets of parents')))
      .toThrow('Unable to import pedigree (person 3 has two sets of parents)');
  });

  it('handles an Error object, not only a thrown string', () => {
    expect(() => PedigreeImport.validateBaseGraph(failingWith(new Error('disconnected component detected (3)'))))
      .toThrow(DISCONNECTED);
    expect(() => PedigreeImport.validateBaseGraph(failingWith(new TypeError('x is undefined'))))
      .toThrow('Unable to import pedigree (x is undefined)');
  });
});
