import { describe, it, expect } from 'vitest';
import DynamicPositionedGraph from 'pedigree/model/dynamicGraph';

// A couple with no children (pedigree-editor-partner-without-child): the couple's only child is a
// hidden placeholder, so every graph rule (BaseGraph.validate) still holds.

function graphFromPED(ped) {
  const graph = DynamicPositionedGraph.makeEmpty(10, 2);
  graph.fromImport(ped, 'ped', { externalIdMark: true });
  return graph;
}

// The person with the given PED id.
function person(graph, ext) {
  for (let v = 0; v <= graph.getMaxNodeId(); v++) {
    if (graph.isPerson(v) && graph.getProperties(v).externalID === ext) {
      return v;
    }
  }
  throw new Error('no person ' + ext);
}

function childrenOf(graph, rel) {
  return graph.DG.GG.getOutEdges(graph.DG.GG.getRelationshipChildhub(rel));
}

function expectValidLayout(graph) {
  expect(() => graph.DG.GG.validate()).not.toThrow();
  for (let v = 0; v <= graph.getMaxNodeId(); v++) {
    expect(Number.isFinite(graph.DG.positions[v]), 'position of ' + v).toBe(true);
    expect(Number.isFinite(graph.DG.ranks[v]), 'rank of ' + v).toBe(true);
  }
}

// The couple a change set made, and its only child.
function newCouple(graph, changeSet) {
  const rel = changeSet.new.find((v) => graph.isRelationship(v));
  const children = childrenOf(graph, rel);
  return { rel, children, partner: graph.DG.GG.getParents(children[0]).find((p) => !changeSet.highlight.includes(p)) };
}

