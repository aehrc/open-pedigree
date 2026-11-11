import { describe, it, expect, vi, beforeEach } from 'vitest';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';

// The GA4GH export's privacy options, as the export dialog's SVG/PDF ones: 'nopersonal' leaves out
// names, external IDs and dates (and what identifies the person elsewhere); 'minimal' also leaves
// out comments and other free text. Before, the external ID, the comments Observation and every
// QuestionnaireResponse answer (names and dates among them) were written whatever the setting.

const questionnaireConfig = {
  canonicalUrl: 'http://example.org/Questionnaire/privacy|1.0',
  items: [
    { linkId: 'first_name', itemType: 'string', fieldType: 'text', repeats: false, mapping: { kind: 'field', field: 'given' } },
    { linkId: 'last_name', itemType: 'string', fieldType: 'text', repeats: false, mapping: { kind: 'field', field: 'family' } },
    { linkId: 'external_id', itemType: 'string', fieldType: 'text', repeats: false, mapping: { kind: 'field', field: 'identifier' } },
    { linkId: 'date_of_birth', itemType: 'date', fieldType: 'date-picker', repeats: false, mapping: { kind: 'field', field: 'birthDate' } },
    { linkId: 'date_of_death', itemType: 'date', fieldType: 'date-picker', repeats: false, mapping: { kind: 'field', field: 'deceasedDateTime' } },
    { linkId: 'gestation_age', itemType: 'integer', fieldType: 'text', repeats: false, mapping: { kind: 'field', field: 'gestationAge' } },
    { linkId: 'comments', itemType: 'text', fieldType: 'textarea', repeats: false, mapping: { kind: 'field', field: 'comments' } },
    { linkId: 'carrier', itemType: 'boolean', fieldType: 'checkbox', repeats: false, mapping: { kind: 'field', field: 'carrierStatus' } },
    { linkId: 'notes', itemType: 'string', fieldType: 'text', repeats: false, mapping: null },
    { linkId: 'visit_date', itemType: 'date', fieldType: 'date-picker', repeats: false, mapping: null },
    { linkId: 'visits', itemType: 'integer', fieldType: 'text', repeats: false, mapping: null },
  ],
};

const person = {
  fName: 'Zebedee', lName: 'Quarrington', externalID: 'MRN998877', dob: 'Sat Mar 04 1961', dod: 'Mon Jun 01 2020',
  gestationAge: 30, comments: 'seen at clinic', carrierStatus: 'carrier', lifeStatus: 'deceased',
  questionnaireAnswers: { notes: 'lives with Ann', visit_date: '2019-05-06', visits: 3 },
};

function makeMockEditor(config) {
  return {
    getFhirTerminologyHelper: () => ({}),
    getDisorderLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
    getGeneLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
    getPhenotypeLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
    getQuestionnaireConfig: () => config,
  };
}

const linkIds = (qr) => (qr ? qr.item.map((i) => i.linkId) : []);

describe('GA4GH export privacy: the QuestionnaireResponse', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  it('keeps every answer with all data (and by default)', () => {
    const all = ['first_name', 'last_name', 'external_id', 'date_of_birth', 'date_of_death', 'gestation_age', 'comments', 'carrier', 'notes', 'visit_date', 'visits'];
    expect(linkIds(GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', person))).toEqual(all);
    expect(linkIds(GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', person, 'all'))).toEqual(all);
  });

  it('leaves out names, the external ID, dates and gestational age without personal information', () => {
    expect(linkIds(GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', person, 'nopersonal'))).toEqual(['comments', 'carrier', 'notes', 'visits']);
  });

  it('also leaves out comments and free text with the stricter option', () => {
    expect(linkIds(GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', person, 'minimal'))).toEqual(['carrier', 'visits']);
  });

  it('keeps a coded open-choice answer but not a typed one with the stricter option', () => {
    vi.stubGlobal('editor', makeMockEditor({
      canonicalUrl: questionnaireConfig.canonicalUrl,
      items: [{ linkId: 'ethnicity', itemType: 'open-choice', fieldType: 'questionnaire-choice-picker', repeats: true, mapping: null }],
    }));
    const coded = { system: 'http://example.org', code: 'a', display: 'A' };
    const props = { questionnaireAnswers: { ethnicity: [coded, 'typed in by hand'] } };
    const qr = GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', props, 'minimal');
    expect(qr.item).toEqual([{ linkId: 'ethnicity', answer: [{ valueCoding: coded }] }]);
    expect(GA4GHFHIRConverter.buildQuestionnaireResponse('Patient/1', props, 'nopersonal').item[0].answer).toHaveLength(2);
  });

  it('writes answers for a Questionnaire this editor doesn\'t know only with all data', () => {
    const pending = { questionnaire: 'http://example.org/Questionnaire/other', item: [{ linkId: 'x', answer: [{ valueString: 'Zebedee' }] }] };
    const props = { unrenderedQuestionnaireResponses: [pending] };
    for (const [privacy, count] of [['all', 1], ['nopersonal', 0], ['minimal', 0]]) {
      const qrs = {};
      GA4GHFHIRConverter.addQuestionnaireResponse(props, 'Patient/1', qrs, privacy);
      expect(qrs['Patient/1']).toHaveLength(count);
    }
  });
});

describe('GA4GH export privacy: the person and their comments', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', makeMockEditor(questionnaireConfig));
  });

  it('writes the external ID only with all data', () => {
    expect(GA4GHFHIRConverter.buildPedigreeIndividual('Patient/1', person, 'all').identifier).toEqual([
      { system: 'https://github.com/aehrc/open-pedigree?externalID', value: 'MRN998877' },
    ]);
    for (const privacy of ['nopersonal', 'minimal']) {
      const patient = GA4GHFHIRConverter.buildPedigreeIndividual('Patient/1', person, privacy);
      expect(patient.identifier).toBeUndefined();
      expect(JSON.stringify(patient)).not.toMatch(/Zebedee|Quarrington|MRN998877|1961|2020/);
    }
  });

  it('leaves the comments Observation out with the stricter option only', () => {
    const comments = (privacy) => {
      const observations = {};
      GA4GHFHIRConverter.addObservations(person, 'Patient/1', observations, privacy);
      return observations['Patient/1'].filter((o) => o.valueString === 'seen at clinic').length;
    };
    expect(comments(undefined)).toBe(1);
    expect(comments('all')).toBe(1);
    expect(comments('nopersonal')).toBe(1);
    expect(comments('minimal')).toBe(0);
  });
});
