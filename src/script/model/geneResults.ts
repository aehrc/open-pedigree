/**
 * A result for a gene in a person's Genes list (open-pedigree #6): what testing found. Saved as the
 * property `geneResults`, `{ <gene>: <code> }`, keyed by the same gene IDs as `candidateGenes`; a
 * gene with no entry is not tested.
 */

export const GENE_RESULT_CODES = ['heterozygous', 'homozygous', 'hemizygous', 'negative'];

// Drawn under the symbol after the gene (U+2212 minus, as typeset pedigrees use).
export const GENE_RESULT_MARKERS: { [code: string]: string } = {
  heterozygous: '+/−',
  homozygous: '+/+',
  hemizygous: '+/0',
  negative: '−/−',
};

// The result drop-down's choices beside each gene, in order ('' = not tested).
export const GENE_RESULT_CHOICES: Array<{ code: string; label: string }> = [
  { code: '', label: 'Not tested' },
  { code: 'heterozygous', label: 'Heterozygous (+/−)' },
  { code: 'homozygous', label: 'Homozygous (+/+)' },
  { code: 'hemizygous', label: 'Hemizygous (+/0)' },
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
};

// The components for a result, or [] for none.
export function geneResultComponents(code: any): any[] {
  if (!isGeneResultCode(code)) {
    return [];
  }
  if (code === 'negative') {
    return [{ code: { coding: [VARIANT_ASSESSMENT] }, valueCodeableConcept: { coding: [ABSENT] } }];
  }
  return [
    { code: { coding: [VARIANT_ASSESSMENT] }, valueCodeableConcept: { coding: [PRESENT] } },
    { code: { coding: [ALLELIC_STATE] }, valueCodeableConcept: { coding: [ALLELIC_STATES[code]] } },
  ];
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

// The result an Observation's components say, or null for none (or one that can't be read).
export function geneResultFromComponents(components: any): string | null {
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
  const state = valueCode(components.find((c: any) => codingOf(c, ALLELIC_STATE)));
  for (const code in ALLELIC_STATES) {
    if (ALLELIC_STATES[code].code === state) {
      return code;
    }
  }
  return null;
}
