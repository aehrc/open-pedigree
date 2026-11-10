import { describe, it, expect, vi, beforeEach } from 'vitest';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import PedigreeImport from 'pedigree/model/import';
import { parseQuestionnaire } from 'pedigree/questionnaire/questionnaireParser';
import { DEFAULT_QUESTIONNAIRE } from 'pedigree/questionnaire/defaultQuestionnaire';
import DefaultFhirTerminologyHelper from 'pedigree/DefaultFhirTerminologyHelper';
import simpleGG from '../fixtures/simple-pedigree-gg.json';

const DIABETES_CODE = { coding: [{ system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes mellitus' }] };
const SMOKING_CODE = { coding: [{ system: 'http://loinc.org', code: '72166-2', display: 'Tobacco smoking status' }] };

const questionnaireConfig = {
  canonicalUrl: 'http://example.org/Questionnaire/study|1.0',
  items: [
    { linkId: 'notes', itemType: 'string', fieldType: 'text', repeats: false, mapping: null },
    { linkId: 'diabetes', itemType: 'boolean', fieldType: 'checkbox', repeats: false, mapping: { kind: 'condition', code: DIABETES_CODE } },
    { linkId: 'smoking', itemType: 'choice', fieldType: 'questionnaire-choice-picker', repeats: false, mapping: { kind: 'observation', code: SMOKING_CODE } },
    { linkId: 'carrier', itemType: 'boolean', fieldType: 'checkbox', repeats: false, mapping: { kind: 'field', field: 'carrierStatus' } },
  ],
};

const mockTerminologyHelper = {
  getCodeableConceptFromDisorder: vi.fn(() => ({})),
  getCodeableConceptFromPhenotype: vi.fn(() => ({})),
  getCodeableConceptFromGene: vi.fn(() => ({})),
  getDisorderFromCodeableConcept: vi.fn(() => undefined),
  getPhenotypeFromCodeableConcept: vi.fn(() => undefined),
  getGeneFromCodeableConcept: vi.fn(() => undefined),
};

function makeMockEditor(config) {
  return {
    getFhirTerminologyHelper: () => mockTerminologyHelper,
    getDisorderLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
    getGeneLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
    getPhenotypeLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
    getQuestionnaireConfig: () => config,
  };
}

describe('GA4GHFHIRConverter.buildQuestionnaireResponse', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  it('returns null when the node has no answers', () => {
    const result = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/123', {});
    expect(result).toBeNull();
  });

  it('produces a QuestionnaireResponse with subject, questionnaire, and item[] for answered fields', () => {
    const nodeProperties = { questionnaireAnswers: { notes: 'hello' } };
    const result = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/123', nodeProperties);
    expect(result.resourceType).toBe('QuestionnaireResponse');
    expect(result.subject).toEqual({ reference: 'Patient/123' });
    expect(result.questionnaire).toBe(questionnaireConfig.canonicalUrl);
    expect(result.item).toEqual([{ linkId: 'notes', answer: [{ valueString: 'hello' }] }]);
  });

  it('sources a mapsToField item from the property bag key, not the answers map', () => {
    const nodeProperties = { carrierStatus: 'carrier', questionnaireAnswers: {} };
    const result = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/123', nodeProperties);
    const carrierItem = result.item.find(i => i.linkId === 'carrier');
    expect(carrierItem.answer).toEqual([{ valueBoolean: true }]);
  });

  it('returns null when questionnaireConfig is not set on the editor', () => {
    vi.stubGlobal('editor', makeMockEditor(null));
    const result = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/123', { questionnaireAnswers: { notes: 'x' } });
    expect(result).toBeNull();
  });
});

describe('GA4GHFHIRConverter.extractDataFromQuestionnaireResponse', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  it('populates answers when questionnaire matches the configured canonical URL', () => {
    const nodeData = { properties: {} };
    const nodeDataLookup = { 'Patient/123': nodeData };
    const qr = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: questionnaireConfig.canonicalUrl,
      subject: { reference: 'Patient/123' },
      item: [{ linkId: 'notes', answer: [{ valueString: 'hello' }] }],
    };
    GA4GHFHIRConverter.extractDataFromQuestionnaireResponse(qr, nodeDataLookup);
    expect(nodeData.properties.questionnaireAnswers.notes).toBe('hello');
  });

  it('preserves raw answers and warns when questionnaire does not match', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nodeData = { properties: {} };
    const nodeDataLookup = { 'Patient/123': nodeData };
    const qr = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: 'http://example.org/Questionnaire/other|2.0',
      subject: { reference: 'Patient/123' },
      item: [{ linkId: 'notes', answer: [{ valueString: 'hello' }] }],
    };
    GA4GHFHIRConverter.extractDataFromQuestionnaireResponse(qr, nodeDataLookup);
    // Kept aside as it came, not mixed in with the answers (a raw FHIR entry isn't an answer).
    expect(nodeData.properties.questionnaireAnswers.notes).toBeUndefined();
    expect(nodeData.properties.unrenderedQuestionnaireResponses).toEqual([{
      questionnaire: 'http://example.org/Questionnaire/other|2.0',
      item: [{ linkId: 'notes', answer: [{ valueString: 'hello' }] }],
    }]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not throw and makes no changes when subject is unresolvable', () => {
    const qr = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: questionnaireConfig.canonicalUrl,
      subject: { reference: 'Patient/does-not-exist' },
      item: [{ linkId: 'notes', answer: [{ valueString: 'hello' }] }],
    };
    expect(() => GA4GHFHIRConverter.extractDataFromQuestionnaireResponse(qr, {})).not.toThrow();
  });

  it('does not record an answer for a mapsToField item - the mapped property stays authoritative', () => {
    const nodeData = { properties: { carrierStatus: 'carrier' } };
    const nodeDataLookup = { 'Patient/123': nodeData };
    const qr = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: questionnaireConfig.canonicalUrl,
      subject: { reference: 'Patient/123' },
      item: [{ linkId: 'carrier', answer: [{ valueBoolean: false }] }],
    };
    GA4GHFHIRConverter.extractDataFromQuestionnaireResponse(qr, nodeDataLookup);
    expect(nodeData.properties.carrierStatus).toBe('carrier');
    expect(nodeData.properties.questionnaireAnswers.carrier).toBeUndefined();
  });
});

