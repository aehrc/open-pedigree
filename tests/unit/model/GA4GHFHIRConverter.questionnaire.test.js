import { describe, it, expect, vi, beforeEach } from 'vitest';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import PedigreeImport from 'pedigree/model/import';
import { parseQuestionnaire } from 'pedigree/questionnaire/questionnaireParser';
import { DEFAULT_QUESTIONNAIRE } from 'pedigree/questionnaire/defaultQuestionnaire';
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
    expect(nodeData.properties.questionnaireAnswers.notes).toEqual([{ valueString: 'hello' }]);
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
