import { describe, it, expect, vi, beforeEach } from 'vitest';
import Person from 'pedigree/view/person';

// See person.questionnaire.test.js for why chainStub() exists - Person's constructor path
// draws itself via editor.getPaper()... (Raphael) and this proxy makes every chained call a
// silent no-op so a real Person can construct without a real SVG canvas.
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

function makeMockLegend() {
  return {
    _affectedNodes: {},
    addToCache: vi.fn(),
    addCase: vi.fn(function (id, name, nodeID) {
      this._affectedNodes[id] = (this._affectedNodes[id] || []).concat(nodeID);
    }),
    removeCase: vi.fn(function (id, nodeID) {
      this._affectedNodes[id] = (this._affectedNodes[id] || []).filter((n) => n !== nodeID);
    }),
    getObjectColor: vi.fn(() => '#ffffff'),
  };
}

const questionnaireConfig = {
  canonicalUrl: 'http://example.org/Questionnaire/study|1.0',
  items: [{ linkId: 'diagnoses', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendCondition' } }],
};

function makeMockEditor(legend) {
  const chain = chainStub();
  const overrides = {
    DEBUG_MODE: false,
    isUnsupportedBrowser: () => false,
    isReadOnlyMode: () => false,
    getQuestionnaireConfig: () => questionnaireConfig,
    getQuestionnaireLegend: () => legend,
  };
  return new Proxy(overrides, {
    get(target, prop) {
      return prop in target ? target[prop] : chain;
    },
  });
}

describe('Person.setQuestionnaireLegendAnswer', () => {
  let legend;

  beforeEach(() => {
    legend = makeMockLegend();
    vi.stubGlobal('editor', makeMockEditor(legend));
  });

  it('adds a case to the legend for each newly selected value', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireLegendAnswer('diagnoses', [{ system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes' }]);
    expect(legend.addToCache).toHaveBeenCalledWith('73211009', 'Diabetes');
    expect(legend.addCase).toHaveBeenCalledWith('73211009', 'Diabetes', 1);
    expect(person.getQuestionnaireAnswer('diagnoses')).toEqual([{ system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes' }]);
  });

  it('removes a case from the legend when a previously selected value is dropped', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireLegendAnswer('diagnoses', [{ system: 'sys', code: 'a', display: 'A' }, { system: 'sys', code: 'b', display: 'B' }]);
    person.setQuestionnaireLegendAnswer('diagnoses', [{ system: 'sys', code: 'a', display: 'A' }]);
    expect(legend.removeCase).toHaveBeenCalledWith('b', 1);
    expect(legend.removeCase).not.toHaveBeenCalledWith('a', 1);
  });

  it('does not re-add or re-remove a value that stays selected across calls (idempotent diffing)', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireLegendAnswer('diagnoses', [{ system: 'sys', code: 'a', display: 'A' }]);
    legend.addCase.mockClear();
    legend.removeCase.mockClear();
    person.setQuestionnaireLegendAnswer('diagnoses', [{ system: 'sys', code: 'a', display: 'A' }]);
    expect(legend.addCase).not.toHaveBeenCalled();
    expect(legend.removeCase).not.toHaveBeenCalled();
  });

  it('clears the stored answer when set to an empty array', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireLegendAnswer('diagnoses', [{ system: 'sys', code: 'a', display: 'A' }]);
    person.setQuestionnaireLegendAnswer('diagnoses', []);
    expect(legend.removeCase).toHaveBeenCalledWith('a', 1);
    expect(person.getQuestionnaireAnswer('diagnoses')).toBeUndefined();
  });

  it('triggers a canvas redraw (updateDisorderShapes) so newly assigned colours actually render', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    const updateSpy = vi.spyOn(person.getGraphics(), 'updateDisorderShapes');
    person.setQuestionnaireLegendAnswer('diagnoses', [{ system: 'sys', code: 'a', display: 'A' }]);
    expect(updateSpy).toHaveBeenCalled();
  });

  it('getAllNodeColors() includes a non-reserved custom legend item\'s selected term colours', () => {
    legend.getObjectColor = vi.fn((code) => '#colour-for-' + code);
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireLegendAnswer('diagnoses', [
      { system: 'sys', code: 'a', display: 'A' },
      { system: 'sys', code: 'b', display: 'B' },
    ]);
    expect(person.getAllNodeColors()).toEqual(['#colour-for-a', '#colour-for-b']);
  });

  it('getAllNodeColors() does not include a RESERVED linkId (disorders/candidate_genes/hpo_positive) twice', () => {
    const reservedConfig = {
      canonicalUrl: 'http://example.org/Questionnaire/reserved|1.0',
      items: [{ linkId: 'disorders', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendCondition' } }],
    };
    vi.stubGlobal('editor', new Proxy({
      DEBUG_MODE: false,
      isUnsupportedBrowser: () => false,
      isReadOnlyMode: () => false,
      getQuestionnaireConfig: () => reservedConfig,
      getQuestionnaireLegend: () => legend,
      getDisorderLegend: () => ({
        getObjectColor: () => '#real-disorder-color',
        getDisorder: (id) => ({ getID: () => id, getName: () => id }),
        addCase: vi.fn(),
        removeCase: vi.fn(),
      }),
    }, {
      get(target, prop) { return prop in target ? target[prop] : chainStub(); },
    }));
    const person = new Person(0, 0, 1, { gender: 'F', disorders: ['diabetes'] });
    expect(person.getAllNodeColors()).toEqual(['#real-disorder-color']);
  });
});