describe('field mapping: mapsToCondition / mapsToObservation export', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  // deriveResourcesFromQuestionnaireResponse walks an already-built QuestionnaireResponse's
  // item[] (see design D12) - so these tests build the QR first via addQuestionnaireResponse,
  // the same way processTreeNode does, rather than calling addConditions/addObservations directly.
  it('mapsToCondition boolean answered true produces a Condition with the mapped code', () => {
    const nodeProperties = { questionnaireAnswers: { diabetes: true } };
    const conditions = { 'Patient/123': [] };
    const observations = { 'Patient/123': [] };
    const qr = GA4GHFHIRConverter.addQuestionnaireResponse(nodeProperties, 'Patient/123', {});
    GA4GHFHIRConverter.deriveResourcesFromQuestionnaireResponse(qr, 'Patient/123', conditions, observations);
    const diabetesCondition = conditions['Patient/123'].find(c => c.code === DIABETES_CODE);
    expect(diabetesCondition).toBeDefined();
    expect(diabetesCondition.subject).toEqual({ reference: 'Patient/123' });
  });

  it('mapsToCondition boolean answered false produces no Condition', () => {
    const nodeProperties = { questionnaireAnswers: { diabetes: false } };
    const conditions = { 'Patient/123': [] };
    const observations = { 'Patient/123': [] };
    const qr = GA4GHFHIRConverter.addQuestionnaireResponse(nodeProperties, 'Patient/123', {});
    GA4GHFHIRConverter.deriveResourcesFromQuestionnaireResponse(qr, 'Patient/123', conditions, observations);
    expect(conditions['Patient/123'].length).toBe(0);
  });

  it('mapsToObservation item answered produces an Observation with the mapped code and value', () => {
    const nodeProperties = { questionnaireAnswers: { smoking: { system: 'http://example.org', code: 'never', display: 'Never smoked' } } };
    const conditions = { 'Patient/123': [] };
    const observations = { 'Patient/123': [] };
    const qr = GA4GHFHIRConverter.addQuestionnaireResponse(nodeProperties, 'Patient/123', {});
    GA4GHFHIRConverter.deriveResourcesFromQuestionnaireResponse(qr, 'Patient/123', conditions, observations);
    const smokingObs = observations['Patient/123'].find(o => o.code === SMOKING_CODE);
    expect(smokingObs).toBeDefined();
    expect(smokingObs.valueCodeableConcept.coding[0].code).toBe('never');
  });

  it('deriveResourcesFromQuestionnaireResponse is a no-op when the node has no QuestionnaireResponse', () => {
    const conditions = { 'Patient/123': [] };
    const observations = { 'Patient/123': [] };
    expect(() => GA4GHFHIRConverter.deriveResourcesFromQuestionnaireResponse(null, 'Patient/123', conditions, observations)).not.toThrow();
    expect(conditions['Patient/123'].length).toBe(0);
    expect(observations['Patient/123'].length).toBe(0);
  });
});

describe('field mapping: mapsToCondition / mapsToObservation import exclusion', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  it('a Condition matching a mapsToCondition code populates the mapped answer, not the generic disorders list', () => {
    const nodeData = { properties: {} };
    const nodeDataLookup = { 'Patient/123': nodeData };
    const conditionResource = {
      resourceType: 'Condition',
      subject: { reference: 'Patient/123' },
      code: DIABETES_CODE,
    };
    GA4GHFHIRConverter.extractDataFromCondition(conditionResource, nodeDataLookup, {}, {});
    expect(nodeData.properties.questionnaireAnswers.diabetes).toBe(true);
    expect(nodeData.properties.disorders).toBeUndefined();
  });

  it('an Observation matching a mapsToObservation code populates the mapped answer, not the generic phenotype list', () => {
    const nodeData = { properties: {} };
    const nodeDataLookup = { 'Patient/123': nodeData };
    const observationResource = {
      resourceType: 'Observation',
      subject: { reference: 'Patient/123' },
      code: SMOKING_CODE,
      valueCodeableConcept: { coding: [{ system: 'http://example.org', code: 'never', display: 'Never smoked' }] },
    };
    GA4GHFHIRConverter.extractDataFromObservation(observationResource, nodeDataLookup, {}, {});
    expect(nodeData.properties.questionnaireAnswers.smoking).toEqual({ system: 'http://example.org', code: 'never', display: 'Never smoked' });
    expect(nodeData.properties.hpoTerms).toBeUndefined();
  });
});

describe('GA4GH FHIR export -> import round trip with questionnaire answers', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  it('preserves questionnaire answers (including mapped items) across export and reimport', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    baseGraph.properties[0].questionnaireAnswers = { notes: 'a note about John' };
    baseGraph.properties[0].carrierStatus = 'carrier';
    const pedigree = { GG: baseGraph };

    const exported = GA4GHFHIRConverter.exportAsFHIR(pedigree, 'all', null, null);
    const parsed = JSON.parse(exported);
    const resources = parsed.entry.map(e => e.resource);
    expect(resources.some(r => r.resourceType === 'QuestionnaireResponse')).toBe(true);

    const reimported = GA4GHFHIRConverter.initFromFHIR(exported);
    const johnProperties = Object.values(reimported.properties).find(p => p.fName === 'John');
    expect(johnProperties.questionnaireAnswers.notes).toBe('a note about John');
  });

  it('produces no QuestionnaireResponse section when no node has any answers', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    const pedigree = { GG: baseGraph };
    const parsed = JSON.parse(GA4GHFHIRConverter.exportAsFHIR(pedigree, 'all', null, null));
    const resources = parsed.entry.map(e => e.resource);
    expect(resources.some(r => r.resourceType === 'QuestionnaireResponse')).toBe(false);
    const composition = resources.find(r => r.resourceType === 'Composition');
    expect(composition.section.some(s => s.code.coding[0].code === 'questionnaire-responses')).toBe(false);
  });
});

