import { describe, it, expect } from 'vitest';
import PedigreeImport from 'pedigree/model/import';
import { importError } from 'pedigree/model/validateImportedGraph';
import BaseGraph from 'pedigree/model/baseGraph';

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

describe('importError', () => {
  it('words an importer\'s own failure as a validation failure', () => {
    expect(importError('Assertion failed: adding relationship to a non-person node')).toBe('Unable to import pedigree (adding relationship to a non-person node)');
    expect(importError(new TypeError('x is undefined'))).toBe('Unable to import pedigree (x is undefined)');
  });

  it('leaves a message that is already worded for the user', () => {
    expect(importError('Unable to import pedigree: ambiguous reference to [a]')).toBe('Unable to import pedigree: ambiguous reference to [a]');
    expect(importError('Unsupported pedigree: some components of the imported pedigree are disconnected from each other (x)'))
      .toBe('Unsupported pedigree: some components of the imported pedigree are disconnected from each other (x)');
  });
});

describe('every problem with the structure of an imported pedigree', () => {
  // (thrown by an import, caught)
  const failure = (pedText) => {
    try {
      PedigreeImport.initFromPED(pedText, false, false, true);
    } catch (err) {
      return err;
    }
    return undefined;
  };
  const family = 'fam 1 0 0 1 1\nfam 2 0 0 2 1\nfam 3 1 2 1 1';

  it('reports each part cut off from the rest once, naming its people', () => {
    const err = failure(family + '\nfam 4 0 0 1 1\nfam 5 0 0 2 1\nfam 6 4 5 1 1\nfam 7 0 0 1 1\nfam 8 0 0 2 1\nfam 9 7 8 1 1');
    expect(err.problems).toHaveLength(2);
    expect(err.problems[0]).toMatch(/^Unsupported pedigree: .* disconnected from each other \(disconnected component detected \(\[id: \d+, .*PERSON\], \[id: \d+, .*PERSON\], \[id: \d+, .*PERSON\]\)\)$/);
    expect(String(err)).toMatch(/^Unable to import pedigree: 2 problems found:\n1\. Unsupported pedigree: .*\n2\. Unsupported pedigree: /);
  });

  it('finds each cut-off part once, not once per vertex in it', () => {
    const graph = PedigreeImport.initFromPED(family, false, false, true);
    for (let i = 0; i < 2; i++) {
      // a couple with a child, cut off from the family
      const father = graph._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'M' }, graph.defaultPersonNodeWidth);
      const mother = graph._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'F' }, graph.defaultPersonNodeWidth);
      const child = graph._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'U' }, graph.defaultPersonNodeWidth);
      const rel = graph._addVertex(null, BaseGraph.TYPE.RELATIONSHIP, {}, 1);
      const hub = graph._addVertex(null, BaseGraph.TYPE.CHILDHUB, {}, 1);
      graph.addEdge(father, rel, 1);
      graph.addEdge(mother, rel, 1);
      graph.addEdge(rel, hub, 1);
      graph.addEdge(hub, child, 1);
    }
    const problems = graph.findProblems();
    expect(problems).toHaveLength(2);
    expect(problems[0]).not.toBe(problems[1]);
  });

  it('names at most three people of a part, then how many more', () => {
    const err = failure(family + '\nfam 10 0 0 1 1\nfam 11 0 0 2 1\nfam 12 10 11 1 1\nfam 13 10 11 1 1\nfam 14 10 11 2 1');
    expect(err).toMatch(/ and 2 more\)\)$/);
    expect(String(err).match(/\[id: /g)).toHaveLength(3);
  });

  it('checks for cut-off parts only when every vertex is sound', () => {
    const graph = PedigreeImport.initFromPED(family, false, false, true);
    // a second person, unconnected, and a relationship with no childhub
    graph._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'M' }, graph.defaultPersonNodeWidth);
    const rel = graph._addVertex(null, BaseGraph.TYPE.RELATIONSHIP, {}, 1);
    const problems = graph.findProblems();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/all relationships should have a childhub/);
    expect(graph.getVertexDescription(rel)).toContain('RELATION');
  });

  it('validate still throws the first problem, as before', () => {
    const graph = PedigreeImport.initFromPED(family, false, false, true);
    graph._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'M' }, graph.defaultPersonNodeWidth);
    graph._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'F' }, graph.defaultPersonNodeWidth);
    expect(graph.findProblems()).toHaveLength(2);
    expect(() => graph.validate()).toThrow(graph.findProblems()[0]);
  });
});
