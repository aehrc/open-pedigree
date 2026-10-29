import type { LinkedRow } from 'pedigree/recordLinkProvider/AbstractRecordLinkProvider';

/**
 * The check on opening a pedigree (pedigree-editor-stale-linked-rows): which linked people's
 * records have changed since the pedigree last took them in. Pure - the editor supplies the
 * people, the provider's answer and the refresh comparison (pedigree.ts's
 * _linkedRecordRefreshChanges); see linkedRowsCheck.ts for the marks and notice.
 */

// A linked person as the check sees them: the ref and the snapshot they had when the rows were
// asked for. Their state is what identifies them, not their node ID, which shifts as nodes are
// removed. `key` is whatever the caller uses to find the node again.
export type LinkedPerson<K> = { key: K, ref: string, snapshot: string };

export type LinkedRowsResult<K> = {
  changed: LinkedPerson<K>[],
  missing: LinkedPerson<K>[],
  otherRecord: LinkedPerson<K>[]
};

/**
 * A snapshot in comparable form: key order doesn't matter, so two snapshots with the same entries
 * in a different order are the same.
 */
export function snapshotKey(snapshot: any): string {
  var sorted: any = {};
  Object.keys(snapshot || {}).sort().forEach(function(key) {
    sorted[key] = snapshot[key];
  });
  return JSON.stringify(sorted);
}

var EMPTY_SNAPSHOT = snapshotKey({});

/**
 * Whether a person's record has changed (design D1): the record differs from what the pedigree
 * last took in from it (the snapshot) - or, with nothing taken in yet (an empty snapshot: linked
 * before snapshots were kept, or to a record with nothing to bring in), from what the person
 * shows. A value changed in the diagram is not a change to the record.
 */
export function isRowChanged(changes: { valuesChanged: boolean, snapshotChanged: boolean }, snapshot: string): boolean {
  return snapshot === EMPTY_SNAPSHOT ? changes.valuesChanged : changes.snapshotChanged;
}

/**
 * Sorts the people asked about by the provider's answer. Left out: anyone whose ref or snapshot
 * has changed since they were asked about (re-linked, or refreshed by Edit in REDCap, before the
 * answer came - `current` says what they have now, or null if they're gone), anyone the answer
 * says nothing usable about, and anyone unchanged.
 *
 * @param changesFor The refresh comparison for a person and their record's answers.
 */
export function classifyLinkedRows<K>(
  people: LinkedPerson<K>[],
  rows: { [ref: string]: LinkedRow } | null | undefined,
  current: (key: K) => { ref: string, snapshot: string } | null,
  changesFor: (key: K, answers: {linkId: string, value: any}[]) => { valuesChanged: boolean, snapshotChanged: boolean }
): LinkedRowsResult<K> {
  var result: LinkedRowsResult<K> = { changed: [], missing: [], otherRecord: [] };
  if (!rows || typeof rows !== 'object') {
    return result;
  }
  people.forEach(function(person) {
    var now = current(person.key);
    if (!now || now.ref !== person.ref || now.snapshot !== person.snapshot) {
      return;
    }
    var row = Object.prototype.hasOwnProperty.call(rows, person.ref) ? rows[person.ref] : null;
    if (!row || typeof row !== 'object') {
      return;
    }
    if (row.otherRecord) {
      result.otherRecord.push(person);
    } else if (row.missing) {
      result.missing.push(person);
    } else if (Array.isArray(row.answers) && isRowChanged(changesFor(person.key, row.answers), person.snapshot)) {
      result.changed.push(person);
    }
  });
  return result;
}
