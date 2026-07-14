import { describe, it, expect, vi, beforeEach } from 'vitest';
import Person from 'pedigree/view/person';
import { parseQuestionnaire } from 'pedigree/questionnaire/questionnaireParser';
import { DEFAULT_QUESTIONNAIRE } from 'pedigree/questionnaire/defaultQuestionnaire';

// See person.questionnaire.test.js for why chainStub() exists.
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

const defaultConfig = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);

function makeMockLegend() {
  return {
    getTerm: (id) => ({ getID: () => id, getName: () => 'Name-of-' + id }),
    getDisorder: (id) => ({ getID: () => id, getName: () => 'Name-of-' + id }),
    getCurrentTerms: () => [],
    getObjectColor: () => '#ffffff',
    addCase: vi.fn(),
    removeCase: vi.fn(),
    addToCache: vi.fn(),
  };
}

function makeMockGraph(overrides) {
  return {
    getPossibleGenders: () => ({ M: true, F: true, U: true }),
    hasRelationships: () => false,
    hasToBeAdopted: () => false,
    getAllTwinsSortedByOrder: () => [1],
    getGender: () => 'F',
    isRelatedToProband: () => false,
    ...overrides,
  };
}

function makeMockPatientProvider(overrides) {
  return {
    canLinkPatient: () => false,
    canImportClinicalData: () => false,
    ...overrides,
  };
}

function makeMockEditor({ graph, patientProvider } = {}) {
  const chain = chainStub();
  const legend = makeMockLegend();
  const overrides = {
    DEBUG_MODE: false,
    isUnsupportedBrowser: () => false,
    isReadOnlyMode: () => false,
    getQuestionnaireConfig: () => defaultConfig,
    getGraph: () => graph || makeMockGraph(),
    getPatientProvider: () => patientProvider || makeMockPatientProvider(),
    getDisorderLegend: () => legend,
    getGeneLegend: () => legend,
    getPhenotypeLegend: () => legend,
    getQuestionnaireLegend: (linkId) => {
      if (linkId === 'disorders') return legend;
      if (linkId === 'candidate_genes') return legend;
      if (linkId === 'hpo_positive') return legend;
      return undefined;
    },
  };
  return new Proxy(overrides, {
    get(target, prop) {
      return prop in target ? target[prop] : chain;
    },
  });
}

