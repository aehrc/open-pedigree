import { describe, it, expect, beforeEach } from 'vitest';
import BaseGraph from 'pedigree/model/baseGraph';

describe('BaseGraph', () => {
  let g;

  beforeEach(() => {
    g = new BaseGraph(10, 6);
  });

  it('starts with zero nodes', () => {
    expect(g.getNumVertices()).toBe(0);
  });

  it('adding a person node increases the count', () => {
    g._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'U' }, 10);
    expect(g.getNumVertices()).toBe(1);
  });

  it('added person node is retrievable by ID', () => {
    const id = g._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'M' }, 10);
    expect(g.isPerson(id)).toBe(true);
  });

  it('adding a relationship node increases the count', () => {
    g._addVertex(null, BaseGraph.TYPE.RELATIONSHIP, {}, 6);
    expect(g.getNumVertices()).toBe(1);
  });

  it('adding an edge connects two nodes', () => {
    const p1 = g._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'M' }, 10);
    const rel = g._addVertex(null, BaseGraph.TYPE.RELATIONSHIP, {}, 6);
    g.addEdge(p1, rel, 1);
    expect(g.hasEdge(p1, rel)).toBe(true);
  });

  it('hasEdge returns false for non-existent edge', () => {
    const p1 = g._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'M' }, 10);
    const p2 = g._addVertex(null, BaseGraph.TYPE.PERSON, { gender: 'F' }, 10);
    expect(g.hasEdge(p1, p2)).toBe(false);
  });
});
