import { describe, it, expect } from 'vitest';
import { computeLinkedRecordRefresh, CLEAR_VALUES, clearValueFor, sameValue } from 'pedigree/recordLinkProvider/linkedRecordRefresh';

// A node stand-in: setter name -> current value.
function refresh(answers, { current = {}, supplied = {}, legend = ['disorders'] } = {}) {
  const setterFor = {
    first_name: 'setFirstName', gender: 'setGender', life: 'setLifeStatus', dob: 'setBirthDate',
    dod: 'setDeathDate', carrier: 'setCarrierStatus', adopted: 'setAdopted', weeks: 'setGestationAge',
    disorders: 'setDisorders',
  };
  return computeLinkedRecordRefresh({
    answers,
    resolveSetter: (linkId) => setterFor[linkId] || ('setQuestionnaireAnswer_' + linkId),
    isLegendTarget: (linkId) => legend.includes(linkId),
    current: (setter) => current[setter],
    supplied,
  });
}

describe('clear table (design D5)', () => {
  it('gives each mapped setter the value it treats as unset, and null for generic answers', () => {
    expect(CLEAR_VALUES.setGender).toBe('U');
    expect(CLEAR_VALUES.setLifeStatus).toBe('alive');
    expect(CLEAR_VALUES.setAdopted).toBe(false);
    expect(CLEAR_VALUES.setGestationAge).toBe('');
    expect(clearValueFor('setQuestionnaireAnswer_notes')).toBeNull();
  });
});

describe('sameValue', () => {
  it('compares dates by calendar day, across Date objects and strings', () => {
    expect(sameValue('setBirthDate', new Date('2001-02-03'), '2001-02-03')).toBe(true);
    expect(sameValue('setBirthDate', new Date('2001-02-03'), '2001-02-04')).toBe(false);
    expect(sameValue('setBirthDate', '', '')).toBe(true);
  });

  it('is strict: 0 is not the same as empty, false is not the same as empty', () => {
    expect(sameValue('setQuestionnaireAnswer_count', 0, null)).toBe(false);
    expect(sameValue('setAdopted', false, '')).toBe(false);
  });

  it('treats a non-fetus gestation age (null) and a cleared one as the same', () => {
    expect(sameValue('setGestationAge', null, '')).toBe(true);
  });
});

describe('computeLinkedRecordRefresh', () => {
  it('sets non-empty values and records them as supplied', () => {
    const r = refresh([{ linkId: 'first_name', value: 'Alice' }], { current: { setFirstName: '' } });
    expect(r.properties).toEqual({ setFirstName: 'Alice' });
    expect(r.supplied).toEqual({ first_name: true });
  });

  it('clears a value the record supplied last time', () => {
    const r = refresh([{ linkId: 'notes', value: null }], {
      current: { setQuestionnaireAnswer_notes: 'old' }, supplied: { notes: true },
    });
    expect(r.properties).toEqual({ setQuestionnaireAnswer_notes: null });
    expect(r.supplied).toEqual({});
  });

  it('never clears a value the record did not supply (diagram-entered)', () => {
    const r = refresh([{ linkId: 'dob', value: null }], { current: { setBirthDate: new Date('1980-01-01') } });
    expect(r.properties).toEqual({});
    expect(r.valuesChanged).toBe(false);
  });

  it('clears gender to U and an integer 0 answer, which loose comparison would miss', () => {
    const r = refresh([{ linkId: 'gender', value: null }, { linkId: 'count', value: null }], {
      current: { setGender: 'F', setQuestionnaireAnswer_count: 0 }, supplied: { gender: true, count: true },
    });
    expect(r.properties).toEqual({ setGender: 'U', setQuestionnaireAnswer_count: null });
  });

  it('changes nothing when the record matches the node', () => {
    const r = refresh([{ linkId: 'first_name', value: 'Alice' }, { linkId: 'dob', value: '2001-02-03' }], {
      current: { setFirstName: 'Alice', setBirthDate: new Date('2001-02-03') }, supplied: { first_name: true, dob: true },
    });
    expect(r.properties).toEqual({});
    expect(r.valuesChanged).toBe(false);
  });

  it('applies clears before sets, and life status then birth date then death date', () => {
    const r = refresh([
      { linkId: 'dod', value: '2020-01-01' }, { linkId: 'notes', value: null },
      { linkId: 'dob', value: '1950-01-01' }, { linkId: 'life', value: 'deceased' },
    ], { current: { setQuestionnaireAnswer_notes: 'x' }, supplied: { notes: true } });
    expect(Object.keys(r.properties)).toEqual(['setQuestionnaireAnswer_notes', 'setLifeStatus', 'setBirthDate', 'setDeathDate']);
  });

  it('keeps supplied entries for linkIds the refresh does not mention', () => {
    const r = refresh([{ linkId: 'first_name', value: 'Alice' }], { current: { setFirstName: 'Alice' }, supplied: { notes: true } });
    expect(r.supplied).toEqual({ notes: true, first_name: true });
  });

  describe('legend reconciliation', () => {
    it('removes a supplied disorder the record no longer has, keeping a diagram-entered one', () => {
      const r = refresh([{ linkId: 'disorders', value: null }], {
        current: { setDisorders: ['D1', 'D9'] }, supplied: { disorders: ['D1'] },
      });
      expect(r.properties).toEqual({ setDisorders: ['D9'] });
      expect(r.supplied).toEqual({});
    });

    it('replaces a changed disorder rather than merging', () => {
      const r = refresh([{ linkId: 'disorders', value: [{ id: 'D2', name: 'Two' }] }], {
        current: { setDisorders: ['D1', 'D9'] }, supplied: { disorders: ['D1'] },
      });
      expect(r.properties).toEqual({ setDisorders: ['D9', 'D2'] });
      expect(r.supplied).toEqual({ disorders: ['D2'] });
    });

    it('does not duplicate an entry the diagram already had, and takes ownership of it', () => {
      const r = refresh([{ linkId: 'disorders', value: [{ id: 'D9', name: 'Nine' }] }], {
        current: { setDisorders: ['D9'] }, supplied: {},
      });
      expect(r.properties).toEqual({});
      expect(r.supplied).toEqual({ disorders: ['D9'] });
    });
  });
});
