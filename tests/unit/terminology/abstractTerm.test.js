import { describe, it, expect, vi, afterEach } from 'vitest';
// abstractTerminology first: it and the term classes import each other, and this order lets the
// term classes see AbstractTerm defined.
import 'pedigree/terminology/abstractTerminology';
import DisorderTerm from 'pedigree/terminology/disorderTerm';
import DefaultFhirTerminologyHelper from 'pedigree/DefaultFhirTerminologyHelper';

const SNOMED = 'http://snomed.info/sct';

// A terminology whose lookups answer at once, with `names` (id => name; a missing id fails).
function terminology(names) {
  return {
    sanitizeID: (id) => id,
    desanitizeID: (id) => id,
    isValidID: () => true,
    lookupTerm: vi.fn((id, onSuccess, onError, onComplete) => {
      if (names[id]) {
        onSuccess(id, names[id]);
      } else {
        onError('not found');
      }
      onComplete();
    }),
  };
}

describe('AbstractTerm', () => {
  it('is known once a looked-up name has loaded', () => {
    const term = new DisorderTerm('233873004', null, terminology({ 233873004: 'Hypertrophic cardiomyopathy' }), () => {});
    expect(term.getName()).toBe('Hypertrophic cardiomyopathy');
    expect(term.isUnknown()).toBe(false);
  });

  it('stays unknown, named by its ID, when the lookup fails', () => {
    const term = new DisorderTerm('999', null, terminology({}), () => {});
    expect(term.getName()).toBe('999');
    expect(term.isUnknown()).toBe(true);
  });

  it('is known without a lookup when created with its name', () => {
    const t = terminology({});
    const term = new DisorderTerm('233873004', 'Hypertrophic cardiomyopathy', t, () => {});
    expect(t.lookupTerm).not.toHaveBeenCalled();
    expect(term.isUnknown()).toBe(false);
  });
});

describe('DefaultFhirTerminologyHelper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('codes a disorder whose name was looked up, rather than writing it as text', () => {
    const term = new DisorderTerm('233873004', null, terminology({ 233873004: 'Hypertrophic cardiomyopathy' }), () => {});
    vi.stubGlobal('editor', { getDisorderLegend: () => ({ getTerm: () => term }) });
    const helper = new DefaultFhirTerminologyHelper(SNOMED);
    expect(helper.getCodeableConceptFromDisorder('233873004')).toEqual({
      coding: [{ system: SNOMED, code: '233873004', display: 'Hypertrophic cardiomyopathy' }],
    });
  });
});
