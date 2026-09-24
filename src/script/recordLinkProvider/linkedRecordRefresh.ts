/**
 * Pure refresh logic for a linked record's answers (linked-record-round-trip): given the answers
 * a record-link provider sends to `onDone`/`onCreated`, the node's current values and what the
 * record supplied last time, work out the node property changes that make the node mirror the
 * record - without ever wiping a value the record didn't supply (i.e. one entered in the diagram).
 *
 * No editor or DOM access: the caller injects setter resolution and current-value lookup, so this
 * is unit-testable on its own. `Pedigree._dispatchLinkedRecordRefresh()` wires it to a real node.
 */

export type LinkedRecordSupplied = Record<string, true | string[]>;

export interface LinkedRecordRefreshInput {
  answers: { linkId: string, value: any }[];
  // linkId -> the Person setter name the answer goes to (Pedigree._resolveQuestionnaireSetter).
  resolveSetter: (linkId: string) => string;
  isLegendTarget: (linkId: string) => boolean;
  // setter name -> the node's current value, via the matching getter.
  current: (setter: string) => any;
  supplied: LinkedRecordSupplied;
}

export interface LinkedRecordRefreshResult {
  // Setter name -> new value, in the order they must be applied (clears, then sets).
  properties: Record<string, any>;
  supplied: LinkedRecordSupplied;
  // True if any node value changes (a supplied-set-only change is not a visible change).
  valuesChanged: boolean;
}

// The value each mapped setter accepts as "unset" (design D5). Generic questionnaire answers
// clear with null (Person.setQuestionnaireAnswer deletes the answer); legend targets are
// reconciled as lists instead.
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

// Set before other sets so e.g. setBirthDate's "birth before death" guard never compares a new
// birth date against a stale death date (design D7).
const SET_ORDER = ['setLifeStatus', 'setBirthDate', 'setDeathDate'];

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

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function computeLinkedRecordRefresh(input: LinkedRecordRefreshInput): LinkedRecordRefreshResult {
  const clears: Record<string, any> = {};
  const sets: Record<string, any> = {};
  const supplied: LinkedRecordSupplied = {};
  // Keep what was supplied for linkIds this refresh doesn't mention - a provider sending a
  // partial answer bag says nothing about the others.
  Object.keys(input.supplied || {}).forEach((linkId) => {
    supplied[linkId] = input.supplied[linkId];
  });

  for (const answer of (input.answers || [])) {
    const linkId = answer.linkId;
    const setter = input.resolveSetter(linkId);
    const previouslySupplied = input.supplied ? input.supplied[linkId] : undefined;

    if (input.isLegendTarget(linkId)) {
      const incomingIds: string[] = (Array.isArray(answer.value) ? answer.value : [])
        .map((v: any) => (v && typeof v === 'object') ? v.id : v)
        .filter((id: any) => id !== undefined && id !== null && id !== '');
      const previousIds: string[] = Array.isArray(previouslySupplied) ? previouslySupplied : [];
      const currentIds: string[] = (input.current(setter) || []).slice(0);
      // Drop entries the record supplied before but no longer has; keep diagram-entered ones.
      const next = currentIds.filter((id) => previousIds.indexOf(id) === -1 || incomingIds.indexOf(id) !== -1);
      incomingIds.forEach((id) => {
        if (next.indexOf(id) === -1) {
          next.push(id);
        }
      });
      if (incomingIds.length > 0) {
        supplied[linkId] = incomingIds;
      } else {
        delete supplied[linkId];
      }
      if (!sameIdSet(next, currentIds)) {
        sets[setter] = next;
      }
      continue;
    }

    if (isEmptyAnswer(answer.value)) {
      // Only clear what the record supplied; a value it never supplied came from the diagram.
      if (previouslySupplied === true) {
        const cleared = clearValueFor(setter);
        if (!sameValue(setter, input.current(setter), cleared)) {
          clears[setter] = cleared;
        }
      }
      delete supplied[linkId];
      continue;
    }

    supplied[linkId] = true;
    if (!sameValue(setter, input.current(setter), answer.value)) {
      sets[setter] = answer.value;
    }
  }

  const properties: Record<string, any> = {};
  Object.keys(clears).forEach((setter) => {
    properties[setter] = clears[setter];
  });
  SET_ORDER.forEach((setter) => {
    if (Object.prototype.hasOwnProperty.call(sets, setter)) {
      properties[setter] = sets[setter];
    }
  });
  Object.keys(sets).forEach((setter) => {
    if (SET_ORDER.indexOf(setter) === -1) {
      properties[setter] = sets[setter];
    }
  });

  return {
    properties: properties,
    supplied: supplied,
    valuesChanged: Object.keys(properties).length > 0,
  };
}