describe('mapsToLegendCondition / mapsToLegendObservation - reserved linkIds (disorders/candidate_genes/hpo_positive)', () => {
  const reservedConfig = {
    canonicalUrl: 'http://example.org/Questionnaire/reserved|1.0',
    items: [
      { linkId: 'disorders', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendCondition' } },
      { linkId: 'candidate_genes', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendObservation' } },
      { linkId: 'hpo_positive', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendObservation' } },
    ],
  };

  const reservedTerminologyHelper = {
    getCodeableConceptFromDisorder: vi.fn((id) => ({ coding: [{ system: 'http://snomed.info/sct', code: id, display: 'Disorder-' + id }] })),
    getCodeableConceptFromGene: vi.fn((id) => ({ coding: [{ system: 'http://www.genenames.org', code: id, display: 'Gene-' + id }] })),
    getCodeableConceptFromPhenotype: vi.fn((id) => ({ coding: [{ system: 'http://purl.obolibrary.org/obo/hp.owl', code: id, display: 'Phenotype-' + id }] })),
  };

  beforeEach(() => {
    vi.stubGlobal('editor', {
      getFhirTerminologyHelper: () => reservedTerminologyHelper,
      getQuestionnaireConfig: () => reservedConfig,
    });
  });

  it('buildQuestionnaireResponse sources disorders/genes/hpo answers from the nodeProperties bag, not questionnaireAnswers', () => {
    const nodeProperties = { disorders: ['73211009'], candidateGenes: ['BRCA1'], hpoTerms: ['HP:0001'] };
    const qr = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', nodeProperties);
    const byLinkId = Object.fromEntries(qr.item.map(i => [i.linkId, i]));
    expect(byLinkId.disorders.answer).toEqual([{ valueCoding: { system: 'http://snomed.info/sct', code: '73211009', display: 'Disorder-73211009' } }]);
    expect(byLinkId.candidate_genes.answer).toEqual([{ valueCoding: { system: 'http://www.genenames.org', code: 'BRCA1', display: 'Gene-BRCA1' } }]);
    expect(byLinkId.hpo_positive.answer).toEqual([{ valueCoding: { system: 'http://purl.obolibrary.org/obo/hp.owl', code: 'HP:0001', display: 'Phenotype-HP:0001' } }]);
  });

  it('buildQuestionnaireResponse omits disorders/genes/hpo entries when the node has none', () => {
    const qr = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', {});
    expect(qr).toBeNull();
  });

  it('deriveResourcesFromQuestionnaireResponse does NOT re-derive Condition/Observation resources for reserved linkIds (addConditions/addObservations already did)', () => {
    const nodeProperties = { disorders: ['73211009'], candidateGenes: ['BRCA1'] };
    const conditions = { 'Patient/1': [] };
    const observations = { 'Patient/1': [] };
    const qr = GA4GHFHIRConverter.addQuestionnaireResponse(nodeProperties, 'Patient/1', {});
    GA4GHFHIRConverter.deriveResourcesFromQuestionnaireResponse(qr, 'Patient/1', conditions, observations);
    expect(conditions['Patient/1'].length).toBe(0);
    expect(observations['Patient/1'].length).toBe(0);
  });

  it('extractDataFromCondition populates generic disorders when the effective Questionnaire declares a disorders legendCondition item', () => {
    const nodeData = { properties: {} };
    const nodeDataLookup = { 'Patient/1': nodeData };
    reservedTerminologyHelper.getDisorderFromCodeableConcept = vi.fn(() => 'diabetes');
    GA4GHFHIRConverter.extractDataFromCondition({ resourceType: 'Condition', subject: { reference: 'Patient/1' }, code: { coding: [{ system: 'http://snomed.info/sct', code: '73211009' }] } }, nodeDataLookup, {}, {});
    expect(nodeData.properties.disorders).toEqual(['diabetes']);
  });

  it('extractDataFromCondition does NOT populate generic disorders when the effective Questionnaire has no disorders legendCondition item', () => {
    vi.stubGlobal('editor', {
      getFhirTerminologyHelper: () => reservedTerminologyHelper,
      getQuestionnaireConfig: () => ({ canonicalUrl: 'x', items: [{ linkId: 'notes', itemType: 'string', fieldType: 'text', mapping: null }] }),
    });
    const nodeData = { properties: {} };
    const nodeDataLookup = { 'Patient/1': nodeData };
    reservedTerminologyHelper.getDisorderFromCodeableConcept = vi.fn(() => 'diabetes');
    GA4GHFHIRConverter.extractDataFromCondition({ resourceType: 'Condition', subject: { reference: 'Patient/1' }, code: { coding: [{ system: 'http://snomed.info/sct', code: '73211009' }] } }, nodeDataLookup, {}, {});
    expect(nodeData.properties.disorders).toBeUndefined();
  });

  it('extractDataFromObservation populates generic hpoTerms/candidateGenes only when the corresponding legendObservation item is declared', () => {
    const nodeData = { properties: {} };
    const nodeDataLookup = { 'Patient/1': nodeData };
    reservedTerminologyHelper.getPhenotypeFromCodeableConcept = vi.fn(() => 'HP:0001');
    GA4GHFHIRConverter.extractDataFromObservation({
      resourceType: 'Observation', subject: { reference: 'Patient/1' },
      valueCodeableConcept: { coding: [{ system: 'http://purl.obolibrary.org/obo/hp.owl', code: 'HP:0001' }] },
    }, nodeDataLookup, {}, {});
    expect(nodeData.properties.hpoTerms).toEqual(['HP:0001']);
  });
});

describe('mapsToLegendCondition / mapsToLegendObservation - a genuinely new custom (non-reserved) legend item', () => {
  const customConfig = {
    canonicalUrl: 'http://example.org/Questionnaire/custom|1.0',
    items: [
      { linkId: 'comorbidities', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendCondition' } },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('editor', { getQuestionnaireConfig: () => customConfig });
  });

  it('buildQuestionnaireResponse reads the answer directly from questionnaireAnswers (already {system,code,display}-shaped)', () => {
    const nodeProperties = { questionnaireAnswers: { comorbidities: [{ system: 'http://example.org', code: 'X1', display: 'Condition X1' }] } };
    const qr = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', nodeProperties);
    expect(qr.item[0].answer).toEqual([{ valueCoding: { system: 'http://example.org', code: 'X1', display: 'Condition X1' } }]);
  });

  it('deriveResourcesFromQuestionnaireResponse produces one Condition per selected term for a non-reserved legendCondition item', () => {
    const nodeProperties = { questionnaireAnswers: { comorbidities: [
      { system: 'http://example.org', code: 'X1', display: 'Condition X1' },
      { system: 'http://example.org', code: 'X2', display: 'Condition X2' },
    ] } };
    const conditions = { 'Patient/1': [] };
    const observations = { 'Patient/1': [] };
    const qr = GA4GHFHIRConverter.addQuestionnaireResponse(nodeProperties, 'Patient/1', {});
    GA4GHFHIRConverter.deriveResourcesFromQuestionnaireResponse(qr, 'Patient/1', conditions, observations);
    expect(conditions['Patient/1'].length).toBe(2);
    expect(conditions['Patient/1'][0].code).toEqual({ coding: [{ system: 'http://example.org', code: 'X1', display: 'Condition X1' }] });
    expect(conditions['Patient/1'][1].code).toEqual({ coding: [{ system: 'http://example.org', code: 'X2', display: 'Condition X2' }] });
  });
});

describe('invokesAction items never produce a QuestionnaireResponse item entry', () => {
  it('an action item is excluded even when other items on the node are answered', () => {
    vi.stubGlobal('editor', {
      getQuestionnaireConfig: () => ({
        canonicalUrl: 'http://example.org/Questionnaire/actions|1.0',
        items: [
          { linkId: 'link_patient', itemType: 'display', fieldType: 'button-action', mapping: { kind: 'action', action: 'linkPatient' } },
          { linkId: 'notes', itemType: 'string', fieldType: 'text', mapping: null },
        ],
      }),
    });
    const qr = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', { questionnaireAnswers: { notes: 'hello' } });
    expect(qr.item.map(i => i.linkId)).toEqual(['notes']);
  });
});

describe('DEFAULT_QUESTIONNAIRE end-to-end GA4GH export/import round trip', () => {
  const defaultConfig = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
  const realisticTerminologyHelper = {
    getCodeableConceptFromDisorder: (id) => ({ coding: [{ system: 'http://snomed.info/sct', code: id, display: 'Disorder-' + id }] }),
    getCodeableConceptFromGene: (id) => ({ coding: [{ system: 'http://www.genenames.org', code: id, display: 'Gene-' + id }] }),
    getCodeableConceptFromPhenotype: (id) => ({ coding: [{ system: 'http://purl.obolibrary.org/obo/hp.owl', code: id, display: 'Phenotype-' + id }] }),
    getDisorderFromCodeableConcept: (code) => {
      const c = code.coding.find((x) => x.system === 'http://snomed.info/sct');
      return c ? c.code : undefined;
    },
    getPhenotypeFromCodeableConcept: (code) => {
      const c = code.coding.find((x) => x.system === 'http://purl.obolibrary.org/obo/hp.owl');
      return c ? c.code : undefined;
    },
    getGeneFromCodeableConcept: (code) => {
      const c = code.coding.find((x) => x.system === 'http://www.genenames.org');
      return c ? c.code : undefined;
    },
  };

  beforeEach(() => {
    vi.stubGlobal('editor', {
      getFhirTerminologyHelper: () => realisticTerminologyHelper,
      getQuestionnaireConfig: () => defaultConfig,
      getDisorderLegend: () => ({ getTerm: (id) => ({ getID: () => id, getName: () => 'Disorder-' + id }) }),
    });
  });

  it('exports and reimports disorders/genes/hpo (legend-mapped) and carrierStatus/comments (scalar mapsToField) unchanged', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    baseGraph.properties[0].disorders = ['73211009'];
    baseGraph.properties[0].candidateGenes = ['BRCA1'];
    baseGraph.properties[0].hpoTerms = ['HP:0001'];
    baseGraph.properties[0].carrierStatus = 'carrier';
    baseGraph.properties[0].comments = 'a clinical note';
    const pedigree = { GG: baseGraph };

    const exported = GA4GHFHIRConverter.exportAsFHIR(pedigree, 'all', null, null);
    const parsed = JSON.parse(exported);
    const resources = parsed.entry.map(e => e.resource);

    // exactly one Condition (disorder) and exactly two Observations (gene, hpo) for John -
    // no duplicate derivation from the dual-written QuestionnaireResponse.
    const johnRef = resources.find(r => r.resourceType === 'Patient' && r.name && r.name[0] && r.name[0].given && r.name[0].given[0] === 'John');
    const johnConditions = resources.filter(r => r.resourceType === 'Condition' && r.subject.reference === johnRef.id);
    expect(johnConditions.length).toBe(1);
    expect(johnConditions[0].code.coding[0].code).toBe('73211009');

    const reimported = GA4GHFHIRConverter.initFromFHIR(exported);
    const johnProperties = Object.values(reimported.properties).find(p => p.fName === 'John');
    expect(johnProperties.disorders).toEqual(['73211009']);
    expect(johnProperties.candidateGenes).toEqual(['BRCA1']);
    expect(johnProperties.hpoTerms).toEqual(['HP:0001']);
    expect(johnProperties.carrierStatus).toBe('carrier');
    expect(johnProperties.comments).toBe('a clinical note');
  });
});

describe('linked record round trip (linked-record-round-trip)', () => {
  const LINK_URL = 'https://github.com/aehrc/open-pedigree/StructureDefinition/linked-record-ref';
  const SNAPSHOT_URL = 'https://github.com/aehrc/open-pedigree/StructureDefinition/linked-record-snapshot';

  function johnGraph() {
    return PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
  }

  function johnPatient(exported) {
    return JSON.parse(exported).entry.map(e => e.resource)
      .find(r => r.resourceType === 'Patient' && (r.name || []).some(n => (n.given || []).includes('John')));
  }

  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  it('exports the linked record ref as a Patient extension and restores it on import', () => {
    const baseGraph = johnGraph();
    baseGraph.properties[0].linkedRecordRef = 'record:1/instance:1';
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null);

    expect(johnPatient(exported).extension).toContainEqual({ url: LINK_URL, valueString: 'record:1/instance:1' });
    const reimported = GA4GHFHIRConverter.initFromFHIR(exported);
    const john = Object.values(reimported.properties).find(p => p.fName === 'John');
    expect(john.linkedRecordRef).toBe('record:1/instance:1');
  });

  it('leaves the link out of de-identified exports (same privacy gate as names)', () => {
    const baseGraph = johnGraph();
    baseGraph.properties[0].linkedRecordRef = 'record:1/instance:1';
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'minimal', null, null);
    expect(exported).not.toContain('record:1/instance:1');
  });

  it('writes no link extension for an unlinked node', () => {
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: johnGraph() }, 'all', null, null);
    const patients = JSON.parse(exported).entry.map(e => e.resource).filter(r => r.resourceType === 'Patient');
    expect(patients.some(p => (p.extension || []).some(ext => ext.url === LINK_URL))).toBe(false);
  });

  it('exports the record snapshot as a Patient extension beside the link and restores it on import', () => {
    const baseGraph = johnGraph();
    baseGraph.properties[0].linkedRecordRef = 'record:1/instance:1';
    baseGraph.properties[0].linkedRecordSnapshot = { notes: 'from REDCap', disorders: [{ id: 'HP:1', name: 'x' }] };
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null);

    const ext = johnPatient(exported).extension.find(e => e.url === SNAPSHOT_URL);
    expect(JSON.parse(ext.valueString)).toEqual({ notes: 'from REDCap', disorders: [{ id: 'HP:1', name: 'x' }] });
    const john = Object.values(GA4GHFHIRConverter.initFromFHIR(exported).properties).find(p => p.fName === 'John');
    expect(john.linkedRecordSnapshot).toEqual({ notes: 'from REDCap', disorders: [{ id: 'HP:1', name: 'x' }] });
  });

  it('loads a document without a snapshot (saved before this change) with none', () => {
    const baseGraph = johnGraph();
    baseGraph.properties[0].linkedRecordRef = 'record:1/instance:1';
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null);
    const john = Object.values(GA4GHFHIRConverter.initFromFHIR(exported).properties).find(p => p.fName === 'John');
    expect(john.linkedRecordSnapshot).toBeUndefined();
  });

  it('keeps the snapshot out of de-identified exports', () => {
    const baseGraph = johnGraph();
    baseGraph.properties[0].linkedRecordRef = 'record:1/instance:1';
    baseGraph.properties[0].linkedRecordSnapshot = { notes: 'secret' };
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'minimal', null, null);
    expect(exported).not.toContain('secret');
  });
});

