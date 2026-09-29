import { describe, it, expect } from 'vitest';
import { computeLinkedRecordRefresh, relinkRefreshInput, isUnusableAnswer, CLEAR_VALUES, clearValueFor, sameValue } from 'pedigree/recordLinkProvider/linkedRecordRefresh';

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
    expect(sameValue('setBirthDate', new Date(2001, 1, 3), '2001-02-03')).toBe(true);
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
    const r = refresh([{ linkId: 'dob', value: null }], { current: { setBirthDate: new Date(1980, 0, 1) } });
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

// Linking to a different record: every value it has is applied; the previous record's values
// clear where it has none, but only while the node still holds them.
function relink(answers, { current = {}, previous = {} } = {}) {
  const isLegend = (linkId) => linkId === 'disorders';
  const legendKey = (_linkId, e) => sanitise(typeof e === 'object' ? e.id : e);
  const isUnusable = (linkId, value) => isUnusableAnswer(SETTER_FOR[linkId] || '', value);
  const input = relinkRefreshInput(answers, previous, isLegend, legendKey, isUnusable);
  return refresh(input.answers, { current, snapshot: input.snapshot });
}

describe('relinkRefreshInput (linking to a different record)', () => {
  it('applies a value the new record shares with the old one, even over a diagram edit', () => {
    const r = relink([{ linkId: 'notes', value: 'X' }], {
      current: { setQuestionnaireAnswer_notes: 'Y' }, previous: { notes: 'X' },
    });
    expect(r.properties).toEqual({ setQuestionnaireAnswer_notes: 'X' });
    expect(r.snapshot).toEqual({ notes: 'X' });
  });

  it('clears the old record\'s value where the new one has none, but keeps a diagram edit', () => {
    const r = relink([{ linkId: 'notes', value: null }, { linkId: 'first_name', value: null }], {
      current: { setQuestionnaireAnswer_notes: 'old', setFirstName: 'Typed' }, previous: { notes: 'old', first_name: 'Alice' },
    });
    expect(r.properties).toEqual({ setQuestionnaireAnswer_notes: null });
    expect(r.snapshot).toEqual({});
  });

  it('clears the old record\'s values for linkIds the new record leaves out entirely', () => {
    const r = relink([], { current: { setQuestionnaireAnswer_notes: 'old' }, previous: { notes: 'old' } });
    expect(r.properties).toEqual({ setQuestionnaireAnswer_notes: null });
    expect(r.snapshot).toEqual({});
  });

  it('reconciles legends: drops the old record\'s entries, re-adds shared ones, keeps diagram ones', () => {
    // Old record sent A and C; the user removed A and added D. The new record sends A and B.
    const r = relink([{ linkId: 'disorders', value: [{ id: 'A' }, { id: 'B' }] }], {
      current: { setDisorders: ['C', 'D'] }, previous: { disorders: [{ id: 'A' }, { id: 'C' }] },
    });
    expect(r.properties.setDisorders.slice().sort()).toEqual(['A', 'B', 'D']);
    expect(r.snapshot).toEqual({ disorders: [{ id: 'A' }, { id: 'B' }] });
  });

  it('clears the old record\'s date when the new record\'s can\'t be parsed, instead of leaving it untracked', () => {
    const r = relink([{ linkId: 'dob', value: 'unknown' }], {
      current: { setBirthDate: new Date(1980, 0, 1) }, previous: { dob: '1980-01-01' },
    });
    expect(r.properties).toEqual({ setBirthDate: '' });
    expect(r.snapshot).toEqual({});
  });

  it('skips null entries in the answers', () => {
    const r = relink([null, { linkId: 'notes', value: 'x' }], { previous: { notes: 'old' } });
    expect(r.properties).toEqual({ setQuestionnaireAnswer_notes: 'x' });
  });

  it('with no previous record, applies everything the new record has', () => {
    const r = relink([{ linkId: 'first_name', value: 'Carol' }, { linkId: 'notes', value: null }], {
      current: { setFirstName: 'Typed' },
    });
    expect(r.properties).toEqual({ setFirstName: 'Carol' });
  });
});

describe('an unparseable date on an ordinary refresh', () => {
  it('leaves the node alone but keeps tracking the last usable date, so a later empty clears it', () => {
    const first = refresh([{ linkId: 'dob', value: 'unknown' }], {
      current: { setBirthDate: new Date(1980, 0, 1) }, snapshot: { dob: '1980-01-01' },
    });
    expect(first.properties).toEqual({});
    expect(first.snapshot).toEqual({ dob: '1980-01-01' });
    const later = refresh([{ linkId: 'dob', value: null }], {
      current: { setBirthDate: new Date(1980, 0, 1) }, snapshot: first.snapshot,
    });
    expect(later.properties).toEqual({ setBirthDate: '' });
  });
});
