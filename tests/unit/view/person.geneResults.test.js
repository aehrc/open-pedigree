import { describe, it, expect, vi, beforeEach } from 'vitest';
import Person from 'pedigree/view/person';

// A real Person without a real canvas: every chained call is a silent no-op (as in
// person.assignProperties.test.js), except the canvas's text(), which is recorded.
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

function makeLegend() {
  return {
    _affectedNodes: {},
    addCase(id, _name, nodeID) {
      this._affectedNodes[id] = (this._affectedNodes[id] || []).concat(nodeID);
    },
    removeCase(id, nodeID) {
      this._affectedNodes[id] = (this._affectedNodes[id] || []).filter((n) => n !== nodeID);
    },
    getTerm: (id) => ({ getID: () => id, getName: () => `name ${id}` }),
    getObjectColor: () => '#ffffff',
    sanitizeID: (id) => id,
    desanitizeID: (id) => id,
  };
}

describe('Person gene results', () => {
  let texts;

  beforeEach(() => {
    texts = [];
    const chain = chainStub();
    const paper = new Proxy({}, {
      get: (_t, prop) => (prop === 'text' ? (x, y, text) => { texts.push(text); return chain; } : chain),
    });
    const overrides = {
      DEBUG_MODE: false,
      isUnsupportedBrowser: () => false,
      isReadOnlyMode: () => false,
      getQuestionnaireConfig: () => null,
      getDisorderLegend: makeLegend,
      getPhenotypeLegend: makeLegend,
      getGeneLegend: (() => { const legend = makeLegend(); return () => legend; })(),
      getPaper: () => paper,
    };
    vi.stubGlobal('editor', new Proxy(overrides, { get: (target, prop) => (prop in target ? target[prop] : chain) }));
  });

  const person = (genes) => new Person(0, 0, 1, { gender: 'F', candidateGenes: genes });
  const geneLines = () => texts.filter((t) => typeof t === 'string' && /[+−]\/[+−0]/.test(t));

  it('keeps a known result for a listed gene, and ignores the rest', () => {
    const p = person(['BRCA1', 'TP53']);
    p.setGeneResults({ BRCA1: 'heterozygous', TP53: 'bogus', MLH1: 'negative' });
    expect(p.getGeneResults()).toEqual({ BRCA1: 'heterozygous' });
    // (nothing kept for the unlisted gene: added later, it starts untested)
    p.setGenes(['BRCA1', 'TP53', 'MLH1']);
    expect(p.getGeneResults()).toEqual({ BRCA1: 'heterozygous' });
  });

  it('gives a new object each time', () => {
    const p = person(['BRCA1']);
    p.setGeneResults({ BRCA1: 'negative' });
    const first = p.getGeneResults();
    first.BRCA1 = 'homozygous';
    expect(p.getGeneResults()).toEqual({ BRCA1: 'negative' });
    expect(p.getGeneResults()).not.toBe(p.getGeneResults());
  });

  it("drops a gene's result with the gene, whether removed alone or by a new list", () => {
    const p = person(['BRCA1', 'BRCA2', 'TP53']);
    p.setGeneResults({ BRCA1: 'heterozygous', BRCA2: 'homozygous', TP53: 'negative' });
    p.removeGene('BRCA1');
    expect(p.getGeneResults()).toEqual({ BRCA2: 'homozygous', TP53: 'negative' });
    p.setGenes(['TP53']);
    expect(p.getGeneResults()).toEqual({ TP53: 'negative' });
    // (a gene added back starts untested)
    p.setGenes(['TP53', 'BRCA2']);
    expect(p.getGeneResults()).toEqual({ TP53: 'negative' });
  });

  it('saves results with the genes only when there are any, and reads them back', () => {
    const p = person(['BRCA1', 'TP53']);
    expect(p.getProperties()).not.toHaveProperty('geneResults');
    p.setGeneResults({ BRCA1: 'hemizygous' });
    const saved = p.getProperties();
    expect(saved.candidateGenes).toEqual(['BRCA1', 'TP53']);
    expect(saved.geneResults).toEqual({ BRCA1: 'hemizygous' });

    const q = person([]);
    q.assignProperties(saved);
    expect(q.getGeneResults()).toEqual({ BRCA1: 'hemizygous' });
    // (properties without results clear them, as a missing gene list clears the genes)
    q.assignProperties({ gender: 'F', candidateGenes: ['BRCA1'] });
    expect(q.getGeneResults()).toEqual({});
  });

  it('draws one line per tested gene, in the list order, with its marker', () => {
    const p = person(['BRCA1', 'BRCA2', 'TP53', 'MLH1', 'ATM']);
    texts.length = 0;
    p.setGeneResults({ TP53: 'negative', BRCA1: 'heterozygous', MLH1: 'hemizygous', ATM: 'homozygous' });
    expect(geneLines().pop()).toBe('name BRCA1 +/−\nname TP53 −/−\nname MLH1 +/0\nname ATM +/+');
  });

  it('redraws the lines in the new order when the genes are only reordered', () => {
    const p = person(['BRCA1', 'TP53']);
    p.setGeneResults({ BRCA1: 'heterozygous', TP53: 'homozygous' });
    texts.length = 0;
    p.setGenes(['TP53', 'BRCA1']);
    expect(geneLines().pop()).toBe('name TP53 +/+\nname BRCA1 +/\u2212');
  });

  it('draws no gene line without results', () => {
    const p = person(['BRCA1']);
    p.setGeneResults({});
    expect(geneLines()).toEqual([]);
  });
});
