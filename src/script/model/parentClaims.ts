// A child's parents, from the parent relationships an importer read for it: shared by the GA4GH
// and legacy (fhir_v1) importers.

/**
 * A child's two parents, from the parent relationships read for it (`claims`: { node, gender } where
 * gender is what the code says - 'F' for a mother, 'M' for a father, null for just a parent). A
 * mother goes in the mother slot and a father in the father slot; a parent coded only as a parent
 * goes where their own gender fits (those of known gender first), else in whichever slot is free -
 * so a slot says nothing about a parent's gender unless their code did. A parent coded more than
 * once is placed once (by a gendered code if there is one); any more than two are left out.
 */
export function placeParents(claims, genderOf) {
  const slots = { mother: null, father: null };
  const placed = new Set();
  const place = (claim, order) => {
    const slot = order.find((name) => slots[name] == null);
    if (slot && !placed.has(claim.node)) {
      slots[slot] = claim;
      placed.add(claim.node);
    }
  };
  const coded = claims.filter((c) => c.gender != null);
  // a mother or father in their own slot first, so a second of either can't push one out
  for (const claim of coded) {
    place(claim, [(claim.gender === 'M') ? 'father' : 'mother']);
  }
  for (const claim of coded) {
    place(claim, ['mother', 'father']);
  }
  const known = (c) => (genderOf(c.node) === 'M' || genderOf(c.node) === 'F') ? 1 : 0;
  for (const claim of claims.filter((c) => c.gender == null).sort((a, b) => known(b) - known(a))) {
    place(claim, (genderOf(claim.node) === 'M') ? ['father', 'mother'] : ['mother', 'father']);
  }
  return slots;
}

/**
 * Which of a child's parent claims to place, and whether the child is adopted
 * (pedigree-editor-fetus-and-adoption-fidelity D2). Claims may be `adoptive` (KIN:022, legacy ADOPT*)
 * or `step` (legacy STP*). Any adoptive claim: the adoptive claims only, and the child is adopted - the
 * editor shows an adopted child under the parents who adopted them, and exports it so. Else the
 * claims that aren't step-parents, if any (a step-parent is a parent's partner); else all of them.
 * `left` are the claims not placed.
 */
export function chooseParentClaims(claims) {
  const adoptive = claims.filter((c) => c.adoptive);
  if (adoptive.length > 0) {
    return { claims: adoptive, adopted: true, left: claims.filter((c) => !c.adoptive) };
  }
  const notStep = claims.filter((c) => !c.step);
  if (notStep.length > 0) {
    return { claims: notStep, adopted: false, left: claims.filter((c) => c.step) };
  }
  return { claims: claims, adopted: false, left: [] };
}

/** The fetal life statuses: a fetus is exported and read back as one (GA4GH Patient.deceasedString). */
export const FETAL_STATUSES = ['stillborn', 'miscarriage', 'aborted', 'unborn'];

/**
 * The claims for the parents placeParents placed - every code each of them has, so each is checked
 * against their gender - and how many other claimed parents it didn't place (more than two).
 */
export function placedClaims(chosen, slots) {
  const nodes = new Set([slots.mother, slots.father].filter(Boolean).map((c) => c.node));
  return {
    checked: chosen.claims.filter((c) => nodes.has(c.node)),
    dropped: new Set(chosen.claims.filter((c) => !nodes.has(c.node)).map((c) => c.node)).size,
  };
}

/** Why a parent's code contradicts their gender, or null if it doesn't (see placeParents). */
export function parentGenderConflict(claim, gender, reference) {
  if (claim.gender === 'F' && gender === 'M') {
    return 'Unable to import pedigree: a person declared as male is also declared as being a mother (' + reference + ')';
  }
  if (claim.gender === 'M' && gender === 'F') {
    return 'Unable to import pedigree: a person declared as female is also declared as being a father (' + reference + ')';
  }
  return null;
}

/**
 * A console warning for the claimed parents left out - by chooseParentClaims, and `dropped` more
 * than two that placeParents didn't place - counted by person (a parent placed with another code
 * left out isn't left out), or null if none were.
 */
export function leftOutWarning(chosen, dropped = 0) {
  const chosenNodes = new Set(chosen.claims.map((c) => c.node));
  const count = new Set(chosen.left.filter((c) => !chosenNodes.has(c.node)).map((c) => c.node)).size + dropped;
  if (count === 0) {
    return null;
  }
  return 'A child\'s ' + count + ' other parent(s) were left out: the editor shows two parents, adoptive ones'
    + ' first, and step-parents only when there are no others';
}
