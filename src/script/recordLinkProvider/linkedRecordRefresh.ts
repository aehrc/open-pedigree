/**
 * Pure refresh logic for a linked record's answers (linked-record-round-trip).
 *
 * A refresh applies the linked record's *changes*: it compares what the record sends now with
 * what it sent at the last refresh (the node's snapshot), not with the node's current values.
 * open-pedigree's setters often store something other than what they're given (gestation age
 * reads back null for a live-born person, gender can be rejected by partnership rules, legend
 * IDs are sanitised, setting one field changes others), so comparing against the node would
 * never settle. Rules, per linkId:
 * - unchanged since the last refresh: nothing happens;
 * - changed to a non-empty value: set it;
 * - emptied: clear it - but only if the node still holds the record's last value, so a value
 *   the user set in the diagram (or one open-pedigree rejected) is never wiped;
 * - legend lists: remove the entries the record dropped, add the ones it added, and keep
 *   entries that never came from the record.
 *
 * No editor or DOM access: the caller injects setter resolution and node lookups, so this is
 * unit-testable on its own. `Pedigree._dispatchLinkedRecordRefresh()` wires it to a real node.
 */

// linkId -> the last non-empty value the linked record sent for it.
export type LinkedRecordSnapshot = Record<string, any>;

export interface LinkedRecordRefreshInput {
  answers: { linkId: string, value: any }[];
  // linkId -> the Person setter name the answer goes to (Pedigree._resolveQuestionnaireSetter).
  resolveSetter: (linkId: string) => string;
  // Whether linkId is a legend list (reserved disorders/genes/phenotypes, or a custom legend item).
  isLegend: (linkId: string) => boolean;
  // The node-side key of an incoming legend entry (e.g. its sanitised ID), and of an entry as
  // the node stores it or as legendSetterEntry() produces it - so the two are comparable.
  incomingLegendKey: (linkId: string, entry: any) => string;
  storedLegendKey: (linkId: string, entry: any) => string;
  // The value to hand the setter for a newly added incoming legend entry.
  legendSetterEntry: (linkId: string, entry: any) => any;
  // setter name -> the node's current value, via the matching getter.
  current: (setter: string) => any;
  snapshot: LinkedRecordSnapshot;
}

export interface LinkedRecordRefreshResult {
  // Setter name -> new value, clears first.
  properties: Record<string, any>;
  snapshot: LinkedRecordSnapshot;
  valuesChanged: boolean;
}

// The value each mapped setter accepts as "unset" (design D5). Generic questionnaire answers
// clear with null (Person.setQuestionnaireAnswer deletes the answer).
export const CLEAR_VALUES: Record<string, any> = {
  setGender: 'U',
  setLifeStatus: 'alive',
  setFirstName: '',
  setLastName: '',
  setExternalID: '',
  setComments: '',
  setBirthDate: '',
  setDeathDate: '',
  setCarrierStatus: '',
  setGestationAge: '',
  setChildlessStatus: null,
  setAdopted: false,
  setEvaluated: false,
  setMonozygotic: false,
  setLostContact: false,
};

const DATE_SETTERS = ['setBirthDate', 'setDeathDate'];

export function isEmptyAnswer(value: any): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

export function clearValueFor(setter: string): any {
  return Object.prototype.hasOwnProperty.call(CLEAR_VALUES, setter) ? CLEAR_VALUES[setter] : null;
}

function normalise(setter: string, value: any): any {
  if (DATE_SETTERS.indexOf(setter) !== -1) {
    if (!value) {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? String(value) : date.toDateString();
  }
  if (setter === 'setGestationAge') {
    return (value === null || value === undefined || value === '' || isNaN(parseInt(value, 10))) ? '' : parseInt(value, 10);
  }
  if (value === undefined) {
    return null;
  }
  return value;
}

// Whether a node value and a record value are the same, as far as a setter is concerned.
export function sameValue(setter: string, a: any, b: any): boolean {
  const x = normalise(setter, a);
  const y = normalise(setter, b);
  if (x === y) {
    return true;
  }
  if (typeof x === 'object' && typeof y === 'object' && x !== null && y !== null) {
    return JSON.stringify(x) === JSON.stringify(y);
  }
  return false;
}

function sameJson(a: any, b: any): boolean {
  return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

export function computeLinkedRecordRefresh(input: LinkedRecordRefreshInput): LinkedRecordRefreshResult {
  const clears: Record<string, any> = {};
  const sets: Record<string, any> = {};
  const last = input.snapshot || {};
  const snapshot: LinkedRecordSnapshot = {};
  Object.keys(last).forEach((linkId) => {
    snapshot[linkId] = last[linkId];
  });

  for (const answer of (input.answers || [])) {
    const linkId = answer.linkId;
    const setter = input.resolveSetter(linkId);
    const hadLast = Object.prototype.hasOwnProperty.call(last, linkId);

    if (input.isLegend(linkId)) {
      const incoming: any[] = Array.isArray(answer.value) ? answer.value : [];
      const previous: any[] = hadLast && Array.isArray(last[linkId]) ? last[linkId] : [];
      const incomingKeys = incoming.map((e) => input.incomingLegendKey(linkId, e));
      const previousKeys = previous.map((e) => input.incomingLegendKey(linkId, e));
      if (incoming.length > 0) {
        snapshot[linkId] = incoming;
      } else {
        delete snapshot[linkId];
      }
      if (sameJson(incomingKeys, previousKeys)) {
        continue;
      }
      const currentEntries: any[] = (input.current(setter) || []).slice(0);
      const next = currentEntries.filter((e) => {
        const key = input.storedLegendKey(linkId, e);
        return previousKeys.indexOf(key) === -1 || incomingKeys.indexOf(key) !== -1;
      });
      incoming.forEach((e, i) => {
        if (!next.some((n) => input.storedLegendKey(linkId, n) === incomingKeys[i])) {
          next.push(input.legendSetterEntry(linkId, e));
        }
      });
      const nextKeys = next.map((e) => input.storedLegendKey(linkId, e));
      const currentKeys = currentEntries.map((e) => input.storedLegendKey(linkId, e));
      if (!sameJson(nextKeys, currentKeys)) {
        sets[setter] = next;
      }
      continue;
    }

    if (isEmptyAnswer(answer.value)) {
      delete snapshot[linkId];
      // Only clear the record's own value: if the node now holds something else, it came from
      // the diagram (or open-pedigree rejected the record's value) - leave it.
      if (hadLast && sameValue(setter, input.current(setter), last[linkId])) {
        const cleared = clearValueFor(setter);
        if (!sameValue(setter, input.current(setter), cleared)) {
          clears[setter] = cleared;
        }
      }
      continue;
    }

    snapshot[linkId] = answer.value;
    if (!hadLast || !sameJson(last[linkId], answer.value)) {
      sets[setter] = answer.value;
    }
  }

  const properties: Record<string, any> = {};
  Object.keys(clears).forEach((setter) => {
    properties[setter] = clears[setter];
  });
  Object.keys(sets).forEach((setter) => {
    properties[setter] = sets[setter];
  });

  return {
    properties: properties,
    snapshot: snapshot,
    valuesChanged: Object.keys(properties).length > 0,
  };
}
