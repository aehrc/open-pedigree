import { describe, it, expect, vi } from 'vitest';
import { parseQuestionnaire, isSupportedItemType, MAPS_TO_FIELD_TARGETS } from 'pedigree/questionnaire/questionnaireParser';
import smartDemoQuestionnaireBundle from '../../fixtures/smart/questionnaire.json';

function mappingExtension(kind) {
  return { url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: kind };
}

function actionExtension(action) {
  return { url: 'https://github.com/aehrc/open-pedigree/questionnaire-action', valueCode: action };
}

function predicateExtension(predicate) {
  return { url: 'https://github.com/aehrc/open-pedigree/questionnaire-enable-predicate', valueCode: predicate };
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

  it('an inline-answerOption choice item with the standard radio-button itemControl extension renders as radio, not select', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1', type: 'choice', answerOption: [{ valueString: 'A' }], columns: 3,
        extension: [{
          url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',
          valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] },
        }],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].fieldType).toBe('radio');
    expect(items[0].columns).toBe(3);
  });

  it('flattens a NESTED group item into a heading pseudo-field followed by children, preserving order', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 'tab1',
          type: 'group',
          text: 'Tab 1',
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
        },
      ],
    };
    const { items, tabs } = parseQuestionnaire(questionnaire);
    expect(items.map(i => i.linkId)).toEqual(['before', 'grp', 'child1', 'child2', 'after']);
    expect(items.find(i => i.linkId === 'grp').fieldType).toBe('heading');
    expect(tabs).toEqual([{ key: 'tab1', label: 'Tab 1' }]);
  });

  describe('top-level tab derivation', () => {
    it('each top-level group becomes a tab, keyed by linkId and labelled by text', () => {
      const questionnaire = {
        resourceType: 'Questionnaire',
        item: [
          { linkId: 'personal', type: 'group', text: 'Personal', item: [{ linkId: 'first_name', type: 'string' }] },
          { linkId: 'clinical', type: 'group', text: 'Clinical', item: [{ linkId: 'notes', type: 'text' }] },
        ],
      };
      const { items, tabs } = parseQuestionnaire(questionnaire);
      expect(tabs).toEqual([{ key: 'personal', label: 'Personal' }, { key: 'clinical', label: 'Clinical' }]);
      expect(items.map(i => i.linkId)).toEqual(['first_name', 'notes']);
      expect(items.find(i => i.linkId === 'first_name').tab).toEqual({ key: 'personal', label: 'Personal' });
    });

    it('two top-level groups sharing a display label produce two distinct tabs', () => {
      const questionnaire = {
        resourceType: 'Questionnaire',
        item: [
          { linkId: 'g1', type: 'group', text: 'Details', item: [{ linkId: 'f1', type: 'string' }] },
          { linkId: 'g2', type: 'group', text: 'Details', item: [{ linkId: 'f2', type: 'string' }] },
        ],
      };
      const { tabs } = parseQuestionnaire(questionnaire);
      expect(tabs).toEqual([{ key: 'g1', label: 'Details' }, { key: 'g2', label: 'Details' }]);
    });

    it('a non-group top-level item is placed on an implicit "General" tab, with a warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const questionnaire = {
        resourceType: 'Questionnaire',
        item: [{ linkId: 'stray', type: 'string' }],
      };
      const { items, tabs } = parseQuestionnaire(questionnaire);
      expect(tabs).toEqual([{ key: '__general__', label: 'General' }]);
      expect(items[0].tab).toEqual({ key: '__general__', label: 'General' });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
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
        linkId: 'tab1',
        type: 'group',
        text: 'Tab 1',
        item: [{
          linkId: 'grp',
          type: 'group',
          code: [coding],
          extension: [mappingExtension('mapsToCondition')],
          item: [{ linkId: 'child', type: 'string' }],
        }],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items.find(i => i.linkId === 'grp').mapping).toBeNull();
    warnSpy.mockRestore();
  });

  it('MAPS_TO_FIELD_TARGETS covers every terminal segment used by the supported item.definition targets', () => {
    expect(Object.keys(MAPS_TO_FIELD_TARGETS).sort()).toEqual(
      ['birthDate', 'carrierStatus', 'childlessStatus', 'comments', 'deceasedDateTime', 'evaluated', 'family',
        'gender', 'gestationAge', 'given', 'identifier', 'isAdopted', 'lifeStatus', 'lostContact', 'monozygotic'].sort()
    );
  });

  it('isSupportedItemType reflects the supported set', () => {
    expect(isSupportedItemType('boolean')).toBe(true);
    expect(isSupportedItemType('attachment')).toBe(false);
  });
});

