import { describe, it, expect, vi, beforeEach } from 'vitest';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import PedigreeImport from 'pedigree/model/import';
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
