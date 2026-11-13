import { describe, it, expect } from 'vitest';
import Controller from 'pedigree/controller';

describe('Controller._genesBeforeResults', () => {
  it('puts setGenes before setGeneResults, keeping the rest in order', () => {
    const ordered = Controller._genesBeforeResults({ setGeneResults: { A: 'negative' }, setGender: 'F', setGenes: ['A'] });
    expect(Object.keys(ordered)).toEqual(['setGenes', 'setGeneResults', 'setGender']);
    expect(ordered.setGenes).toEqual(['A']);
    expect(ordered.setGeneResults).toEqual({ A: 'negative' });
  });

  it('leaves an event with only one of them as it is', () => {
    const only = { setGeneResults: { A: 'negative' }, setGender: 'F' };
    expect(Controller._genesBeforeResults(only)).toBe(only);
  });
});