describe('mapsToLegendCondition / mapsToLegendObservation mapping', () => {
  it('parses a valid legend-mapped item as a questionnaire-legend-picker with the right mapping kind', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'diagnoses', type: 'choice', repeats: true, answerValueSet: 'http://example.org/vs',
        extension: [mappingExtension('mapsToLegendCondition')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].fieldType).toBe('questionnaire-legend-picker');
    expect(items[0].mapping).toEqual({ kind: 'legendCondition' });
  });

  it('parses mapsToLegendObservation the same way, with kind legendObservation', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'findings', type: 'open-choice', repeats: true, answerValueSet: 'http://example.org/vs',
        extension: [mappingExtension('mapsToLegendObservation')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].fieldType).toBe('questionnaire-legend-picker');
    expect(items[0].mapping).toEqual({ kind: 'legendObservation' });
  });

  it('rejects a legend mapping when the item is not repeats=true', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'diagnoses', type: 'choice', repeats: false, answerValueSet: 'http://example.org/vs',
        extension: [mappingExtension('mapsToLegendCondition')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toBeNull();
    expect(items[0].fieldType).toBe('questionnaire-choice-picker');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rejects a legend mapping when there is no answerValueSet', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'diagnoses', type: 'choice', repeats: true,
        extension: [mappingExtension('mapsToLegendCondition')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rejects a legend mapping on a non-choice type', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'diagnoses', type: 'string', repeats: true, answerValueSet: 'http://example.org/vs',
        extension: [mappingExtension('mapsToLegendCondition')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].mapping).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('invokesAction mapping', () => {
  it('parses a valid action item as a button-action field with the action name', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'link_patient', type: 'display', text: 'Link to patient',
        extension: [mappingExtension('invokesAction'), actionExtension('linkPatient')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].fieldType).toBe('button-action');
    expect(items[0].mapping).toEqual({ kind: 'action', action: 'linkPatient' });
    expect(items[0].buttonLabel).toBe('Link to patient');
  });

  it('does not render an item with an unrecognised action name', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'mystery', type: 'display', text: 'Do something',
        extension: [mappingExtension('invokesAction'), actionExtension('deleteEverything')],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items.length).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not render an item declaring invokesAction with no questionnaire-action extension at all', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'mystery', type: 'display', text: 'Do something', extension: [mappingExtension('invokesAction')] }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items.length).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('predicate-based enableWhen conditions', () => {
  it('parses a condition carrying the predicate extension into {predicate, negate}', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1', type: 'string',
        enableWhen: [{ extension: [predicateExtension('isFetus')] }],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].enableWhen).toEqual([{ predicate: 'isFetus', negate: false }]);
  });

  it('carries a sibling negate:true flag through onto the parsed predicate condition', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1', type: 'string',
        enableWhen: [{ extension: [predicateExtension('isFetus')], negate: true }],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].enableWhen).toEqual([{ predicate: 'isFetus', negate: true }]);
  });

  it('leaves an ordinary item-answer condition unchanged when no predicate extension is present', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1', type: 'string',
        enableWhen: [{ question: 'q0', operator: '=', answerBoolean: true }],
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].enableWhen).toEqual([{ question: 'q0', operator: '=', answerBoolean: true }]);
  });

  it('parses a disabledWhen condition list the same way as enableWhen', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'q1', type: 'boolean',
        disabledWhen: [{ extension: [predicateExtension('isTwinWithConsistentGender')] }],
        disabledBehavior: 'any',
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].disabledWhen).toEqual([{ predicate: 'isTwinWithConsistentGender', negate: false }]);
    expect(items[0].disabledBehavior).toBe('any');
  });

  it('parses a per-option disablingPredicate directly on the item', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'gender', type: 'choice', answerOption: [{ valueString: 'M' }],
        disablingPredicate: 'possibleGenders', disablingPredicateTarget: 'inactive',
      }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].disablingPredicate).toBe('possibleGenders');
    expect(items[0].disablingPredicateTarget).toBe('inactive');
  });

  it('defaults disablingPredicateTarget to "inactive" when not specified', () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'q1', type: 'string' }],
    };
    const { items } = parseQuestionnaire(questionnaire);
    expect(items[0].disablingPredicate).toBeNull();
    expect(items[0].disablingPredicateTarget).toBe('inactive');
  });
});

describe('smart demo questionnaire fixture (tests/fixtures/smart/questionnaire.json)', () => {
  it('parses without warnings, with the full Personal/Clinical/Family-history-intake tabs and expected mappings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const questionnaireResource = smartDemoQuestionnaireBundle.entry[0].resource;
    const { items, canonicalUrl, tabs } = parseQuestionnaire(questionnaireResource);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(canonicalUrl).toBe('https://aehrc.github.io/open-pedigree/Questionnaire/demo|1.0');
    expect(tabs).toEqual([
      { key: 'personal_tab', label: 'Personal' },
      { key: 'clinical_tab', label: 'Clinical' },
      { key: 'intake_group', label: 'Family history intake' },
    ]);
    expect(items.map(i => i.linkId)).toEqual([
      'gender', 'first_name', 'last_name', 'link_patient', 'external_id', 'state',
      'carrier', 'disorders', 'comments',
      'diabetes', 'smoking_status', 'research_consent', 'consent_notes',
    ]);

    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.gender.mapping).toEqual({ kind: 'field', field: 'gender' });
    expect(byLinkId.gender.fieldType).toBe('radio');
    expect(byLinkId.link_patient.mapping).toEqual({ kind: 'action', action: 'linkPatient' });
    expect(byLinkId.state.disablingPredicate).toBe('lifeStatusAvailability');
    expect(byLinkId.carrier.disablingPredicateTarget).toBe('disabled');
    expect(byLinkId.disorders.mapping).toEqual({ kind: 'legendCondition' });
    expect(byLinkId.disorders.fieldType).toBe('questionnaire-legend-picker');
    expect(byLinkId.comments.mapping).toEqual({ kind: 'field', field: 'comments' });
    expect(byLinkId.diabetes.mapping.kind).toBe('condition');
    expect(byLinkId.smoking_status.mapping.kind).toBe('observation');
    expect(byLinkId.research_consent.mapping).toBeNull();
    expect(byLinkId.consent_notes.enableWhen).toEqual([{ question: 'research_consent', operator: '=', answerBoolean: true }]);

    warnSpy.mockRestore();
  });
});