describe('a QuestionnaireResponse that arrives before its Questionnaire', () => {
  const pending = {
    questionnaire: questionnaireConfig.canonicalUrl,
    item: [
      { linkId: 'notes', answer: [{ valueString: 'hello' }] },
      { linkId: 'carrier', answer: [{ valueBoolean: true }] },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  it('becomes answers once a matching Questionnaire is configured (mapped items stay with their property)', () => {
    expect(GA4GHFHIRConverter.answersFromQuestionnaireResponse(pending, questionnaireConfig)).toEqual({ notes: 'hello' });
  });

  it('late, leaves out items whose answer is also a Condition/Observation (already taken in)', () => {
    const withCondition = { ...pending, item: [...pending.item, { linkId: 'diabetes', answer: [{ valueBoolean: true }] }] };
    expect(GA4GHFHIRConverter.answersFromQuestionnaireResponse(withCondition, questionnaireConfig)).toEqual({ notes: 'hello', diabetes: true });
    expect(GA4GHFHIRConverter.answersFromQuestionnaireResponse(withCondition, questionnaireConfig, { skipResourceMapped: true })).toEqual({ notes: 'hello' });
  });

  it('stays pending when the configured Questionnaire is a different one', () => {
    const other = { ...questionnaireConfig, canonicalUrl: 'http://example.org/Questionnaire/other|2.0' };
    expect(GA4GHFHIRConverter.answersFromQuestionnaireResponse(pending, other)).toBeNull();
  });

  it('is written back unchanged if it never matched, not turned into text', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    const unmatched = { questionnaire: 'http://example.org/Questionnaire/other|2.0', item: [{ linkId: 'notes', answer: [{ valueString: 'hello' }] }] };
    const unmatchedToo = { questionnaire: 'http://example.org/Questionnaire/third|1.0', item: [{ linkId: 'x', answer: [{ valueInteger: 3 }] }] };
    baseGraph.properties[0].unrenderedQuestionnaireResponses = [unmatched, unmatchedToo];
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null);

    expect(exported).not.toContain('[object Object]');
    const qrs = JSON.parse(exported).entry.map((e) => e.resource).filter((r) => r.resourceType === 'QuestionnaireResponse');
    // Both go back out, each as it came.
    expect(qrs.map((qr) => ({ questionnaire: qr.questionnaire, item: qr.item }))).toEqual([unmatched, unmatchedToo]);

    // And they come back the same way - neither overwrites the other.
    const reimported = GA4GHFHIRConverter.initFromFHIR(exported);
    const john = Object.values(reimported.properties).find((p) => p.fName === 'John');
    expect(john.unrenderedQuestionnaireResponses).toEqual([unmatched, unmatchedToo]);
  });
});

