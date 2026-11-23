import { describe, it, expect } from 'vitest';
import DynamicPositionedGraph from 'pedigree/model/dynamicGraph';

// Adopted in vs adopted out (pedigree-adopted-in-out): only adopted IN means the parents drawn
// are adoptive. An adopted-out person's parents are their birth parents, so the graph treats them
// like any child's.

function graphFromPED(ped) {
  const graph = DynamicPositionedGraph.makeEmpty(10, 2);
  graph.fromImport(ped, 'ped', { externalIdMark: true });
  return graph;
}

function person(graph, ext) {
  for (let v = 0; v <= graph.getMaxNodeId(); v++) {
    if (graph.isPerson(v) && graph.getProperties(v).externalID === ext) {
      return v;
    }
  }
  throw new Error('no person ' + ext);
}

function setProps(graph, ext, props) {
  const v = person(graph, ext);
  graph.setProperties(v, { ...graph.getProperties(v), ...props });
  graph.updateAncestors();
}

// First cousins X (child of A) and Y (child of B) have a child Z; A and B are siblings.
const COUSINS = [
  'f G1 0 0 1 1', 'f G2 0 0 2 1',
  'f A G1 G2 1 1', 'f AW 0 0 2 1',
  'f B G1 G2 2 1', 'f BH 0 0 1 1',
  'f X A AW 1 1', 'f Y BH B 2 1',
  'f Z X Y 1 1',
].join('\n');

function cousinsCouple(graph) {
  return graph.getParentRelationship(person(graph, 'Z'));
}

describe('adopted in vs adopted out in the graph', () => {
  it('finds consanguinity through an adopted-out person, as through a birth child', () => {
    const graph = graphFromPED(COUSINS);
    expect(graph.isConsangrRelationship(cousinsCouple(graph))).toBe(true);
    setProps(graph, 'X', { isAdoptedOut: true });
    expect(graph.isAdoptedOut(person(graph, 'X'))).toBe(true);
    expect(graph.isConsangrRelationship(cousinsCouple(graph))).toBe(true);
  });

  it('does not find it through an adopted-in person (the parents drawn are adoptive)', () => {
    const graph = graphFromPED(COUSINS);
    setProps(graph, 'X', { isAdopted: true });
    expect(graph.isConsangrRelationship(cousinsCouple(graph))).toBe(false);
  });

  it('counts an adopted-out child as the couple\'s child (so they can\'t be marked childless), but not an adopted-in one', () => {
    const graph = graphFromPED('f M 0 0 1 1\nf F 0 0 2 1\nf C M F 1 1');
    const rel = graph.getParentRelationship(person(graph, 'C'));
    setProps(graph, 'C', { isAdoptedOut: true });
    expect(graph.hasNonPlaceholderNonAdoptedChildren(rel)).toBe(true);
    setProps(graph, 'C', { isAdoptedOut: false, isAdopted: true });
    expect(graph.hasNonPlaceholderNonAdoptedChildren(rel)).toBe(false);
  });

  it('keeps an adopted-out person through the internal JSON', () => {
    const graph = graphFromPED('f M 0 0 1 1\nf F 0 0 2 1\nf C M F 1 1\nf D M F 2 1');
    setProps(graph, 'C', { isAdoptedOut: true });
    setProps(graph, 'D', { isAdopted: true });
    const again = DynamicPositionedGraph.makeEmpty(10, 2);
    again.fromJSON(graph.toJSON());
    expect(again.isAdoptedOut(person(again, 'C'))).toBe(true);
    expect(again.isAdopted(person(again, 'C'))).toBe(false);
    expect(again.isAdopted(person(again, 'D'))).toBe(true);
    expect(again.isAdoptedOut(person(again, 'D'))).toBe(false);
  });
});

describe('adoption in DADA2 (one adopted flag)', () => {
  it('writes adopted in and adopted out both as adopted, and nothing for anyone else', async () => {
    const { default: PedigreeExport } = await import('pedigree/model/export');
    const graph = graphFromPED('f M 0 0 1 1\nf F 0 0 2 1\nf C M F 1 1\nf D M F 2 1');
    setProps(graph, 'C', { isAdoptedOut: true });
    setProps(graph, 'D', { isAdopted: true });
    const rows = PedigreeExport.exportAsDADA2(graph.DG).trim().split('\n').map((l) => l.split(' '));
    // columns: family, id, father, mother, sex, affected, life status, [adopted]
    const adoptedRows = rows.filter((r) => r.length > 7);
    expect(adoptedRows.length).toBe(2);
    adoptedRows.forEach((r) => expect(r[7]).toBe('1'));
    expect(rows.filter((r) => r.length === 7).length).toBe(2);
  });
});
