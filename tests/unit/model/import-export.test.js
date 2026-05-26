import { describe, it, expect } from 'vitest';
import PedigreeImport from 'pedigree/model/import';
import BaseGraph from 'pedigree/model/baseGraph';
import simpleGG from '../fixtures/simple-pedigree-gg.json';

describe('PedigreeImport.initFromPhenotipsInternal', () => {
  it('loads a minimal fixture without throwing', () => {
    const graph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    expect(graph).toBeInstanceOf(BaseGraph);
  });

  it('produces the correct person count from fixture', () => {
    const graph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    let personCount = 0;
    for (let i = 0; i <= graph.getMaxRealVertexId(); i++) {
      if (graph.isPerson(i)) personCount++;
    }
    expect(personCount).toBe(3); // John, Jane, child
  });

  it('round-trips: serialize then re-import preserves person count', () => {
    const graph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    const serialized = graph.serialize();
    const graph2 = PedigreeImport.initFromPhenotipsInternal(serialized);

    let count1 = 0, count2 = 0;
    for (let i = 0; i <= graph.getMaxRealVertexId(); i++) {
      if (graph.isPerson(i)) count1++;
    }
    for (let i = 0; i <= graph2.getMaxRealVertexId(); i++) {
      if (graph2.isPerson(i)) count2++;
    }
    expect(count2).toBe(count1);
  });

  it('round-trips: person properties are preserved', () => {
    const graph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    const serialized = graph.serialize();
    const graph2 = PedigreeImport.initFromPhenotipsInternal(serialized);

    let foundMale = false;
    for (let i = 0; i <= graph2.getMaxRealVertexId(); i++) {
      if (graph2.isPerson(i) && graph2.properties[i].gender === 'M') {
        foundMale = true;
      }
    }
    expect(foundMale).toBe(true);
  });
});
