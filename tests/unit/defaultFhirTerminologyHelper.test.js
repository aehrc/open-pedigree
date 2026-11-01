import { describe, it, expect, vi, afterEach } from 'vitest';
// abstractTerminology first: it and the term classes import each other, and this order lets the
// term classes see AbstractTerm defined.
import AbstractTerminology from 'pedigree/terminology/abstractTerminology';
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function helper() {
    vi.stubGlobal('editor', {});
    return new DefaultFhirTerminologyHelper(OMIM, HPO, null);
  }

  it('is shown by its name, and is a coding to keep', () => {
    const h = helper();
    expect(h.getDisorderFromCodeableConcept(HCM, false)).toBe('Hypertrophic cardiomyopathy');
    expect(h.codingToKeep('disorder', HCM)).toEqual(HCM);
  });

  it('is kept as a copy', () => {
    const read = structuredClone(HCM);
    const kept = helper().codingToKeep('disorder', read);
    read.coding[0].code = 'changed';
    expect(kept).toEqual(HCM);
  });

  it('isn\'t kept when it has a coding in the legend\'s own system, or no code at all', () => {
    const h = helper();
    expect(h.codingToKeep('disorder', { coding: [...HCM.coding, { system: OMIM, code: '615688' }] })).toBeNull();
    expect(h.codingToKeep('phenotype', { coding: [{ system: HPO, code: 'HP:0001279' }] })).toBeNull();
    expect(h.codingToKeep('disorder', { text: 'Something' })).toBeNull();
    expect(h.codingToKeep('disorder', { coding: [{ display: 'No code' }] })).toBeNull();
  });

  it('is kept for a legend with no code system (genes by default)', () => {
    const gene = { coding: [{ system: 'http://www.genenames.org', code: '7551', display: 'MYBPC3' }] };
    expect(helper().codingToKeep('gene', gene)).toEqual(gene);
  });

  it('doesn\'t keep an older editor\'s "loading..." display', () => {
    const h = helper();
    const placeholder = { coding: [{ system: SNOMED, code: '233873004', display: 'loading...' }] };
    expect(h.getDisorderFromCodeableConcept(placeholder, false)).toBe('233873004');
    expect(h.codingToKeep('disorder', placeholder)).toEqual({ coding: [{ system: SNOMED, code: '233873004' }] });
  });

  it('with no display or text, is shown by its code and system, so it isn\'t taken for a code of the legend\'s own', () => {
    const h = helper();
    expect(h.getDisorderFromCodeableConcept({ coding: [{ system: SNOMED, code: '233873004' }] }, false)).toBe('233873004 - ' + SNOMED);
    expect(h.getDisorderFromCodeableConcept({ coding: [{ code: '233873004' }] }, false)).toBe('233873004');
  });

  it('a code shown with its system comes back from the legend\'s IDs as it was', () => {
    const terminology = new AbstractTerminology();
    const id = helper().getDisorderFromCodeableConcept({ coding: [{ system: SNOMED, code: '91175000' }] }, false);
    expect(terminology.desanitizeID(terminology.sanitizeID(id))).toBe(id);
  });

  it('a concept with only text is read by it, as before', () => {
    expect(helper().getDisorderFromCodeableConcept({ text: 'Something' }, false)).toBe('Something');
  });
});
