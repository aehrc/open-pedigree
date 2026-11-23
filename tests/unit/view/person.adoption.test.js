import { describe, it, expect, vi, beforeEach } from 'vitest';
import Person from 'pedigree/view/person';
import { MAPS_TO_FIELD_TARGETS } from 'pedigree/questionnaire/questionnaireParser';

// Adopted in vs adopted out on a person (pedigree-adopted-in-out D1, D4).

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
    removed: [],
    addCase(id, _name, nodeID) {
      this._affectedNodes[id] = (this._affectedNodes[id] || []).concat(nodeID);
    },
    removeCase(id, nodeID) {
      this.removed.push(id);
      this._affectedNodes[id] = (this._affectedNodes[id] || []).filter((n) => n !== nodeID);
      if (this._affectedNodes[id].length === 0) {
        delete this._affectedNodes[id];
      }
    },
    getDisorder: (id) => ({ getID: () => id, getName: () => `name ${id}` }),
    getTerm: (id) => ({ getID: () => id, getName: () => `name ${id}` }),
    getObjectColor: () => '#ffffff',
    fillKey: (id) => 'legend:' + id,
    desanitizeID: (id) => id,
  };
}

describe('a person\'s adoption direction', () => {
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
  it('is one direction at most: setting one clears the other', () => {
    const p = new Person(0, 0, 1, { gender: 'F' });
    expect(p.getAdoption()).toBe('');
    p.setAdoptedOut(true);
    expect([p.isAdopted(), p.isAdoptedOut(), p.getAdoption()]).toEqual([false, true, 'out']);
    p.setAdopted(true);
    expect([p.isAdopted(), p.isAdoptedOut(), p.getAdoption()]).toEqual([true, false, 'in']);
  });

  it('is set from a code: in, out, anything else not adopted', () => {
    const p = new Person(0, 0, 1, { gender: 'F' });
    p.setAdoption('out');
    expect(p.getAdoption()).toBe('out');
    p.setAdoption('in');
    expect(p.getAdoption()).toBe('in');
    for (const other of ['none', '0', '', null, undefined]) {
      p.setAdoption('out');
      p.setAdoption(other);
      expect(p.getAdoption(), String(other)).toBe('');
    }
  });

  it('a yes/no "adopted" answer of no clears adopted in only, not adopted out', () => {
    const p = new Person(0, 0, 1, { gender: 'F', isAdoptedOut: true });
    p.setAdopted(false);
    expect(p.getAdoption()).toBe('out');
  });

  it('is kept in its properties, and read back from them', () => {
    const out = new Person(0, 0, 1, { gender: 'F', isAdoptedOut: true });
    expect(out.getProperties()).toMatchObject({ isAdoptedOut: true });
    expect(out.getProperties().isAdopted).toBeUndefined();
    const inn = new Person(0, 0, 2, { gender: 'F', isAdopted: true });
    expect(inn.getProperties()).toMatchObject({ isAdopted: true });
    expect(inn.getProperties().isAdoptedOut).toBeUndefined();
    inn.assignProperties({ gender: 'F', isAdoptedOut: true });
    expect(inn.getAdoption()).toBe('out');
    inn.assignProperties({ gender: 'F' });
    expect(inn.getAdoption()).toBe('');
  });

  it('a fetus is not adopted', () => {
    const p = new Person(0, 0, 1, { gender: 'F', isAdoptedOut: true });
    p.setLifeStatus('unborn');
    expect(p.getAdoption()).toBe('');
  });

  it('the adoption target reads the direction from a properties bag, and treats other codes as blank', () => {
    const target = MAPS_TO_FIELD_TARGETS.adoption;
    expect(target.fromProperties({ isAdopted: true })).toBe('in');
    expect(target.fromProperties({ isAdoptedOut: true })).toBe('out');
    expect(target.fromProperties({})).toBe('');
    expect(['in', 'out', 'none', '0'].map(target.isBlankCode)).toEqual([false, false, true, true]);
  });
});
