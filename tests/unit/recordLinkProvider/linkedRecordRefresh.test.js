import { describe, it, expect } from 'vitest';
import { computeLinkedRecordRefresh, CLEAR_VALUES, clearValueFor, sameValue } from 'pedigree/recordLinkProvider/linkedRecordRefresh';

const SETTER_FOR = {
  first_name: 'setFirstName', gender: 'setGender', dob: 'setBirthDate', dod: 'setDeathDate', weeks: 'setGestationAge', disorders: 'setDisorders',
};
const sanitise = (id) => String(id).replace(/:/g, '_C_');

// current: setter -> node value; snapshot: linkId -> what the record sent last time.
function refresh(answers, { current = {}, snapshot = {} } = {}) {
  return computeLinkedRecordRefresh({
    answers,
    resolveSetter: (linkId) => SETTER_FOR[linkId] || ('setQuestionnaireAnswer_' + linkId),
    isLegend: (linkId) => linkId === 'disorders',
    legendKey: (_linkId, e) => sanitise(typeof e === 'object' ? e.id : e),
    legendSetterEntry: (_linkId, e) => e.id,
    current: (setter) => current[setter],
    snapshot,
  });
}

describe('clear table and comparison', () => {
  it('has an unset value for every mapped setter, and null for generic answers', () => {
    expect(Object.keys(CLEAR_VALUES).sort()).toEqual([
      'setAdopted', 'setBirthDate', 'setCarrierStatus', 'setChildlessStatus', 'setComments', 'setDeathDate',
      'setEvaluated', 'setExternalID', 'setFirstName', 'setGender', 'setGestationAge', 'setLastName',
      'setLifeStatus', 'setLostContact', 'setMonozygotic',
    ]);
    expect(CLEAR_VALUES.setGender).toBe('U');
    expect(clearValueFor('setQuestionnaireAnswer_notes')).toBeNull();
  });

  it('compares dates by day and is strict about 0/false vs empty', () => {
    expect(sameValue('setBirthDate', new Date('2001-02-03'), '2001-02-03')).toBe(true);
    expect(sameValue('setQuestionnaireAnswer_count', 0, null)).toBe(false);
    expect(sameValue('setAdopted', false, '')).toBe(false);
  });
});

describe('computeLinkedRecordRefresh (compares with what the record sent last time)', () => {
  it('sets a new value and snapshots it', () => {
    const r = refresh([{ linkId: 'first_name', value: 'Alice' }]);
    expect(r.properties).toEqual({ setFirstName: 'Alice' });
    expect(r.snapshot).toEqual({ first_name: 'Alice' });
  });

  it('does nothing when the record is unchanged, even if the node reads back differently', () => {
    // e.g. gestation age reads back null for a live-born person; gender was rejected
    const r = refresh([{ linkId: 'weeks', value: 38 }, { linkId: 'gender', value: 'F' }], {
      current: { setGestationAge: null, setGender: 'M' }, snapshot: { weeks: 38, gender: 'F' },
    });
    expect(r.properties).toEqual({});
    expect(r.valuesChanged).toBe(false);
  });

  it('clears an emptied value while the node still holds the record\'s value', () => {
    const r = refresh([{ linkId: 'notes', value: null }], {
      current: { setQuestionnaireAnswer_notes: 'old' }, snapshot: { notes: 'old' },
    });
    expect(r.properties).toEqual({ setQuestionnaireAnswer_notes: null });
    expect(r.snapshot).toEqual({});
  });

  it('does not clear when the node holds something else (diagram edit, or a rejected value)', () => {
    const r = refresh([{ linkId: 'gender', value: null }], {
      current: { setGender: 'M' }, snapshot: { gender: 'F' },
    });
    expect(r.properties).toEqual({});
    expect(r.snapshot).toEqual({});
  });

  it('never clears a value the record never sent', () => {
    const r = refresh([{ linkId: 'dob', value: null }], { current: { setBirthDate: new Date('1980-01-01') } });
    expect(r.properties).toEqual({});
  });

  it('clears gender to U and an integer 0 answer', () => {
    const r = refresh([{ linkId: 'gender', value: null }, { linkId: 'count', value: null }], {
      current: { setGender: 'F', setQuestionnaireAnswer_count: 0 }, snapshot: { gender: 'F', count: 0 },
    });
    expect(r.properties).toEqual({ setGender: 'U', setQuestionnaireAnswer_count: null });
  });

  it('takes the answers as the record\'s full state: an omitted linkId drops from the snapshot, without clearing the node', () => {
    const r = refresh([{ linkId: 'first_name', value: 'Alice' }], {
      current: { setQuestionnaireAnswer_notes: 'x' }, snapshot: { notes: 'x', first_name: 'Alice' },
    });
    expect(r.snapshot).toEqual({ first_name: 'Alice' });
    expect(r.properties).toEqual({});
  });

  it('skips an unparseable date instead of storing Invalid Date, and does not snapshot it', () => {
    const r = refresh([{ linkId: 'dob', value: '31-12-1980' }], { current: { setBirthDate: '' } });
    expect(r.properties).toEqual({});
    expect(r.snapshot).toEqual({});
  });

  describe('legend reconciliation', () => {
    it('removes a dropped entry, keeping a diagram-entered one', () => {
      const r = refresh([{ linkId: 'disorders', value: null }], {
        current: { setDisorders: ['D1', 'D9'] }, snapshot: { disorders: [{ id: 'D1', name: 'One' }] },
      });
      expect(r.properties).toEqual({ setDisorders: ['D9'] });
      expect(r.snapshot).toEqual({});
    });

    it('replaces a changed entry rather than merging', () => {
      const r = refresh([{ linkId: 'disorders', value: [{ id: 'D2', name: 'Two' }] }], {
        current: { setDisorders: ['D1', 'D9'] }, snapshot: { disorders: [{ id: 'D1', name: 'One' }] },
      });
      expect(r.properties).toEqual({ setDisorders: ['D9', 'D2'] });
    });

    it('matches sanitised stored IDs, so an unchanged or re-sent entry is not duplicated', () => {
      const unchanged = refresh([{ linkId: 'disorders', value: [{ id: 'HP:1', name: 'x' }] }], {
        current: { setDisorders: ['HP_C_1'] }, snapshot: { disorders: [{ id: 'HP:1', name: 'x' }] },
      });
      expect(unchanged.properties).toEqual({});
      const firstTime = refresh([{ linkId: 'disorders', value: [{ id: 'HP:1', name: 'x' }] }], {
        current: { setDisorders: ['HP_C_1'] },
      });
      expect(firstTime.properties).toEqual({});
      expect(firstTime.snapshot).toEqual({ disorders: [{ id: 'HP:1', name: 'x' }] });
    });

    it('removes a sanitised stored entry when the record drops its raw ID', () => {
      const r = refresh([{ linkId: 'disorders', value: [] }], {
        current: { setDisorders: ['HP_C_1'] }, snapshot: { disorders: [{ id: 'HP:1', name: 'x' }] },
      });
      expect(r.properties).toEqual({ setDisorders: [] });
    });
  });
});