describe('a couple with no children', () => {
  const LAYOUTS = {
    'founders': { ped: 'f 1 0 0 1 1', who: '1' },
    'a second partner': { ped: 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1', who: '1' },
    'an aunt\'s couple': { ped: 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1\nf 4 1 2 2 1\nf 5 0 0 2 1\nf 6 3 5 0 1', who: '4' },
    'the bottom generation': { ped: 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1', who: '3' },
  };

  it.each(Object.keys(LAYOUTS))('is made with a placeholder child and laid out (%s)', (name) => {
    const graph = graphFromPED(LAYOUTS[name].ped);
    const changeSet = graph.addNewRelationship(person(graph, LAYOUTS[name].who), null);
    const { rel, children } = newCouple(graph, changeSet);
    expect(children.length).toBe(1);
    expect(graph.isPlaceholder(children[0])).toBe(true);
    expect(graph.isRelationship(rel)).toBe(true);
    expectValidLayout(graph);
  });

  it('gives the placeholder the narrow width of a non-person vertex', () => {
    const graph = graphFromPED('f 1 0 0 1 1');
    const { children } = newCouple(graph, graph.addNewRelationship(person(graph, '1'), null));
    expect(graph.DG.GG.vWidth[children[0]]).toBe(graph.DG.GG.defaultNonPersonNodeWidth);
  });

  it('is made with a placeholder when a partner is dragged onto an existing person', () => {
    const graph = graphFromPED('f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1\nf 4 1 2 2 1\nf 5 0 0 1 1\nf 6 5 4 0 1\nf 7 0 0 2 1\nf 8 3 7 0 1');
    // 4's son 6 and 3's daughter 8 are cousins; partner them
    graph.assignPartner(person(graph, '6'), person(graph, '8'), null);
    const rel = graph.DG.GG.getRelationshipNode(person(graph, '6'), person(graph, '8'));
    const children = childrenOf(graph, rel);
    expect(children.length).toBe(1);
    expect(graph.isPlaceholder(children[0])).toBe(true);
    expectValidLayout(graph);
  });

  it('still gets a real child when child properties are given', () => {
    const graph = graphFromPED('f 1 0 0 1 1');
    const { children } = newCouple(graph, graph.addNewRelationship(person(graph, '1'), { gender: 'F' }));
    expect(graph.isPlaceholder(children[0])).toBe(false);
    expect(graph.getProperties(children[0]).gender).toBe('F');
  });

  it('turns the placeholder into the first child added', () => {
    const graph = graphFromPED('f 1 0 0 1 1');
    const { rel, children } = newCouple(graph, graph.addNewRelationship(person(graph, '1'), null));
    graph.addNewChild(rel, { gender: 'M', fName: 'Kid' }, 1);
    const now = childrenOf(graph, rel);
    expect(now.length).toBe(1);
    expect(graph.isPlaceholder(now[0])).toBe(false);
    expect(graph.getProperties(now[0]).fName).toBe('Kid');
    expect(graph.DG.GG.vWidth[now[0]]).toBe(graph.DG.GG.defaultPersonNodeWidth);
    expect(now[0]).toBe(children[0]);
    expectValidLayout(graph);
  });

  it('turns the placeholder into the first of twins', () => {
    const graph = graphFromPED('f 1 0 0 1 1');
    const { rel } = newCouple(graph, graph.addNewRelationship(person(graph, '1'), null));
    graph.addNewChild(rel, { gender: 'F' }, 2);
    const now = childrenOf(graph, rel);
    expect(now.length).toBe(2);
    expect(now.some((v) => graph.isPlaceholder(v))).toBe(false);
    expectValidLayout(graph);
  });

  it('drops the placeholder when an existing person is made the couple\'s child', () => {
    // 3 and 4 are siblings; 5 married in to 4 and has no parents in the pedigree
    const graph = graphFromPED('f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1\nf 4 1 2 2 1\nf 5 0 0 1 1\nf 6 5 4 0 1');
    const { rel } = newCouple(graph, graph.addNewRelationship(person(graph, '3'), null));
    const candidate = person(graph, '5');
    expect(graph.getPossibleChildrenOf(rel)).toContain(candidate);
    graph.assignParent(rel, candidate);
    const now = childrenOf(graph, rel);
    expect(now).toEqual([person(graph, '5')]);
    expectValidLayout(graph);
  });

  it('keeps the couple, with a placeholder, when its only child is deleted', () => {
    const graph = graphFromPED('f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
    const child = person(graph, '3');
    // the deletion confirmation lists no one else
    expect(graph.getDisconnectedSetIfNodeRemoved(child)).toEqual([child]);
    graph.removeNodes([child]);
    const rel = graph.DG.GG.getRelationshipNode(person(graph, '1'), person(graph, '2'));
    expect(rel).not.toBeNull();
    const now = childrenOf(graph, rel);
    expect(now.length).toBe(1);
    expect(graph.isPlaceholder(now[0])).toBe(true);
    expectValidLayout(graph);
  });

  it('removes the couple and its placeholder when a partner is deleted', () => {
    const graph = graphFromPED('f 1 0 0 1 1');
    const { partner } = newCouple(graph, graph.addNewRelationship(person(graph, '1'), null));
    const removed = graph.getDisconnectedSetIfNodeRemoved(partner);
    graph.removeNodes(removed);
    for (let v = 0; v <= graph.getMaxNodeId(); v++) {
      expect(graph.isRelationship(v) || graph.isPlaceholder(v)).toBe(false);
    }
    expect(graph.getMaxNodeId()).toBe(0);
    expectValidLayout(graph);
  });

  it('is kept by the internal format', () => {
    const graph = graphFromPED('f 1 0 0 1 1');
    newCouple(graph, graph.addNewRelationship(person(graph, '1'), null));
    const again = DynamicPositionedGraph.makeEmpty(10, 2);
    again.fromJSON(graph.toJSON());
    const placeholders = [];
    for (let v = 0; v <= again.getMaxNodeId(); v++) {
      if (again.isPlaceholder(v)) {
        placeholders.push(v);
      }
    }
    expect(placeholders.length).toBe(1);
  });

  it('never offers the placeholder as a parent, child, sibling or partner', () => {
    const graph = graphFromPED('f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
    const { children } = newCouple(graph, graph.addNewRelationship(person(graph, '3'), null));
    const placeholder = children[0];
    const other = person(graph, '1');
    expect(graph.getPossibleParentsOf(other)).not.toContain(placeholder);
    expect(graph.getPossibleChildrenOf(other)).not.toContain(placeholder);
    expect(graph.getPossibleSiblingsOf(other)).not.toContain(placeholder);
    expect(graph.getPossiblePartnersOf(other)).not.toContain(placeholder);
  });
});
