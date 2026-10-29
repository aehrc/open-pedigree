import { describe, it, expect } from 'vitest';
import { classifyLinkedRows, snapshotKey } from 'pedigree/recordLinkProvider/staleLinkedRows';

const SNAPSHOT = snapshotKey({ first_name: 'Ruth' });
const EMPTY = snapshotKey({});

function person(key, ref, snapshot = SNAPSHOT) {
  return { key, ref, snapshot };
}

// people: the people asked about; now: key -> their state when the answer arrives (default: as asked).
function classify(people, rows, { now = {} } = {}) {
  return classifyLinkedRows(people, rows, (key) => (key in now ? now[key] : people.find((p) => p.key === key)));
}

describe('snapshotKey', () => {
  it('ignores key order', () => {
    expect(snapshotKey({ a: 1, b: [2] })).toBe(snapshotKey({ b: [2], a: 1 }));
    expect(snapshotKey(undefined)).toBe(EMPTY);
  });
});

describe('classifyLinkedRows', () => {
  const answers = [{ linkId: 'first_name', value: 'Ruth' }];

  it('collects the people whose records answered', () => {
    const one = person(1, 'record:1/instance:1');
    const two = person(2, 'record:1/instance:2', EMPTY);
    const result = classify([one, two], { [one.ref]: { answers }, [two.ref]: { answers: [] } });
    expect(result).toEqual({ answered: [one, two], missing: [], otherRecord: [] });
  });

  it('reports missing rows and other-record links, not as changed', () => {
    const gone = person(1, 'record:1/instance:9');
    const other = person(2, 'record:2/instance:1');
    const result = classify([gone, other], { [gone.ref]: { missing: true }, [other.ref]: { otherRecord: true } });
    expect(result).toEqual({ answered: [], missing: [gone], otherRecord: [other] });
  });

  it('skips a person re-linked or refreshed before the answer arrived, or gone', () => {
    const relinked = person(1, 'record:1/instance:1');
    const refreshed = person(2, 'record:1/instance:2');
    const removed = person(3, 'record:1/instance:3');
    const rows = { [relinked.ref]: { missing: true }, [refreshed.ref]: { answers }, [removed.ref]: { missing: true } };
    const result = classify([relinked, refreshed, removed], rows, {
      now: {
        1: { ref: 'record:1/instance:5', snapshot: SNAPSHOT },
        2: { ref: refreshed.ref, snapshot: snapshotKey({ first_name: 'Ruthie' }) },
        3: null,
      },
    });
    expect(result).toEqual({ answered: [], missing: [], otherRecord: [] });
  });

  it('says nothing about a ref the answer leaves out or garbles', () => {
    const left = person(1, 'record:1/instance:1');
    const garbled = person(2, 'record:1/instance:2');
    expect(classify([left, garbled], { [garbled.ref]: 'nonsense' })).toEqual({ answered: [], missing: [], otherRecord: [] });
    expect(classify([left], null)).toEqual({ answered: [], missing: [], otherRecord: [] });
  });
});
