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

  it('writes a disorder whose lookup failed as text', () => {
    const term = lookedUp('999', null);
    vi.stubGlobal('editor', { getDisorderLegend: () => ({ getTerm: () => term }) });
    expect(new DefaultFhirTerminologyHelper(SNOMED).getCodeableConceptFromDisorder('999')).toEqual({ text: '999' });
  });
});
