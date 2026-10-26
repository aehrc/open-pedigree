import { describe, it, expect, vi, beforeEach } from 'vitest';
import Person from 'pedigree/view/person';

// See person.questionnaire.test.js for why chainStub() exists: it lets a real Person construct
// (and draw itself) without a real SVG canvas, by making every chained call a silent no-op.
function chainStub() {
  const handler = {
    get(_target, prop) {
      if (prop === 'then') {
        return undefined;
      }
      if (prop === 'valueOf' || prop === Symbol.toPrimitive) {
        return () => 0;
      }
      if (typeof prop === 'symbol') {
        return undefined;
      }
      return proxy;
    },
    apply() {
      return proxy;
    },
  };
  const proxy = new Proxy(function () {}, handler);
  return proxy;
}

// A legend that records its cases the way the real one does: addCase appends the node, and
// removeCase drops every occurrence of it, and the entry itself once no case is left.
function makeLegend() {
  return {
    _affectedNodes: {},
    addCase(id, _name, nodeID) {
      this._affectedNodes[id] = (this._affectedNodes[id] || []).concat(nodeID);
    },
    removeCase(id, nodeID) {
      this._affectedNodes[id] = (this._affectedNodes[id] || []).filter((n) => n !== nodeID);
      if (this._affectedNodes[id].length === 0) {
        delete this._affectedNodes[id];
      }
    },
    getDisorder: (id) => ({ getID: () => id, getName: () => `name ${id}` }),
    getTerm: (id) => ({ getID: () => id, getName: () => `name ${id}` }),
    getObjectColor: () => '#ffffff',
  };
}

describe('Person.assignProperties', () => {
  let legends;

  beforeEach(() => {
    legends = { disorders: makeLegend(), phenotypes: makeLegend(), genes: makeLegend() };
    const overrides = {
      DEBUG_MODE: false,
      isUnsupportedBrowser: () => false,
      isReadOnlyMode: () => false,
      getQuestionnaireConfig: () => null,
      getDisorderLegend: () => legends.disorders,
      getPhenotypeLegend: () => legends.phenotypes,
      getGeneLegend: () => legends.genes,
    };
    const chain = chainStub();
    vi.stubGlobal('editor', new Proxy(overrides, { get: (target, prop) => (prop in target ? target[prop] : chain) }));
  });

  const properties = { gender: 'M', disorders: ['233873004', '49436004'], hpoTerms: ['80313002'], candidateGenes: ['7551'] };

  it('counts a person once in each legend after their properties are assigned again', () => {
    const person = new Person(0, 0, 1, properties);
    // What Pedigree._loadQuestionnaireFromUrl does when a late Questionnaire's answers are applied.
    person.assignProperties(properties);
    expect(legends.disorders._affectedNodes).toEqual({ 233873004: [1], 49436004: [1] });
    expect(legends.phenotypes._affectedNodes).toEqual({ 80313002: [1] });
    expect(legends.genes._affectedNodes).toEqual({ 7551: [1] });
  });

  it('drops a value from its legend when the reassigned properties no longer have it', () => {
    const person = new Person(0, 0, 1, properties);
    person.assignProperties({ ...properties, disorders: ['233873004'], candidateGenes: [] });
    expect(legends.disorders._affectedNodes).toEqual({ 233873004: [1] });
    expect(legends.genes._affectedNodes).toEqual({});
    expect(person.getDisorders()).toEqual(['233873004']);
  });

  it('empties the lists and their legend cases when the reassigned properties leave them out', () => {
    const person = new Person(0, 0, 1, properties);
    person.assignProperties({ gender: 'M' });
    expect(person.getDisorders()).toEqual([]);
    expect(person.getPhenotypes()).toEqual([]);
    expect(person.getGenes()).toEqual([]);
    expect(legends.disorders._affectedNodes).toEqual({});
    expect(legends.phenotypes._affectedNodes).toEqual({});
    expect(legends.genes._affectedNodes).toEqual({});
  });

  it('counts each value once for a newly constructed person', () => {
    new Person(0, 0, 1, properties);
    expect(legends.disorders._affectedNodes).toEqual({ 233873004: [1], 49436004: [1] });
    expect(legends.genes._affectedNodes).toEqual({ 7551: [1] });
  });
});
