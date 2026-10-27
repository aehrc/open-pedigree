import { describe, it, expect, vi } from 'vitest';
// abstractTerminology first: it and the term classes import each other, and this order lets the
// term classes see AbstractTerm defined.
import 'pedigree/terminology/abstractTerminology';
import DisorderTerm from 'pedigree/terminology/disorderTerm';

const SNOMED = 'http://snomed.info/sct';

// A terminology whose lookups answer at once, with `names` (id => name; an id not in it fails, and
// one mapped to undefined or '' answers with that).
function terminology(names) {
  return {
    sanitizeID: (id) => id,
    desanitizeID: (id) => id,
    isValidID: () => true,
    lookupTerm: vi.fn((id, onSuccess, onError, onComplete) => {
      if (Object.prototype.hasOwnProperty.call(names, id)) {
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

  it('stays unknown when the lookup answers without a name', () => {
    for (const name of [undefined, '', '  ']) {
      const term = new DisorderTerm('233873004', null, terminology({ 233873004: name }), () => {});
      expect(term.isUnknown()).toBe(true);
      expect(term.getName()).toBe('233873004');
    }
  });

  it('is known without a lookup when created with its name', () => {
    const t = terminology({});
    const term = new DisorderTerm('233873004', 'Hypertrophic cardiomyopathy', t, () => {});
    expect(t.lookupTerm).not.toHaveBeenCalled();
    expect(term.isUnknown()).toBe(false);
  });
});
