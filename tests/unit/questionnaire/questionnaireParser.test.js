import { describe, it, expect, vi } from 'vitest';
import { parseQuestionnaire, isSupportedItemType, MAPS_TO_FIELD_TARGETS } from 'pedigree/questionnaire/questionnaireParser';
import smartDemoQuestionnaireBundle from '../../fixtures/smart/questionnaire.json';

function mappingExtension(kind) {
  return { url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: kind };
}

describe('parseQuestionnaire', () => {
  it('maps supported item types to the expected field types', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [
        { linkId: 'q1', type: 'string' },
        { linkId: 'q2', type: 'text' },
        { linkId: 'q3', type: 'boolean' },
        { linkId: 'q4', type: 'date' },
        { linkId: 'q5', type: 'integer' },
        { linkId: 'q6', type: 'decimal' },
        { linkId: 'q7', type: 'choice', answerOption: [{ valueString: 'A' }] },
        { linkId: 'q8', type: 'choice', answerValueSet: 'http://example.org/vs' },
        { linkId: 'q9', type: 'open-choice', answerValueSet: 'http://example.org/vs' },
      ],
    };
    const { items } = parseQuestionnaire(questionnaire);
    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.q1.fieldType).toBe('text');
    expect(byLinkId.q2.fieldType).toBe('textarea');
    expect(byLinkId.q3.fieldType).toBe('checkbox');
    expect(byLinkId.q4.fieldType).toBe('date-picker');
    expect(byLinkId.q5.fieldType).toBe('number');
    expect(byLinkId.q6.fieldType).toBe('number');
    expect(byLinkId.q7.fieldType).toBe('select');
    expect(byLinkId.q8.fieldType).toBe('questionnaire-choice-picker');
    expect(byLinkId.q9.fieldType).toBe('questionnaire-choice-picker');
  });

  it('flattens group items into a heading pseudo-field followed by children, preserving order', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [
        { linkId: 'before', type: 'string' },
        {
          linkId: 'grp',
          type: 'group',
          text: 'Section',
          item: [
            { linkId: 'child1', type: 'string' },
            { linkId: 'child2', type: 'boolean' },
          ],
        },
        { linkId: 'after', type: 'string' },
      ],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items.map(i => i.linkId)).toEqual(['before', 'grp', 'child1', 'child2', 'after']);
    expect(items.find(i => i.linkId === 'grp').fieldType).toBe('heading');
  });

  it('skips unsupported item types and logs a warning, without failing the rest of the parse', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [
        { linkId: 'ok', type: 'string' },
        { linkId: 'bad', type: 'attachment' },
        { linkId: 'ok2', type: 'boolean' },
      ],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items.map(i => i.linkId)).toEqual(['ok', 'ok2']);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('builds the canonical URL from url + version when both are present', () => {
    const { canonicalUrl } = parseQuestionnaire({
      resourceType: 'Questionnaire',
      url: 'http://example.org/Questionnaire/123',
      version: '1.0',
      item: [],
    });
    expect(canonicalUrl).toBe('http://example.org/Questionnaire/123|1.0');
  });

  it('parses a valid mapsToField extension, resolving item.definition to the terminal segment', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1',
        type: 'boolean',
        definition: 'https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.carrierStatus',
        extension: [mappingExtension('mapsToField')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toEqual({ kind: 'field', field: 'carrierStatus' });
  });

  it('resolves a real Patient element definition to the same terminal-segment target', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1',
        type: 'string',
        definition: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.name.given',
        extension: [mappingExtension('mapsToField')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toEqual({ kind: 'field', field: 'given' });
  });

  it('rejects a mapsToField extension whose item.definition does not resolve to a supported property', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1',
        type: 'string',
        definition: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.disorders',
        extension: [mappingExtension('mapsToField')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rejects a mapsToField extension with no item.definition at all', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'string', extension: [mappingExtension('mapsToField')] }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('parses a valid mapsToCondition extension, wrapping item.code into a CodeableConcept', () => {
    const coding = { system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes' };
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1',
        type: 'boolean',
        code: [coding],
        extension: [mappingExtension('mapsToCondition')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toEqual({ kind: 'condition', code: { coding: [coding] } });
  });

  it('rejects a mapsToCondition/mapsToObservation extension with no item.code', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'boolean', extension: [mappingExtension('mapsToCondition')] }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rejects a mapping extension on a group item', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const coding = { system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes' };
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'grp',
        type: 'group',
        code: [coding],
        extension: [mappingExtension('mapsToCondition')],
        item: [{ linkId: 'child', type: 'string' }],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items.find(i => i.linkId === 'grp').mapping).toBeNull();
    warnSpy.mockRestore();
  });

  it('MAPS_TO_FIELD_TARGETS covers every terminal segment used by the supported item.definition targets', () => {
    expect(Object.keys(MAPS_TO_FIELD_TARGETS).sort()).toEqual(
      ['birthDate', 'carrierStatus', 'comments', 'deceasedDateTime', 'family', 'gender', 'gestationAge', 'given', 'identifier', 'lifeStatus'].sort()
    );
  });

  it('isSupportedItemType reflects the supported set', () => {
    expect(isSupportedItemType('boolean')).toBe(true);
    expect(isSupportedItemType('attachment')).toBe(false);
  });
});

describe('smart demo questionnaire fixture (tests/fixtures/smart/questionnaire.json)', () => {
  it('parses without warnings, in document order, with the expected mappings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaireResource = smartDemoQuestionnaireBundle.entry[0].resource;
    const { items, canonicalUrl } = parseQuestionnaire(questionnaireResource);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(canonicalUrl).toBe('https://aehrc.github.io/open-pedigree/Questionnaire/demo|1.0');
    expect(items.map(i => i.linkId)).toEqual([
      'clinical_notes', 'intake_group', 'diabetes', 'smoking_status', 'research_consent', 'consent_notes',
    ]);

    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.clinical_notes.mapping).toEqual({ kind: 'field', field: 'comments' });
    expect(byLinkId.intake_group.fieldType).toBe('heading');
    expect(byLinkId.diabetes.mapping.kind).toBe('condition');
    expect(byLinkId.smoking_status.mapping.kind).toBe('observation');
    expect(byLinkId.research_consent.mapping).toBeNull();
    expect(byLinkId.consent_notes.enableWhen).toEqual([{ question: 'research_consent', operator: '=', answerBoolean: true }]);

    warnSpy.mockRestore();
  });
});
