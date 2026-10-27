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
