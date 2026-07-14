import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from 'pedigree/questionnaire/defaultQuestionnaire';
import { parseQuestionnaire } from 'pedigree/questionnaire/questionnaireParser';

describe('DEFAULT_QUESTIONNAIRE', () => {
  it('parses without warnings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('produces exactly the Personal and Clinical tabs, in order', () => {
    const { tabs } = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    expect(tabs).toEqual([
      { key: 'personal_tab', label: 'Personal' },
      { key: 'clinical_tab', label: 'Clinical' },
    ]);
  });

  it('covers every field from the legacy hardcoded form (except the inert identifier field)', () => {
    const { items } = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    const linkIds = items.map(i => i.linkId);
    expect(linkIds).toEqual([
      'gender', 'first_name', 'last_name', 'link_patient', 'external_id', 'date_of_birth', 'date_of_death',
      'state', 'gestation_age', 'childlessSelect', 'adopted', 'monozygotic', 'nocontact', 'placeholder',
      'carrier', 'evaluated', 'disorders', 'import_from_record', 'candidate_genes', 'hpo_positive', 'comments',
    ]);
  });

  it('gender/state/carrier render as radio (not select), with the right disabling predicate target', () => {
    const { items } = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.gender.fieldType).toBe('radio');
    expect(byLinkId.gender.disablingPredicate).toBe('possibleGenders');
    expect(byLinkId.gender.disablingPredicateTarget).toBe('inactive');
    expect(byLinkId.state.fieldType).toBe('radio');
    expect(byLinkId.state.disablingPredicate).toBe('lifeStatusAvailability');
    expect(byLinkId.carrier.fieldType).toBe('radio');
    expect(byLinkId.carrier.disablingPredicateTarget).toBe('disabled');
    expect(byLinkId.childlessSelect.fieldType).toBe('select');
  });

  it('scalar fields map to their real Person property via mapsToField', () => {
    const { items } = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.gender.mapping).toEqual({ kind: 'field', field: 'gender' });
    expect(byLinkId.first_name.mapping).toEqual({ kind: 'field', field: 'given' });
    expect(byLinkId.adopted.mapping).toEqual({ kind: 'field', field: 'isAdopted' });
    expect(byLinkId.monozygotic.mapping).toEqual({ kind: 'field', field: 'monozygotic' });
    expect(byLinkId.nocontact.mapping).toEqual({ kind: 'field', field: 'lostContact' });
    expect(byLinkId.childlessSelect.mapping).toEqual({ kind: 'field', field: 'childlessStatus' });
    expect(byLinkId.evaluated.mapping).toEqual({ kind: 'field', field: 'evaluated' });
    expect(byLinkId.comments.mapping).toEqual({ kind: 'field', field: 'comments' });
  });

  it('disorders/genes/phenotypes map to the legend mechanism with the right resource kind', () => {
    const { items } = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.disorders.mapping).toEqual({ kind: 'legendCondition' });
    expect(byLinkId.disorders.fieldType).toBe('questionnaire-legend-picker');
    expect(byLinkId.candidate_genes.mapping).toEqual({ kind: 'legendObservation' });
    expect(byLinkId.hpo_positive.mapping).toEqual({ kind: 'legendObservation' });
  });

  it('link_patient/import_from_record are button-action items invoking the right built-in action', () => {
    const { items } = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.link_patient.fieldType).toBe('button-action');
    expect(byLinkId.link_patient.mapping).toEqual({ kind: 'action', action: 'linkPatient' });
    expect(byLinkId.import_from_record.mapping).toEqual({ kind: 'action', action: 'importClinicalData' });
  });

  it('monozygotic declares both an enableWhen (inactive) and disabledWhen (disabled) predicate', () => {
    const { items } = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.monozygotic.enableWhen).toEqual([{ predicate: 'isTwin', negate: false }]);
    expect(byLinkId.monozygotic.disabledWhen).toEqual([{ predicate: 'isTwinWithConsistentGender', negate: false }]);
  });

  it('placeholder is unconditionally unsatisfiable (always inactive)', () => {
    const { items } = parseQuestionnaire(DEFAULT_QUESTIONNAIRE);
    const byLinkId = Object.fromEntries(items.map(i => [i.linkId, i]));
    expect(byLinkId.placeholder.enableWhen).toEqual([
      { predicate: 'isProband', negate: false },
      { predicate: 'isProband', negate: true },
    ]);
    expect(byLinkId.placeholder.enableBehavior).toBe('all');
  });
});
