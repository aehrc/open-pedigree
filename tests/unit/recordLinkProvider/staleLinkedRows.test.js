import { describe, it, expect } from 'vitest';
import { classifyLinkedRows, snapshotKey } from 'pedigree/recordLinkProvider/staleLinkedRows';

const SNAPSHOT = snapshotKey({ first_name: 'Ruth' });
const EMPTY = snapshotKey({});

function person(key, ref, snapshot = SNAPSHOT) {
  return { key, ref, snapshot };
}

// people: the people asked about; now: key -> their state when the answer arrives (default: as asked);
// changes: the keys whose refresh would change what they show.
function classify(people, rows, { now = {}, changes = [] } = {}) {
  return classifyLinkedRows(
    people,
    rows,
    (key) => (key in now ? now[key] : people.find((p) => p.key === key)),
    (key) => changes.includes(key)
  );
}

describe('snapshotKey', () => {
  it('ignores key order', () => {
    expect(snapshotKey({ a: 1, b: [2] })).toBe(snapshotKey({ b: [2], a: 1 }));
    expect(snapshotKey(undefined)).toBe(EMPTY);
  });
});

describe('classifyLinkedRows', () => {
  const answers = [{ linkId: 'first_name', value: 'Ruth' }];

  it('reports a person whose refresh would change what they show, and only them', () => {
    const changed = person(1, 'record:1/instance:1');
    const same = person(2, 'record:1/instance:2', EMPTY);
    const result = classify([changed, same], { [changed.ref]: { answers }, [same.ref]: { answers } }, { changes: [1] });
    expect(result).toEqual({ changed: [changed], missing: [], otherRecord: [] });
  });

  it('reports missing rows and other-record links, not as changed', () => {
    const gone = person(1, 'record:1/instance:9');
    const other = person(2, 'record:2/instance:1');
    const result = classify([gone, other], { [gone.ref]: { missing: true }, [other.ref]: { otherRecord: true } }, { changes: [1, 2] });
    expect(result).toEqual({ changed: [], missing: [gone], otherRecord: [other] });
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
      changes: [2],
    });
    expect(result).toEqual({ changed: [], missing: [], otherRecord: [] });
  });

  it('says nothing about a ref the answer leaves out or garbles', () => {
    const left = person(1, 'record:1/instance:1');
    const garbled = person(2, 'record:1/instance:2');
    expect(classify([left, garbled], { [garbled.ref]: 'nonsense' })).toEqual({ changed: [], missing: [], otherRecord: [] });
    expect(classify([left], null)).toEqual({ changed: [], missing: [], otherRecord: [] });
  });
});
