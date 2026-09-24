import { describe, it, expect, vi, beforeEach } from 'vitest';
import Person from 'pedigree/view/person';
import { parseQuestionnaire } from 'pedigree/questionnaire/questionnaireParser';
import currentFormsQuestionnaire from '../fixtures/current-forms-questionnaire.json';

// Person's constructor path draws itself via `editor.getPaper()...` (Raphael) and reads a
// handful of other editor accessors. Rather than enumerate every Raphael method Person/
// PersonVisuals/AbstractHoverbox happen to call (a moving target), `chainStub()` returns a
// Proxy that answers every property access AND every call with itself, forever - so any
// chain like `editor.getPaper().rect(...).attr({...}).clone().translate(3,3).insertBefore(x)`
// or `hoverbox.regenerateButtons()` just silently no-ops instead of throwing. This lets a
// real `Person`/`PersonVisuals`/`PersonHoverbox` construct exactly as it would in a live
// editor, without needing a real Raphael/SVG canvas.
function chainStub() {
  const handler = {
    get(_target, prop) {
      if (prop === 'then') {
        return undefined;
      }
      // Some Raphael call chains do arithmetic on a shape's bounding box
      // (e.g. svgPathBBox.width / 4) - make the stub coercible to 0 so that
      // works, while every other property access stays infinitely chainable.
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

function makeMockEditor(questionnaireConfig) {
  const chain = chainStub();
  const overrides = {
    DEBUG_MODE: false,
    isUnsupportedBrowser: () => false,
    isReadOnlyMode: () => false,
    getQuestionnaireConfig: () => questionnaireConfig,
  };
  return new Proxy(overrides, {
    get(target, prop) {
      return prop in target ? target[prop] : chain;
    },
  });
}

// A representative Questionnaire mixing all three mapping kinds, so the harness exercises
// every branch of _synthesizeQuestionnaireSetters(): the current-forms fixture's mapsToField
// items (should NOT get synthesized setters - they use the real property setter/getter),
// a mapsToCondition item, and a plain unmapped item (both SHOULD get synthesized setters).
const currentFormsConfig = parseQuestionnaire(currentFormsQuestionnaire);
const combinedConfig = {
  canonicalUrl: currentFormsConfig.canonicalUrl,
  items: [
    ...currentFormsConfig.items,
    {
      linkId: 'diabetes', itemType: 'boolean', fieldType: 'checkbox', repeats: false,
      mapping: { kind: 'condition', code: { coding: [{ system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes mellitus' }] } },
    },
    { linkId: 'notes', itemType: 'string', fieldType: 'text', repeats: false, mapping: null },
  ],
};

describe('Person + questionnaire-fields integration', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(combinedConfig));
  });

  it('constructs successfully with a configured Questionnaire present', () => {
    expect(() => new Person(0, 0, 1, { gender: 'F' })).not.toThrow();
  });

  it('does not synthesize setters/getters for mapsToField items', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    for (const item of currentFormsConfig.items) {
      expect(person['setQuestionnaireAnswer_' + item.linkId]).toBeUndefined();
      expect(person['getQuestionnaireAnswer_' + item.linkId]).toBeUndefined();
    }
  });

  it('synthesizes a matched get/set pair for unmapped and mapsToCondition items', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    expect(typeof person.setQuestionnaireAnswer_notes).toBe('function');
    expect(typeof person.getQuestionnaireAnswer_notes).toBe('function');
    expect(typeof person.setQuestionnaireAnswer_diabetes).toBe('function');
    expect(typeof person.getQuestionnaireAnswer_diabetes).toBe('function');
  });

  it('synthesized setter dispatch matches how controller.ts derives and calls the getter (setX -> getX)', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    expect(person.getQuestionnaireAnswer_notes()).toBeUndefined();
    person.setQuestionnaireAnswer_notes('a clinical note');
    expect(person.getQuestionnaireAnswer_notes()).toBe('a clinical note');
    expect(person.getQuestionnaireAnswer('notes')).toBe('a clinical note');
  });

  it('mapsToField items still work through their real, pre-existing setter/getter, unaffected by the mapping', () => {
    const person = new Person(0, 0, 1, { gender: 'M' });
    person.setGender('F');
    expect(person.getGender()).toBe('F');
    person.setCarrierStatus('carrier');
    expect(person.getCarrierStatus()).toBe('carrier');
    person.setComments('a comment');
    expect(person.getComments()).toBe('a comment');
    person.setLifeStatus('deceased');
    expect(person.getLifeStatus()).toBe('deceased');
  });

  it('getProperties()/assignProperties() round-trips questionnaireAnswers', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireAnswer('notes', 'round trip me');
    person.setQuestionnaireAnswer('diabetes', true);

    const exported = person.getProperties();
    expect(exported.questionnaireAnswers).toEqual({ notes: 'round trip me', diabetes: true });

    const restored = new Person(0, 0, 2, { gender: 'F' });
    restored.assignProperties(exported);
    expect(restored.getQuestionnaireAnswer('notes')).toBe('round trip me');
    expect(restored.getQuestionnaireAnswer('diabetes')).toBe(true);
  });

  it('omits questionnaireAnswers from getProperties() when no answers are set', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    expect(person.getProperties().questionnaireAnswers).toBeUndefined();
  });

  it('setQuestionnaireAnswer clears the answer when set to an empty value', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireAnswer('notes', 'something');
    person.setQuestionnaireAnswer('notes', '');
    expect(person.getQuestionnaireAnswer('notes')).toBeUndefined();
    expect(person.getProperties().questionnaireAnswers).toBeUndefined();
  });
});

