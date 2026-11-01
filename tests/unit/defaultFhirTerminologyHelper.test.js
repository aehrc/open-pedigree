import { describe, it, expect, vi, afterEach } from 'vitest';
// abstractTerminology first: it and the term classes import each other, and this order lets the
// term classes see AbstractTerm defined.
import 'pedigree/terminology/abstractTerminology';
import DisorderTerm from 'pedigree/terminology/disorderTerm';
import DefaultFhirTerminologyHelper from 'pedigree/DefaultFhirTerminologyHelper';

const SNOMED = 'http://snomed.info/sct';

function lookedUp(id, name) {
  const terminology = {
    sanitizeID: (x) => x,
    desanitizeID: (x) => x,
    isValidID: () => true,
    lookupTerm: (x, onSuccess, onError, onComplete) => {
      if (name) {
        onSuccess(x, name);
      } else {
        onError('not found');
      }
      onComplete();
    },
  };
  return new DisorderTerm(id, null, terminology, () => {});
}

describe('DefaultFhirTerminologyHelper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('codes a disorder whose name was looked up, rather than writing it as text', () => {
    const term = lookedUp('233873004', 'Hypertrophic cardiomyopathy');
    vi.stubGlobal('editor', { getDisorderLegend: () => ({ getTerm: () => term }) });
    const helper = new DefaultFhirTerminologyHelper(SNOMED);
    expect(helper.getCodeableConceptFromDisorder('233873004')).toEqual({
      coding: [{ system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' }],
    });
  });

  it('writes a looked-up gene as text when no gene code system is configured (the default)', () => {
    const term = lookedUp('7551', 'MYBPC3');
    vi.stubGlobal('editor', { getGeneLegend: () => ({ getTerm: () => term }) });
    expect(new DefaultFhirTerminologyHelper().getCodeableConceptFromGene('7551')).toEqual({ text: '7551' });
  });

  it('writes a disorder whose lookup failed as text', () => {
    const term = lookedUp('999', null);
    vi.stubGlobal('editor', { getDisorderLegend: () => ({ getTerm: () => term }) });
    expect(new DefaultFhirTerminologyHelper(SNOMED).getCodeableConceptFromDisorder('999')).toEqual({ text: '999' });
  });

  it('writes a term its terminology hasn\'t confirmed as text, even if it looks like a code', () => {
    const term = lookedUp('233873004', null);
    vi.stubGlobal('editor', { getDisorderLegend: () => ({ getTerm: () => term }) });
    expect(new DefaultFhirTerminologyHelper(SNOMED).getCodeableConceptFromDisorder('233873004')).toEqual({ text: '233873004' });
  });

  it('names the legend\'s term from a saved coding\'s display when reading it back', () => {
    const seedTermName = vi.fn();
    vi.stubGlobal('editor', { getDisorderLegend: () => ({ seedTermName }) });
    const code = new DefaultFhirTerminologyHelper(SNOMED).getDisorderFromCodeableConcept(
      { coding: [{ system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' }] }, false);
    expect(code).toBe('233873004');
    expect(seedTermName).toHaveBeenCalledWith('233873004', 'Hypertrophic cardiomyopathy');
  });

  it('reads a coding in another system by its code, not an older editor\'s "loading..." display', () => {
    vi.stubGlobal('editor', {});
    const helper = new DefaultFhirTerminologyHelper(SNOMED);
    expect(helper.getDisorderFromCodeableConcept(
      { coding: [{ system: 'http://www.omim.org', code: '615688', display: 'loading...' }] }, false)).toBe('615688');
    expect(helper.getDisorderFromCodeableConcept(
      { coding: [{ system: 'http://www.omim.org', code: '615688', display: ' loading... ' }] }, false)).toBe('615688');
    expect(helper.getDisorderFromCodeableConcept(
      { coding: [{ system: 'http://www.omim.org', code: '615688', display: 123 }] }, false)).toBe(123);
    expect(helper.getDisorderFromCodeableConcept(
      { coding: [{ system: 'http://www.omim.org', code: '615688', display: 'ADA2 deficiency' }] }, false)).toBe('ADA2 deficiency');
  });

  it('reads a coding even when there is no editor legend to seed', () => {
    vi.stubGlobal('editor', {});
    expect(new DefaultFhirTerminologyHelper(SNOMED).getDisorderFromCodeableConcept(
      { coding: [{ system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' }] }, false)).toBe('233873004');
  });
});

describe('DefaultFhirTerminologyHelper, a coding from another terminology', () => {
  const HPO = 'http://purl.obolibrary.org/obo/hp.owl';
  const OMIM = 'http://www.omim.org';
  const HCM = { coding: [{ system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' }] };
  const unknownTerm = { isUnknown: () => true, getName: (id) => id };
  const legends = { getTerm: () => unknownTerm };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function helper() {
    vi.stubGlobal('editor', { getDisorderLegend: () => legends, getPhenotypeLegend: () => legends, getGeneLegend: () => legends });
    return new DefaultFhirTerminologyHelper(OMIM, HPO, null);
  }

  it('is shown by its name and written back with its own coding', () => {
    const h = helper();
    expect(h.getDisorderFromCodeableConcept(HCM, false)).toBe('Hypertrophic cardiomyopathy');
    expect(h.getCodeableConceptFromDisorder('Hypertrophic cardiomyopathy')).toEqual(HCM);
  });

  it('is kept per legend: a phenotype with the same name is not given the disorder\'s coding', () => {
    const h = helper();
    h.getDisorderFromCodeableConcept(HCM, false);
    expect(h.getCodeableConceptFromPhenotype('Hypertrophic cardiomyopathy')).toEqual({ text: 'Hypertrophic cardiomyopathy' });
  });

  it('writes a copy, so changing what was written doesn\'t change what\'s kept', () => {
    const h = helper();
    const read = structuredClone(HCM);
    h.getDisorderFromCodeableConcept(read, false);
    read.coding[0].code = 'changed';
    h.getCodeableConceptFromDisorder('Hypertrophic cardiomyopathy').coding[0].code = 'changed too';
    expect(h.getCodeableConceptFromDisorder('Hypertrophic cardiomyopathy')).toEqual(HCM);
  });

  it('keeps nothing when it is only tried and not taken (returnNullOnNoMatch)', () => {
    const h = helper();
    expect(h.getPhenotypeFromCodeableConcept(HCM, true)).toBeNull();
    expect(h.getGeneFromCodeableConcept(HCM, true)).toBeNull();
    expect(h.getCodeableConceptFromPhenotype('Hypertrophic cardiomyopathy')).toEqual({ text: 'Hypertrophic cardiomyopathy' });
  });

  it('the same coding read twice is still kept', () => {
    const h = helper();
    h.getDisorderFromCodeableConcept(HCM, false);
    h.getDisorderFromCodeableConcept({ ...structuredClone(HCM), text: 'HCM' }, false);
    expect(h.getCodeableConceptFromDisorder('Hypertrophic cardiomyopathy')).toEqual(HCM);
  });

  it('two different codings shown by the same name are written as text', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = helper();
    h.getDisorderFromCodeableConcept(HCM, false);
    h.getDisorderFromCodeableConcept({ coding: [{ system: 'http://example.org/other', code: '1', display: 'Hypertrophic cardiomyopathy' }] }, false);
    expect(h.getCodeableConceptFromDisorder('Hypertrophic cardiomyopathy')).toEqual({ text: 'Hypertrophic cardiomyopathy' });
    // and stays so, whichever is read next
    h.getDisorderFromCodeableConcept(HCM, false);
    expect(h.getCodeableConceptFromDisorder('Hypertrophic cardiomyopathy')).toEqual({ text: 'Hypertrophic cardiomyopathy' });
  });

  it('with no display or text, is shown by its code and written back under its own system', () => {
    const h = helper();
    const bare = { coding: [{ system: SNOMED, code: '233873004' }] };
    expect(h.getDisorderFromCodeableConcept(bare, false)).toBe('233873004');
    expect(h.getCodeableConceptFromDisorder('233873004')).toEqual(bare);
  });

  it('a concept with only text is written as text, as before', () => {
    const h = helper();
    expect(h.getDisorderFromCodeableConcept({ text: 'Something' }, false)).toBe('Something');
    expect(h.getCodeableConceptFromDisorder('Something')).toEqual({ text: 'Something' });
  });

  it('a coding in the legend\'s own system is coded as before, not kept', () => {
    const h = helper();
    expect(h.getDisorderFromCodeableConcept({ coding: [{ system: OMIM, code: '615688', display: 'ADA2 deficiency' }] }, false)).toBe('615688');
    expect(h._foreignCodings.disorder.size).toBe(0);
  });
});