describe('Person.getSummary() driven by the default Questionnaire', () => {
  it('every field from the legacy form appears in the summary, keyed by its own linkId', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const person = new Person(0, 0, 0, { gender: 'F' });
    const summary = person.getSummary();
    for (const linkId of [
      'gender', 'first_name', 'last_name', 'link_patient', 'external_id', 'date_of_birth', 'date_of_death',
      'state', 'gestation_age', 'childlessSelect', 'adopted', 'monozygotic', 'nocontact', 'placeholder',
      'carrier', 'evaluated', 'disorders', 'import_from_record', 'candidate_genes', 'hpo_positive', 'comments',
    ]) {
      expect(summary).toHaveProperty(linkId);
    }
  });

  it('gender is disabled for the specific value ruled out by getPossibleGenders, staying visible', () => {
    vi.stubGlobal('editor', makeMockEditor({ graph: makeMockGraph({ getPossibleGenders: () => ({ M: true, F: true, U: false }) }) }));
    const person = new Person(0, 0, 0, { gender: 'F' });
    expect(person.getSummary().gender.inactive).toEqual(['U']);
  });

  it('gender has no disabled options when all genders are possible', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const person = new Person(0, 0, 0, { gender: 'F' });
    expect(person.getSummary().gender.inactive).toEqual([]);
  });

  it('state disables unborn/aborted/miscarriage/stillborn once the node has ever had relationships', () => {
    vi.stubGlobal('editor', makeMockEditor({ graph: makeMockGraph({ hasRelationships: () => true }) }));
    const person = new Person(0, 0, 0, { gender: 'F' });
    expect(person.getSummary().state.inactive).toEqual(['unborn', 'aborted', 'miscarriage', 'stillborn']);
  });

  it('state has no disabled options for a node that has never had relationships', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const person = new Person(0, 0, 0, { gender: 'F' });
    expect(person.getSummary().state.inactive).toEqual([]);
  });

  it('carrier disables the "not affected" option once a real disorder is present, and disables presymptomatic when aborted/miscarriage', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const person = new Person(0, 0, 0, { gender: 'F', disorders: ['diabetes'] });
    expect(person.getSummary().carrier.disabled).toEqual(['']);

    const person2 = new Person(0, 0, 0, { gender: 'F', lifeStatus: 'aborted' });
    expect(person2.getSummary().carrier.disabled).toEqual(['presymptomatic']);
  });

  it('date_of_birth/date_of_death/childlessSelect are inactive exactly when the node is a fetus', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const fetus = new Person(0, 0, 0, { gender: 'F', lifeStatus: 'unborn' });
    expect(fetus.getSummary().date_of_birth.inactive).toBe(true);
    expect(fetus.getSummary().date_of_death.inactive).toBe(true);
    expect(fetus.getSummary().childlessSelect.inactive).toBe(true);

    const alive = new Person(0, 0, 0, { gender: 'F', lifeStatus: 'alive' });
    expect(alive.getSummary().date_of_birth.inactive).toBe(false);
    expect(alive.getSummary().date_of_death.inactive).toBe(false);
    expect(alive.getSummary().childlessSelect.inactive).toBe(false);
  });

  it('gestation_age is inactive UNLESS the node is a fetus (inverse of date_of_birth)', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const fetus = new Person(0, 0, 0, { gender: 'F', lifeStatus: 'unborn' });
    expect(fetus.getSummary().gestation_age.inactive).toBe(false);
    const alive = new Person(0, 0, 0, { gender: 'F', lifeStatus: 'alive' });
    expect(alive.getSummary().gestation_age.inactive).toBe(true);
  });

  it('adopted is inactive when the node is a fetus OR has to be adopted', () => {
    vi.stubGlobal('editor', makeMockEditor({ graph: makeMockGraph({ hasToBeAdopted: () => true }) }));
    const person = new Person(0, 0, 0, { gender: 'F', lifeStatus: 'alive' });
    expect(person.getSummary().adopted.inactive).toBe(true);

    vi.stubGlobal('editor', makeMockEditor());
    const fetus = new Person(0, 0, 0, { gender: 'F', lifeStatus: 'unborn' });
    expect(fetus.getSummary().adopted.inactive).toBe(true);

    const neither = new Person(0, 0, 0, { gender: 'F', lifeStatus: 'alive' });
    expect(neither.getSummary().adopted.inactive).toBe(false);
  });

  it('monozygotic is inactive when not a twin, and disabled when twins have inconsistent genders', () => {
    vi.stubGlobal('editor', makeMockEditor({ graph: makeMockGraph({ getAllTwinsSortedByOrder: () => [0] }) }));
    const solo = new Person(0, 0, 0, { gender: 'F' });
    expect(solo.getSummary().monozygotic.inactive).toBe(true);

    vi.stubGlobal('editor', makeMockEditor({ graph: makeMockGraph({ getAllTwinsSortedByOrder: () => [0, 1], getGender: () => 'F' }) }));
    const consistentTwin = new Person(0, 0, 0, { gender: 'F' });
    expect(consistentTwin.getSummary().monozygotic.inactive).toBe(false);
    expect(consistentTwin.getSummary().monozygotic.disabled).toBe(false);

    vi.stubGlobal('editor', makeMockEditor({ graph: makeMockGraph({ getAllTwinsSortedByOrder: () => [0, 1], getGender: (id) => (id === 0 ? 'F' : 'M') }) }));
    const inconsistentTwin = new Person(0, 0, 0, { gender: 'F' });
    expect(inconsistentTwin.getSummary().monozygotic.inactive).toBe(false);
    expect(inconsistentTwin.getSummary().monozygotic.disabled).toBe(true);
  });

  it('nocontact is inactive for the proband, and for anyone not related to the proband', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const proband = new Person(0, 0, 0, { gender: 'F' });
    expect(proband.getSummary().nocontact.inactive).toBe(true);

    vi.stubGlobal('editor', makeMockEditor({ graph: makeMockGraph({ isRelatedToProband: () => false }) }));
    const unrelated = new Person(0, 0, 1, { gender: 'F' });
    expect(unrelated.getSummary().nocontact.inactive).toBe(true);

    vi.stubGlobal('editor', makeMockEditor({ graph: makeMockGraph({ isRelatedToProband: () => true }) }));
    const related = new Person(0, 0, 1, { gender: 'F' });
    expect(related.getSummary().nocontact.inactive).toBe(false);
  });

  it('link_patient/import_from_record reflect the patient provider capability checks', () => {
    vi.stubGlobal('editor', makeMockEditor({ patientProvider: makeMockPatientProvider({ canLinkPatient: () => true }) }));
    const person = new Person(0, 0, 1, { gender: 'F' });
    expect(person.getSummary().link_patient.inactive).toBe(false);
    expect(person.getSummary().import_from_record.inactive).toBe(true);

    vi.stubGlobal('editor', makeMockEditor({ patientProvider: makeMockPatientProvider({ canImportClinicalData: () => true }) }));
    const withRef = new Person(0, 0, 1, { gender: 'F', linkedPatientRef: 'Patient/1' });
    expect(withRef.getSummary().import_from_record.inactive).toBe(false);
  });

  it('placeholder is always inactive', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const person = new Person(0, 0, 0, { gender: 'F' });
    expect(person.getSummary().placeholder.inactive).toBe(true);
  });

  it('disorders/candidate_genes/hpo_positive all use {code, display} pairs, matching the generic questionnaire-legend-picker field type they now render through', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const person = new Person(0, 0, 0, { gender: 'F', disorders: ['diabetes'], hpoTerms: ['HP:001'], candidateGenes: ['BRCA1'] });
    const summary = person.getSummary();
    expect(summary.disorders.value).toEqual([{ code: 'diabetes', display: 'Name-of-diabetes' }]);
    expect(summary.hpo_positive.value).toEqual([{ code: 'HP:001', display: 'Name-of-HP:001' }]);
    expect(summary.candidate_genes.value).toEqual([{ code: 'BRCA1', display: 'Name-of-BRCA1' }]);
  });

  it('scalar mapsToField values reflect the real Person property, not a separate answer store', () => {
    vi.stubGlobal('editor', makeMockEditor());
    const person = new Person(0, 0, 0, { gender: 'M' });
    person.setGender('F');
    person.setComments('a note');
    const summary = person.getSummary();
    expect(summary.gender.value).toBe('F');
    expect(summary.comments.value).toBe('a note');
  });
});