describe('linkedRecordSource always-disabled rendering (record-link-provider)', () => {
  const linkedRecordConfig = {
    canonicalUrl: undefined,
    items: [
      {
        linkId: 'linked_item', itemType: 'string', fieldType: 'text', repeats: false, mapping: null,
        linkedRecordSource: true,
        disabledWhen: [{ question: 'toggle', operator: '=', answerBoolean: true }],
        disabledBehavior: 'all',
      },
      {
        linkId: 'ordinary_item', itemType: 'string', fieldType: 'text', repeats: false, mapping: null,
        disabledWhen: [{ question: 'toggle', operator: '=', answerBoolean: true }],
        disabledBehavior: 'all',
      },
      { linkId: 'toggle', itemType: 'boolean', fieldType: 'checkbox', repeats: false, mapping: null },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(linkedRecordConfig));
  });

  it('is always disabled even when its own disabledWhen would otherwise evaluate to "not disabled"', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireAnswer('toggle', true); // satisfies disabledWhen -> would otherwise be disabled:false
    expect(person.getSummary().ordinary_item.disabled).toBe(false); // sanity-check the condition is indeed satisfied
    expect(person.getSummary().linked_item.disabled).toBe(true);
  });

  it('leaves disabledWhen behavior unchanged for items without linkedRecordSource', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    person.setQuestionnaireAnswer('toggle', true);
    expect(person.getSummary().ordinary_item.disabled).toBe(false);
    person.setQuestionnaireAnswer('toggle', false);
    expect(person.getSummary().ordinary_item.disabled).toBe(true);
  });
});

describe('Person construction with no Questionnaire configured', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(null));
  });

  it('constructs normally and synthesizes no questionnaire setters at all', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    expect(person.setQuestionnaireAnswer_notes).toBeUndefined();
    expect(person.getProperties().questionnaireAnswers).toBeUndefined();
  });

  it('getProperties()/assignProperties() round-trips linkedRecordRef (record-link-provider)', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    expect(person.getLinkedRecordRef()).toBe('');

    person.setLinkedRecordRef('Record/1');
    expect(person.getLinkedRecordRef()).toBe('Record/1');

    const exported = person.getProperties();
    expect(exported.linkedRecordRef).toBe('Record/1');

    const restored = new Person(0, 0, 2, { gender: 'F' });
    restored.assignProperties(exported);
    expect(restored.getLinkedRecordRef()).toBe('Record/1');
  });

  it('omits linkedRecordRef from getProperties() when never set', () => {
    const person = new Person(0, 0, 1, { gender: 'F' });
    expect(person.getProperties().linkedRecordRef).toBeUndefined();
  });
});

describe('Person linked-record snapshot (linked-record-round-trip)', () => {
  beforeEach(() => {
    globalThis.editor = makeMockEditor(combinedConfig);
  });

  it('starts empty and round-trips through getProperties/assignProperties', () => {
    const p = new Person(0, 0, 1, { gender: 'M' });
    expect(p.getLinkedRecordSnapshot()).toEqual({});
    expect(p.getProperties().linkedRecordSnapshot).toBeUndefined();

    p.setLinkedRecordRef('record:1/instance:1');
    p.setLinkedRecordSnapshot({ first_name: 'Alice', disorders: [{ id: 'D1', name: 'One' }] });
    const saved = p.getProperties();

    const reloaded = new Person(0, 0, 2, { gender: 'M' });
    reloaded.assignProperties(saved);
    expect(reloaded.getLinkedRecordRef()).toBe('record:1/instance:1');
    expect(reloaded.getLinkedRecordSnapshot()).toEqual({ first_name: 'Alice', disorders: [{ id: 'D1', name: 'One' }] });
  });

  it('forgets the snapshot when relinked or unlinked, but not when set to the same ref', () => {
    const p = new Person(0, 0, 1, { gender: 'M' });
    p.setLinkedRecordRef('record:1/instance:1');
    p.setLinkedRecordSnapshot({ first_name: 'Alice' });
    p.setLinkedRecordRef('record:1/instance:1');
    expect(p.getLinkedRecordSnapshot()).toEqual({ first_name: 'Alice' });
    p.setLinkedRecordRef('record:1/instance:2');
    expect(p.getLinkedRecordSnapshot()).toEqual({});
    p.setLinkedRecordSnapshot({ first_name: 'Alice' });
    p.setLinkedRecordRef('');
    expect(p.getLinkedRecordSnapshot()).toEqual({});
  });
});

describe('Person legend entry removal', () => {
  beforeEach(() => {
    const legend = { removeCase: vi.fn(), addCase: vi.fn(), getTerm: (id) => ({ getID: () => id, getName: () => id }) };
    const base = makeMockEditor(combinedConfig);
    globalThis.editor = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'getPhenotypeLegend' || prop === 'getGeneLegend') {
          return () => legend;
        }
        return base[prop];
      },
    });
  });

  // Both used Prototype.js's Array#without, which no longer exists - removal threw.
  it('removes a phenotype and a gene without throwing', () => {
    const p = new Person(0, 0, 1, { gender: 'M' });
    p._phenotypes = ['HP_C_0001250', 'HP_C_0002'];
    p._candidateGenes = ['ADA2', 'BRCA1'];
    expect(() => p.removePhenotype('HP_C_0001250')).not.toThrow();
    expect(() => p.removeGene('ADA2')).not.toThrow();
    expect(p.getPhenotypes()).toEqual(['HP_C_0002']);
    expect(p.getGenes()).toEqual(['BRCA1']);
  });
});
