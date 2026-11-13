/**
 * A result for a gene in a person's Genes list (open-pedigree #6): what testing found. Saved as the
 * property `geneResults`, `{ <gene>: <code> }`, keyed by the same gene IDs as `candidateGenes`; a
 * gene with no entry is not tested.
 */

// 'positive': a variant was found, its zygosity unknown (e.g. a family's report, or another tool's
// record without one). Heteroplasmic and homoplasmic are mitochondrial genes' states: with them,
// every allelic state LOINC lists (53034-5) is kept.
export const GENE_RESULT_CODES = ['heterozygous', 'homozygous', 'hemizygous', 'heteroplasmic', 'homoplasmic', 'positive', 'negative'];

// Drawn under the symbol after the gene (U+2212 minus, as typeset pedigrees use).
export const GENE_RESULT_MARKERS: { [code: string]: string } = {
  heterozygous: '+/−',
  homozygous: '+/+',
  hemizygous: '+/0',
  heteroplasmic: '+ (heteroplasmic)',
  homoplasmic: '+ (homoplasmic)',
  positive: '+',
  negative: '−/−',
};

// The result drop-down's choices beside each gene, in order ('' = not tested): the specific
// findings first, so a key press from Not tested lands on one.
export const GENE_RESULT_CHOICES: Array<{ code: string; label: string }> = [
  { code: '', label: 'Not tested' },
  { code: 'heterozygous', label: 'Heterozygous (+/−)' },
  { code: 'homozygous', label: 'Homozygous (+/+)' },
  { code: 'hemizygous', label: 'Hemizygous (+/0)' },
  { code: 'heteroplasmic', label: 'Heteroplasmic (mitochondrial)' },
  { code: 'homoplasmic', label: 'Homoplasmic (mitochondrial)' },
  { code: 'positive', label: 'Positive, zygosity unknown (+)' },
  { code: 'negative', label: 'Negative (−/−)' },
];

export function isGeneResultCode(code: any): boolean {
  return typeof code === 'string' && GENE_RESULT_CODES.indexOf(code) !== -1;
}

// In GA4GH FHIR: components on the gene's Observation (HL7 Genomics Reporting's LOINC codes).
const LOINC = 'http://loinc.org';
export const VARIANT_ASSESSMENT = { system: LOINC, code: '69548-6', display: 'Genetic variant assessment' };
export const ALLELIC_STATE = { system: LOINC, code: '53034-5', display: 'Allelic state' };
const PRESENT = { system: LOINC, code: 'LA9633-4', display: 'Present' };
const ABSENT = { system: LOINC, code: 'LA9634-2', display: 'Absent' };
const ALLELIC_STATES: { [code: string]: any } = {
  heterozygous: { system: LOINC, code: 'LA6706-1', display: 'Heterozygous' },
  homozygous: { system: LOINC, code: 'LA6705-3', display: 'Homozygous' },
  hemizygous: { system: LOINC, code: 'LA6707-9', display: 'Hemizygous' },
  heteroplasmic: { system: LOINC, code: 'LA6703-8', display: 'Heteroplasmic' },
  homoplasmic: { system: LOINC, code: 'LA6704-6', display: 'Homoplasmic' },
};

// The components for a result, or [] for none: Present or Absent, and the allelic state when known.
export function geneResultComponents(code: any): any[] {
  if (!isGeneResultCode(code)) {
    return [];
  }
  const assessment = { code: { coding: [VARIANT_ASSESSMENT] }, valueCodeableConcept: { coding: [code === 'negative' ? ABSENT : PRESENT] } };
  const state = ALLELIC_STATES[code];
  return state ? [assessment, { code: { coding: [ALLELIC_STATE] }, valueCodeableConcept: { coding: [state] } }] : [assessment];
}

const codingOf = (component: any, wanted: any): any => {
  const codings = (component && component.code && component.code.coding) || [];
  return codings.some((c: any) => c && c.system === wanted.system && c.code === wanted.code);
};
const valueCode = (component: any): any => {
  const codings = (component && component.valueCodeableConcept && component.valueCodeableConcept.coding) || [];
  const loinc = codings.find((c: any) => c && c.system === LOINC);
  return loinc ? loinc.code : null;
};

// The result an Observation's components say, or null for none (or one that can't be read). A
// variant found with no allelic state is 'positive'; so is one whose state can't be read (coded
// outside LOINC, or text only), so that it was found is never lost: `unread` is told what that state
// was.
export function geneResultFromComponents(components: any, unread?: (state: string) => void): string | null {
  if (!Array.isArray(components)) {
    return null;
  }
  const assessment = components.find((c: any) => codingOf(c, VARIANT_ASSESSMENT));
  if (!assessment) {
    return null;
  }
  const found = valueCode(assessment);
  if (found === ABSENT.code) {
    return 'negative';
  }
  if (found !== PRESENT.code) {
    return null;
  }
  const stateComponent = components.find((c: any) => codingOf(c, ALLELIC_STATE));
  if (!stateComponent) {
    return 'positive';
  }
  const state = valueCode(stateComponent);
  for (const code in ALLELIC_STATES) {
    if (ALLELIC_STATES[code].code === state) {
      return code;
    }
  }
  if (unread) {
    unread(describeValue(stateComponent));
  }
  return 'positive';
}

// What a component's value says, for a message: its codings (system|code display), or its text.
function describeValue(component: any): string {
  const value = (component && component.valueCodeableConcept) || {};
  const codings = (value.coding || []).map((c: any) => (c.system || '') + '|' + (c.code || '') + (c.display ? ' ' + c.display : ''));
  return codings.length ? codings.join(', ') : (value.text ? '"' + value.text + '"' : 'no value');
}
