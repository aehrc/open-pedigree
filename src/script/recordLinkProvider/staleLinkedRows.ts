import type { LinkedRow } from 'pedigree/recordLinkProvider/AbstractRecordLinkProvider';

/**
 * The check on opening a pedigree (pedigree-editor-stale-linked-rows): which linked people's
 * records have changed since the pedigree last took them in. Pure - the editor supplies the
 * people and the provider's answer; linkedRowsCheck.ts decides who has changed (with the refresh's
 * own comparison), and shows the marks and notice.
 *
 * A person's record has changed (design D1) when refreshing them from it - what Update and
 * closing Edit in REDCap do - would change what they show. The refresh only applies what the
 * record changed since the pedigree last took it in (the person's snapshot), so a value changed
 * in the diagram isn't a change to the record; with nothing taken in yet (an empty snapshot), it's
 * whatever differs from what the person shows. Fields the Questionnaire in effect doesn't have
 * are left out, as the refresh leaves them out.
 */

// A linked person as the check sees them: the ref and the snapshot they had when the rows were
// asked for. Their state is what identifies them, not their node ID, which shifts as nodes are
// removed. `key` is whatever the caller uses to find the node again.
export type LinkedPerson<K> = { key: K, ref: string, snapshot: string };

export type LinkedRowsResult<K> = {
  // Their record's answers came back: whether each has changed is decided from those answers and
  // what the person shows at the time (it can change as the diagram is edited).
  answered: LinkedPerson<K>[],
  missing: LinkedPerson<K>[],
  otherRecord: LinkedPerson<K>[]
};

/** The key identifying a linked person's state: their ref and snapshot (see snapshotKey). */
export function stateKey(ref: string, snapshot: string): string {
  return ref + '\n' + snapshot;
}

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

/**
 * Sorts the people asked about by the provider's answer. Left out: anyone whose ref or snapshot
 * has changed since they were asked about (re-linked, or refreshed by Edit in REDCap, before the
 * answer came - `current` says what they have now, or null if they're gone), and anyone the answer
 * says nothing usable about.
 */
export function classifyLinkedRows<K>(
  people: LinkedPerson<K>[],
  rows: { [ref: string]: LinkedRow } | null | undefined,
  current: (key: K) => { ref: string, snapshot: string } | null
): LinkedRowsResult<K> {
  var result: LinkedRowsResult<K> = { answered: [], missing: [], otherRecord: [] };
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
    } else if (Array.isArray(row.answers)) {
      result.answered.push(person);
    }
  });
  return result;
}
