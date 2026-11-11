import { describe, it, expect } from 'vitest';
import DynamicPositionedGraph from 'pedigree/model/dynamicGraph';

// Generation numbering (pedigree-editor-generation-numbering): generations I, II, III from the top,
// people numbered from the left within each, e.g. II-3.

function graphFromPED(ped) {
  const graph = DynamicPositionedGraph.makeEmpty(10, 2);
  graph.fromImport(ped, 'ped', { externalIdMark: true });
  return graph;
}

// PED id => label, and the labels row by row from the left, read off the drawing.
function labelsByExt(graph) {
  const numbers = graph.getGenerationNumbers();
  const out = {};
  for (const v of Object.keys(numbers)) {
    const ext = graph.getProperties(Number(v)).externalID;
    out[ext || ('#' + v)] = numbers[v].label;
  }
  return out;
}

function rowsLeftToRight(graph) {
  const numbers = graph.getGenerationNumbers();
  const rows = {};
  for (const v of Object.keys(numbers)) {
    (rows[numbers[v].generation] = rows[numbers[v].generation] || []).push(Number(v));
  }
  return Object.keys(rows).sort((a, b) => a - b).map((g) => rows[g]
    .sort((a, b) => graph.DG.positions[a] - graph.DG.positions[b])
    .map((v) => numbers[v].number));
}

const FAMILY = [
  'f 1 0 0 1 1', 'f 2 0 0 2 1', // grandparents
  'f 3 1 2 1 1', 'f 4 1 2 2 1', // their son and daughter
  'f 5 0 0 2 1', 'f 6 0 0 1 1', // the son's and the daughter's partners
  'f 7 3 5 1 1', 'f 8 6 4 2 1', // a grandchild of each
].join('\n');

describe('getGenerationNumbers', () => {
  it('numbers generations from the top and people from the left', () => {
    const graph = graphFromPED(FAMILY);
    const labels = labelsByExt(graph);
    expect(Object.keys(labels).length).toBe(8);
    expect(['1', '2'].map((e) => labels[e]).sort()).toEqual(['I-1', 'I-2']);
    expect(['3', '4', '5', '6'].map((e) => labels[e].split('-')[0])).toEqual(['II', 'II', 'II', 'II']);
    expect(['7', '8'].map((e) => labels[e].split('-')[0])).toEqual(['III', 'III']);
    // within each row, 1..n from the left
    expect(rowsLeftToRight(graph)).toEqual([[1, 2], [1, 2, 3, 4], [1, 2]]);
  });

  it('gives each label its generation and number', () => {
    const graph = graphFromPED('f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
    const numbers = graph.getGenerationNumbers();
    const child = Object.keys(numbers).find((v) => graph.getProperties(Number(v)).externalID === '3');
    expect(numbers[child]).toEqual({ generation: 2, number: 1, label: 'II-1' });
  });

  it('renumbers a row when someone is added to it', () => {
    const graph = graphFromPED('f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
    graph.addNewChild(graph.DG.GG.getRelationshipNode(0, 1), { gender: 'F' }, 1);
    expect(rowsLeftToRight(graph)).toEqual([[1, 2], [1, 2]]);
  });

  it('never numbers or counts the hidden child of a couple with no children', () => {
    const graph = graphFromPED('f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
    const child = Object.keys(graph.getGenerationNumbers()).length;
    const three = Object.keys(graph.getGenerationNumbers()).map(Number).find((v) => graph.getProperties(v).externalID === '3');
    graph.addNewRelationship(three, null);
    const numbers = graph.getGenerationNumbers();
    for (const v of Object.keys(numbers)) {
      expect(graph.isPlaceholder(Number(v))).toBe(false);
    }
    // the new partner is numbered, the placeholder isn't, and no third generation appears
    expect(Object.keys(numbers).length).toBe(child + 1);
    expect(Math.max(...Object.values(numbers).map((n) => n.generation))).toBe(2);
  });

  it('numbers generations without gaps', () => {
    // a long line: great-grandparents to a great-grandchild
    const graph = graphFromPED(['f 1 0 0 1 1', 'f 2 0 0 2 1', 'f 3 1 2 1 1', 'f 4 0 0 2 1', 'f 5 3 4 2 1',
      'f 6 0 0 1 1', 'f 7 6 5 1 1'].join('\n'));
    const generations = [...new Set(Object.values(graph.getGenerationNumbers()).map((n) => n.generation))].sort();
    expect(generations).toEqual([1, 2, 3, 4]);
  });
});
