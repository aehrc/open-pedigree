import { describe, it, expect } from 'vitest';
import { ImportProblems, ProblemList, MAX_LISTED, notesMessage, personReference } from 'pedigree/model/importProblems';
import { importError } from 'pedigree/model/validateImportedGraph';

// What throwIfAny throws, caught.
const thrownBy = (found) => {
  try {
    found.throwIfAny();
  } catch (err) {
    return err;
  }
  return undefined;
};

describe('ProblemList', () => {
  it('throws nothing when nothing was found', () => {
    expect(thrownBy(new ProblemList())).toBeUndefined();
  });

  it('throws a single problem as its text, exactly as importers always have', () => {
    const found = new ProblemList();
    found.add('Multiple persons with the same ID [3]');
    expect(thrownBy(found)).toBe('Multiple persons with the same ID [3]');
  });

  it('throws several problems as one, listing them numbered in the order found', () => {
    const found = new ProblemList();
    found.add('Input line has not enough columns: [fam 3]');
    found.add('Multiple persons with the same ID [4]');
    const err = thrownBy(found);
    expect(err).toBeInstanceOf(ImportProblems);
    expect(err.problems).toEqual(['Input line has not enough columns: [fam 3]', 'Multiple persons with the same ID [4]']);
    expect(String(err)).toBe('Unable to import pedigree: 2 problems found:\n'
      + '1. Input line has not enough columns: [fam 3]\n'
      + '2. Multiple persons with the same ID [4]');
    // as callers show it
    expect('Error importing pedigree: ' + err).toContain('2 problems found:\n1. ');
  });

  it('lists the same problem once', () => {
    const found = new ProblemList();
    found.add('Phenotypes with codes other than 0 or 1 were found');
    found.add('Phenotypes with codes other than 0 or 1 were found');
    expect(thrownBy(found)).toBe('Phenotypes with codes other than 0 or 1 were found');
  });

  it(`lists at most ${MAX_LISTED}, then how many more, and keeps them all`, () => {
    const found = new ProblemList();
    for (let i = 1; i <= 25; i++) {
      found.add('problem ' + i);
    }
    const err = thrownBy(found);
    expect(err.problems).toHaveLength(25);
    const lines = err.message.split('\n');
    expect(lines[0]).toBe('Unable to import pedigree: 25 problems found:');
    expect(lines[20]).toBe('20. problem 20');
    expect(lines[21]).toBe('... and 5 more');
    expect(lines).toHaveLength(22);
  });

  it('carries notes on a failure; a single problem with notes still reads as that problem', () => {
    const found = new ProblemList();
    found.add('Multiple persons with the same ID [3]');
    found.note('Maya: 1 other parent(s) were left out');
    const err = thrownBy(found);
    expect(String(err)).toBe('Multiple persons with the same ID [3]');
    expect(err.notes).toEqual(['Maya: 1 other parent(s) were left out']);
    expect(err.messageWithNotes()).toBe('Multiple persons with the same ID [3]\n\nAlso noted:\n1. Maya: 1 other parent(s) were left out');
  });

  it('names a person in a problem by name and ID, so two of the same name stay apart', () => {
    expect(personReference({ fName: 'John', lName: 'Smith', id: 'p1' })).toBe('John Smith [p1]');
    expect(personReference({ fName: 'John', lName: 'Smith', id: 'p2' })).not.toBe(personReference({ fName: 'John', lName: 'Smith', id: 'p1' }));
    expect(personReference({ id: 'p3' })).toBe('[p3]');
    expect(personReference({})).toBe('a person with no name or ID');
  });

  it('puts notes on a graph, and nothing when there are none', () => {
    const found = new ProblemList();
    const graph = {};
    found.attachNotes(graph);
    expect(graph).not.toHaveProperty('importNotes');
    found.note('n1');
    expect(found.attachNotes(graph).importNotes).toEqual(['n1']);
  });

  it('words notes shown after an import', () => {
    expect(notesMessage(['a'])).toBe('Imported, with 1 note:\n1. a');
    expect(notesMessage(['a', 'b'])).toBe('Imported, with 2 notes:\n1. a\n2. b');
  });
});

describe('importError and ImportProblems', () => {
  it('leaves every problem found as it is', () => {
    const err = new ImportProblems(['a', 'b']);
    expect(importError(err)).toBe(err);
  });

  it('is matched by its message where a test expects a throw', () => {
    expect(() => { throw new ImportProblems(['a', 'b']); }).toThrow('2 problems found');
  });
});