describe('a pedigree saved, loaded and saved again', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  function patientReferences(exported) {
    const bundle = JSON.parse(exported);
    const patients = new Set(bundle.entry.filter((e) => e.resource.resourceType === 'Patient').map((e) => e.fullUrl));
    const refs = [];
    const walk = (o) => {
      if (Array.isArray(o)) {
        o.forEach(walk);
      } else if (o && typeof o === 'object') {
        if (typeof o.reference === 'string' && (o.type === 'Patient' || /Patient/.test(o.reference) || patients.has(o.reference))) {
          refs.push(o.reference);
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(bundle.entry.map((e) => e.resource).filter((r) => r.resourceType !== 'Composition'));
    return { patients, refs, bundle };
  }

  it('keeps every reference to a person resolvable, so the family stays connected', () => {
    const first = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG))) }, 'all', null, null);
    const reloaded = GA4GHFHIRConverter.initFromFHIR(first);
    // open-pedigree's own person ids are urn:uuid:... - not a link to someone else's Patient.
    Object.values(reloaded.properties).forEach((p) => expect(p.linkedPatientRef).toBeUndefined());

    const second = GA4GHFHIRConverter.exportAsFHIR({ GG: reloaded }, 'all', null, null);
    const { patients, refs } = patientReferences(second);
    expect(refs.length).toBeGreaterThan(0);
    // Each reference is the person's own entry, exactly - never "Patient/" + it.
    refs.forEach((ref) => expect(patients.has(ref)).toBe(true));
    expect(() => GA4GHFHIRConverter.initFromFHIR(second)).not.toThrow();
  });

  it('still loads a pedigree an earlier version already saved with "Patient/urn:uuid:" references', () => {
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG))) }, 'all', null, null);
    const { patients } = patientReferences(exported);
    let damaged = exported;
    patients.forEach((fullUrl) => { damaged = damaged.split(`"reference": "${fullUrl}"`).join(`"reference": "Patient/${fullUrl}"`); });
    expect(damaged).not.toBe(exported);
    const reloaded = GA4GHFHIRConverter.initFromFHIR(damaged);
    expect(Object.values(reloaded.properties).map((p) => p.fName).sort()).toEqual(
      Object.values(GA4GHFHIRConverter.initFromFHIR(exported).properties).map((p) => p.fName).sort());
  });

  it('treats only an id that isn\'t open-pedigree\'s own as a link to another FHIR Patient', () => {
    const linkOf = (id) => GA4GHFHIRConverter.extractDataFromPatient({ resourceType: 'Patient', id }, {}, {}).properties.linkedPatientRef;
    expect(linkOf('urn:uuid:0f8fad5b-d9cb-469f-a165-70867728950e')).toBeUndefined();
    expect(linkOf('0f8fad5b-d9cb-469f-a165-70867728950e')).toBeUndefined();
    expect(linkOf('abc123')).toBe('Patient/abc123');
  });
});

describe('changing the terminology between saves (terminology-change-keeps-codes)', () => {
  const SNOMED = 'http://snomed.info/sct';
  const HGNC = 'http://purl.bioontology.org/ontology/HGNC/hgnc.owl';
  const SNOMEDCT = [SNOMED, SNOMED, HGNC];
  const HPO_OMIM = ['http://www.omim.org', 'http://purl.obolibrary.org/obo/hp.owl', HGNC];
  const OLD_GENE_SYSTEM = 'http://www.genenames.org';
  // What the terminologies confirm: anything else is unknown to them.
  const NAMES = { '233873004': 'Hypertrophic cardiomyopathy', '271807003': 'Eruption of skin', '7551': 'MYBPC3', 'HP:0001279': 'Syncope' };
  const legend = { getTerm: (id) => ({ isUnknown: () => !(id in NAMES), getName: () => NAMES[id] || id }) };

  // An editor whose Default Terminology gives these code systems; reading and writing a pedigree
  // in one editor session is one helper.
  const TUMOUR_SITE = { linkId: 'tumour_site', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendObservation' } };
  let config;

  function useTerminology([disorderCS, phenotypeCS, geneCS], items = parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items) {
    const helper = new DefaultFhirTerminologyHelper(disorderCS, phenotypeCS, geneCS);
    config = { ...parseQuestionnaire(DEFAULT_QUESTIONNAIRE), items };
    vi.stubGlobal('editor', {
      getFhirTerminologyHelper: () => helper,
      getQuestionnaireConfig: () => config,
      getDisorderLegend: () => legend,
      getPhenotypeLegend: () => legend,
      getGeneLegend: () => legend,
    });
  }

  function savedUnderSnomed(items, extra = {}) {
    useTerminology(SNOMEDCT, items);
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    Object.assign(baseGraph.properties[0], { disorders: ['233873004'], hpoTerms: ['271807003'], candidateGenes: ['7551'] }, extra);
    return GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null);
  }

  function openAndSave(saved, terminology, items) {
    useTerminology(terminology, items);
    const graph = GA4GHFHIRConverter.initFromFHIR(saved);
    const john = Object.values(graph.properties).find((p) => p.fName === 'John');
    return { john, saved: GA4GHFHIRConverter.exportAsFHIR({ GG: graph }, 'all', null, null) };
  }

  function johnsResources(saved) {
    const resources = JSON.parse(saved).entry.map((e) => e.resource);
    const john = resources.find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given && r.name[0].given[0] === 'John');
    return resources.filter((r) => r.subject && r.subject.reference === john.id);
  }

  function codings(saved) {
    const mine = johnsResources(saved);
    return {
      conditions: mine.filter((r) => r.resourceType === 'Condition').map((r) => r.code),
      observations: mine.filter((r) => r.resourceType === 'Observation').map((r) => r.valueCodeableConcept || r.valueString),
    };
  }

  it('keeps the old codes through opening and saving under another terminology', () => {
    const before = savedUnderSnomed();
    const { john, saved } = openAndSave(before, HPO_OMIM);
    // shown by name: neither is a term of the HPO + omim terminologies
    expect(john.disorders).toEqual(['Hypertrophic cardiomyopathy']);
    expect(john.hpoTerms).toEqual(['Eruption of skin']);
    expect(john.candidateGenes).toEqual(['7551']);
    expect(codings(saved)).toEqual(codings(before));
    expect(codings(saved).conditions).toEqual([{ coding: [{ system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' }] }]);
  });

  it('the linked-instrument summary carries the old codes too', () => {
    const { saved } = openAndSave(savedUnderSnomed(), HPO_OMIM);
    const qr = johnsResources(saved).find((r) => r.resourceType === 'QuestionnaireResponse');
    const answer = (linkId) => qr.item.find((i) => i.linkId === linkId).answer;
    expect(answer('disorders')).toEqual([{ valueCoding: { system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' } }]);
    expect(answer('hpo_positive')).toEqual([{ valueCoding: { system: SNOMED, code: '271807003', display: 'Eruption of skin' } }]);
  });

  it('is as before once the terminology is changed back', () => {
    const before = savedUnderSnomed();
    const { john, saved } = openAndSave(openAndSave(before, HPO_OMIM).saved, SNOMEDCT);
    expect(john.disorders).toEqual(['233873004']);
    expect(john.hpoTerms).toEqual(['271807003']);
    expect(codings(saved)).toEqual(codings(before));
  });

  it('keeps a gene coded in a gene system that has since changed, as a gene', () => {
    const before = savedUnderSnomed();
    const { john, saved } = openAndSave(before, [SNOMED, SNOMED, OLD_GENE_SYSTEM]);
    expect(john.candidateGenes).toEqual(['MYBPC3']);
    expect(john.hpoTerms).toEqual(['271807003']);
    expect(codings(saved)).toEqual(codings(before));
  });

  it('keeps a gene from another system with a Questionnaire that has genes but no phenotypes', () => {
    const items = parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items.filter((i) => i.linkId !== 'hpo_positive');
    const { john, saved } = openAndSave(savedUnderSnomed(items), [SNOMED, SNOMED, OLD_GENE_SYSTEM], items);
    expect(john.candidateGenes).toEqual(['MYBPC3']);
    expect(codings(saved).observations).toContainEqual({ coding: [{ system: HGNC, code: '7551', display: 'MYBPC3' }] });
  });

  it('reads one from a pedigree saved without QuestionnaireResponses as a phenotype', () => {
    const before = JSON.parse(savedUnderSnomed());
    before.entry = before.entry.filter((e) => e.resource.resourceType !== 'QuestionnaireResponse');
    const { john, saved } = openAndSave(JSON.stringify(before), HPO_OMIM);
    expect(john.hpoTerms).toEqual(['Eruption of skin']);
    expect(codings(saved).observations).toContainEqual({ coding: [{ system: SNOMED, code: '271807003', display: 'Eruption of skin' }] });
  });

  // redcap_pedigree_editor#8: a v0.4 pedigree has no QuestionnaireResponses, and its gene was
  // coded in the gene system of its day
  function savedWithoutQuestionnaireResponses(geneCS, gene = '7551') {
    useTerminology([SNOMED, SNOMED, geneCS]);
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    Object.assign(baseGraph.properties[0], { hpoTerms: ['271807003'], candidateGenes: [gene] });
    const saved = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null));
    saved.entry = saved.entry.filter((e) => e.resource.resourceType !== 'QuestionnaireResponse');
    return JSON.stringify(saved);
  }

  it.each([
    ['http://www.genenames.org/geneId', '7551'],
    ['http://www.genenames.org', '7551'],
    ['https://www.genenames.org/geneId', '7551'],
    ['http://www.ncbi.nlm.nih.gov/gene', '4607'],
    ['http://www.ensembl.org', 'ENSG00000134571'],
  ])('reads a gene in another gene system (%s), saved without QuestionnaireResponses, as a gene', (geneCS, code) => {
    const added = !(code in NAMES);
    NAMES[code] = NAMES[code] || 'MYBPC3';
    try {
      const before = savedWithoutQuestionnaireResponses(geneCS, code);
      const { john, saved } = openAndSave(before, SNOMEDCT);
      expect(john.candidateGenes).toEqual(['MYBPC3']);
      expect(john.hpoTerms).toEqual(['271807003']);
      // and it's written back with its own coding
      expect(codings(saved).observations).toContainEqual({ coding: [{ system: geneCS, code, display: 'MYBPC3' }] });
    } finally {
      if (added) {
        delete NAMES[code];
      }
    }
  });

  it('reads a gene in today\'s HGNC system as a gene under a terminology with another gene system', () => {
    const { john } = openAndSave(savedWithoutQuestionnaireResponses(HGNC), [SNOMED, SNOMED, 'urn:example:genes']);
    expect(john.candidateGenes).toEqual(['MYBPC3']);
    expect(john.hpoTerms).toEqual(['271807003']);
  });

  it.each(['HGNC:1097', 'hgnc:1097', ' HGNC:1097 '])('reads an HGNC id (%j) in a code system it doesn\'t know as a gene', (code) => {
    NAMES[code] = 'BRAF';
    try {
      const { john } = openAndSave(savedWithoutQuestionnaireResponses('urn:example:genes', code), SNOMEDCT);
      expect(john.candidateGenes).toEqual(['BRAF']);
      expect(john.hpoTerms).toEqual(['271807003']);
    } finally {
      delete NAMES[code];
    }
  });

  it('keeps a gene its QuestionnaireResponse doesn\'t list, when it lists the person\'s phenotypes', () => {
    useTerminology([SNOMED, SNOMED, 'http://www.genenames.org/geneId']);
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    Object.assign(baseGraph.properties[0], { hpoTerms: ['271807003'], candidateGenes: ['7551'] });
    const saved = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null));
    for (const qr of saved.entry.map((e) => e.resource).filter((r) => r.resourceType === 'QuestionnaireResponse')) {
      qr.item = qr.item.filter((i) => i.linkId !== 'candidate_genes');
    }
    const { john } = openAndSave(JSON.stringify(saved), SNOMEDCT);
    expect(john.candidateGenes).toEqual(['MYBPC3']);
    expect(john.hpoTerms).toEqual(['271807003']);
  });

  it('reads a gene as a phenotype only if the Questionnaire has no genes', () => {
    const items = parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items.filter((i) => i.linkId !== 'candidate_genes');
    const before = savedWithoutQuestionnaireResponses('http://www.genenames.org/geneId');
    const { john } = openAndSave(before, SNOMEDCT, items);
    expect(john.candidateGenes).toBeUndefined();
    expect(john.hpoTerms).toEqual(['271807003', 'MYBPC3']);
  });

  it('leaves a custom legend item\'s answer to its own item, not the phenotypes', () => {
    const items = [...parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items, TUMOUR_SITE];
    const lung = { system: SNOMED, code: '39607008', display: 'Lung structure' };
    const before = savedUnderSnomed(items, { questionnaireAnswers: { tumour_site: [lung] } });
    const { john, saved } = openAndSave(before, HPO_OMIM, items);
    expect(john.hpoTerms).toEqual(['Eruption of skin']);
    expect(john.questionnaireAnswers.tumour_site).toEqual([lung]);
    expect(codings(saved)).toEqual(codings(before));
  });

  it('reads a concept with only text without failing', () => {
    const before = JSON.parse(savedUnderSnomed());
    const observation = before.entry.map((e) => e.resource).find((r) => r.resourceType === 'Observation' && r.valueCodeableConcept
      && r.valueCodeableConcept.coding[0].code === '271807003');
    observation.valueCodeableConcept = { text: 'Eruption of skin' };
    expect(() => openAndSave(JSON.stringify(before), HPO_OMIM)).not.toThrow();
  });

  it('keeps each person\'s own coding for a term with the same name', () => {
    const before = JSON.parse(savedUnderSnomed());
    const resources = before.entry.map((e) => e.resource);
    const jane = resources.find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given && r.name[0].given[0] === 'Jane');
    const icd = { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'I42.1', display: 'Hypertrophic cardiomyopathy' }] };
    before.entry.push({ resource: { resourceType: 'Condition', id: 'jane-hcm', subject: { reference: jane.id }, code: icd } });
    const { saved } = openAndSave(JSON.stringify(before), HPO_OMIM);
    const out = JSON.parse(saved).entry.map((e) => e.resource);
    const janeAfter = out.find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given && r.name[0].given[0] === 'Jane');
    expect(out.filter((r) => r.resourceType === 'Condition' && r.subject.reference === janeAfter.id).map((r) => r.code)).toEqual([icd]);
    expect(codings(saved).conditions).toEqual([{ coding: [{ system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' }] }]);
  });

  it('keeps the first coding when one person has two with the same name', () => {
    const before = JSON.parse(savedUnderSnomed());
    const resources = before.entry.map((e) => e.resource);
    const condition = resources.find((r) => r.resourceType === 'Condition');
    const icd = { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'I42.1', display: 'Hypertrophic cardiomyopathy' }] };
    before.entry.push({ resource: { resourceType: 'Condition', id: 'second', subject: condition.subject, code: icd } });
    const { john } = openAndSave(JSON.stringify(before), HPO_OMIM);
    expect(john.termCodings.disorders['Hypertrophic cardiomyopathy'].coding[0].code).toBe('233873004');
  });

  it('someone else in the pedigree given an old term (e.g. from the legend) is given its coding; another pedigree isn\'t', () => {
    const { john } = openAndSave(savedUnderSnomed(), HPO_OMIM);
    expect(john.termCodings.disorders['Hypertrophic cardiomyopathy'].coding[0].code).toBe('233873004');
    const stored = savedUnderSnomed();
    useTerminology(HPO_OMIM);
    const reread = GA4GHFHIRConverter.initFromFHIR(stored);
    const jane = Object.values(reread.properties).find((p) => p.fName === 'Jane');
    jane.disorders = ['Hypertrophic cardiomyopathy'];
    const saved = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: reread }, 'all', null, null));
    const conditions = saved.entry.map((e) => e.resource).filter((r) => r.resourceType === 'Condition');
    expect(conditions.map((c) => c.code.coding[0].code)).toEqual(['233873004', '233873004']);

    const other = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    other.properties[1].disorders = ['Hypertrophic cardiomyopathy'];
    const elsewhere = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: other }, 'all', null, null));
    expect(elsewhere.entry.map((e) => e.resource).filter((r) => r.resourceType === 'Condition').map((c) => c.code))
      .toEqual([{ text: 'Hypertrophic cardiomyopathy' }]);
  });

  it('a custom legend item\'s answer stays its own for a person with no phenotypes or genes', () => {
    const items = [...parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items, TUMOUR_SITE];
    const lung = { system: SNOMED, code: '39607008', display: 'Lung structure' };
    for (const terminology of [SNOMEDCT, HPO_OMIM]) {
      const before = savedUnderSnomed(items, { hpoTerms: [], candidateGenes: [], questionnaireAnswers: { tumour_site: [lung] } });
      const { john } = openAndSave(before, terminology, items);
      expect(john.hpoTerms).toBeUndefined();
      expect(john.questionnaireAnswers.tumour_site).toEqual([lung]);
    }
  });

  it('a custom legend item\'s Condition isn\'t read as a disorder too', () => {
    const FAMILY_CANCER = { linkId: 'family_cancer', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendCondition' } };
    const items = [...parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items, FAMILY_CANCER];
    const breast = { system: SNOMED, code: '254837009', display: 'Breast cancer' };
    for (const terminology of [SNOMEDCT, HPO_OMIM]) {
      const before = savedUnderSnomed(items, { questionnaireAnswers: { family_cancer: [breast] } });
      const { john, saved } = openAndSave(before, terminology, items);
      expect(john.disorders).toEqual([terminology === SNOMEDCT ? '233873004' : 'Hypertrophic cardiomyopathy']);
      expect(john.questionnaireAnswers.family_cancer).toEqual([breast]);
      expect(codings(saved).conditions).toEqual(codings(before).conditions);
    }
  });

  it('a term the terminology in use codes is coded by it, not with another person\'s kept coding', () => {
    useTerminology(SNOMEDCT);
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(JSON.parse(JSON.stringify(simpleGG)));
    const old = { coding: [{ system: OLD_GENE_SYSTEM, code: 'HGNC:7551', display: 'MYBPC3' }] };
    Object.assign(baseGraph.properties[0], { candidateGenes: ['7551'], termCodings: { candidateGenes: { 7551: old } } });
    baseGraph.properties[1].candidateGenes = ['7551'];
    const genes = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null)).entry
      .map((e) => e.resource).filter((r) => r.resourceType === 'Observation' && r.valueCodeableConcept).map((r) => r.valueCodeableConcept);
    expect(genes).toEqual(expect.arrayContaining([old, { coding: [{ system: HGNC, code: '7551', display: 'MYBPC3' }] }]));
  });

  it('a QuestionnaireResponse for another Questionnaire doesn\'t decide what the resources are', () => {
    const items = [...parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items, TUMOUR_SITE];
    const lung = { system: SNOMED, code: '39607008', display: 'Lung structure' };
    const before = JSON.parse(savedUnderSnomed(items, { questionnaireAnswers: { tumour_site: [lung] } }));
    for (const r of before.entry.map((e) => e.resource).filter((x) => x.resourceType === 'QuestionnaireResponse')) {
      r.questionnaire = 'http://example.org/Questionnaire/another|1.0';
    }
    // (as main: kept aside, and its items' resources read as generic terms - its answers aren't
    // restored, so skipping them would lose them)
    expect(openAndSave(JSON.stringify(before), SNOMEDCT, items).john.hpoTerms).toEqual(['271807003', '39607008']);
  });

  it('a carrier status whose coding is also a custom legend item\'s answer is still read', () => {
    const items = [...parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items, TUMOUR_SITE];
    const carrier = { system: SNOMED, code: '24800002', display: 'Carrier state, disease not expressed' };
    const before = savedUnderSnomed(items, { carrierStatus: 'presymptomatic', questionnaireAnswers: { tumour_site: [carrier] } });
    expect(openAndSave(before, HPO_OMIM, items).john.carrierStatus).toBe('presymptomatic');
  });

  it('a phenotype or disorder that\'s also a custom legend item\'s answer is read once', () => {
    const FAMILY_CANCER = { linkId: 'family_cancer', itemType: 'choice', fieldType: 'questionnaire-legend-picker', repeats: true, mapping: { kind: 'legendCondition' } };
    const items = [...parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items, TUMOUR_SITE, FAMILY_CANCER];
    const rash = { system: SNOMED, code: '271807003', display: 'Eruption of skin' };
    const hcm = { system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' };
    const mybpc3 = { system: HGNC, code: '7551', display: 'MYBPC3' };
    const before = savedUnderSnomed(items, { questionnaireAnswers: { tumour_site: [rash, mybpc3], family_cancer: [hcm] } });
    const { john } = openAndSave(before, SNOMEDCT, items);
    expect(john.hpoTerms).toEqual(['271807003']);
    expect(john.candidateGenes).toEqual(['7551']);
    expect(john.disorders).toEqual(['233873004']);
  });

  it('one listed nowhere, for a person whose QuestionnaireResponse lists their phenotypes, is left alone', () => {
    const before = JSON.parse(savedUnderSnomed());
    const john = before.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given && r.name[0].given[0] === 'John');
    before.entry.push({ resource: { resourceType: 'Observation', id: 'unlisted', status: 'preliminary', subject: { reference: john.id },
      valueCodeableConcept: { coding: [{ system: 'http://example.org/other', code: '1', display: 'Something else' }] } } });
    expect(openAndSave(JSON.stringify(before), HPO_OMIM).john.hpoTerms).toEqual(['Eruption of skin']);
  });

  it('a carrier status listed under a field item of the QuestionnaireResponse is still read', () => {
    const items = [...parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items,
      { linkId: 'carrier_code', itemType: 'choice', fieldType: 'select', repeats: false, mapping: null }];
    const before = JSON.parse(savedUnderSnomed(items, { carrierStatus: 'presymptomatic' }));
    const resources = before.entry.map((e) => e.resource);
    const john = resources.find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given && r.name[0].given[0] === 'John');
    const qr = resources.find((r) => r.resourceType === 'QuestionnaireResponse' && r.subject.reference === john.id);
    qr.item.push({ linkId: 'carrier_code', answer: [{ valueCoding: { system: SNOMED, code: '24800002' } }] });
    expect(openAndSave(JSON.stringify(before), HPO_OMIM, items).john.carrierStatus).toBe('presymptomatic');
  });

  it('an Observation with nothing to read leaves the person\'s phenotypes as they were', () => {
    const before = JSON.parse(savedUnderSnomed(undefined, { hpoTerms: [] }));
    before.entry = before.entry.filter((e) => e.resource.resourceType !== 'QuestionnaireResponse');
    const john = before.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given && r.name[0].given[0] === 'John');
    before.entry.push({ resource: { resourceType: 'Observation', id: 'nothing', status: 'preliminary', subject: { reference: john.id }, valueCodeableConcept: { coding: [{ system: SNOMED }] } } });
    expect(openAndSave(JSON.stringify(before), HPO_OMIM).john.hpoTerms).toBeUndefined();
  });

  it('the pedigree\'s codings are used only while it\'s exported', () => {
    openAndSave(savedUnderSnomed(), HPO_OMIM);
    const qr = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', { disorders: ['Hypertrophic cardiomyopathy'] });
    expect(qr.item.find((i) => i.linkId === 'disorders').answer)
      .toEqual([{ valueCoding: { code: 'Hypertrophic cardiomyopathy', display: 'Hypertrophic cardiomyopathy' } }]);
  });

  it('a kept phenotype whose first coding has no code is still a phenotype after two saves', () => {
    const before = JSON.parse(savedUnderSnomed());
    const observation = before.entry.map((e) => e.resource).find((r) => r.resourceType === 'Observation' && r.valueCodeableConcept
      && r.valueCodeableConcept.coding[0].code === '271807003');
    const twoCodings = { coding: [{ system: 'http://example.org/no-code', display: 'Eruption of skin' }, observation.valueCodeableConcept.coding[0]] };
    observation.valueCodeableConcept = twoCodings;
    const once = openAndSave(JSON.stringify(before), HPO_OMIM);
    const twice = openAndSave(once.saved, HPO_OMIM);
    expect(twice.john.hpoTerms).toEqual(['Eruption of skin']);
    expect(codings(twice.saved).observations).toContainEqual(twoCodings);
  });

  it('a person whose QuestionnaireResponse has neither legend item reads one as a phenotype, as with none', () => {
    const before = JSON.parse(savedUnderSnomed());
    for (const r of before.entry.map((e) => e.resource).filter((x) => x.resourceType === 'QuestionnaireResponse')) {
      r.item = r.item.filter((item) => item.linkId !== 'hpo_positive' && item.linkId !== 'candidate_genes');
    }
    const { john } = openAndSave(JSON.stringify(before), HPO_OMIM);
    expect(john.hpoTerms).toEqual(['Eruption of skin']);
  });

  it('a coding also listed under a custom legend item is read as a phenotype once', () => {
    const items = [...parseQuestionnaire(DEFAULT_QUESTIONNAIRE).items, TUMOUR_SITE];
    const rash = { system: SNOMED, code: '271807003', display: 'Eruption of skin' };
    const { john } = openAndSave(savedUnderSnomed(items, { questionnaireAnswers: { tumour_site: [rash] } }), HPO_OMIM, items);
    expect(john.hpoTerms).toEqual(['Eruption of skin']);
    expect(john.questionnaireAnswers.tumour_site).toEqual([rash]);
  });


  it('leaves an Observation with a code it doesn\'t know alone, as before', () => {
    const before = JSON.parse(savedUnderSnomed());
    const observation = before.entry.map((e) => e.resource).find((r) => r.resourceType === 'Observation' && r.valueCodeableConcept
      && r.valueCodeableConcept.coding[0].code === '271807003');
    observation.code = { coding: [{ system: 'http://loinc.org', code: '00000-0' }] };
    const { john } = openAndSave(JSON.stringify(before), HPO_OMIM);
    expect(john.hpoTerms).toBeUndefined();
  });
});
