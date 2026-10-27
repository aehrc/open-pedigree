import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'pedigree/terminology/abstractTerminology';
import DisorderTerm from 'pedigree/terminology/disorderTerm';
import Legend from 'pedigree/view/legend';

// A terminology whose lookups never answer, so a term created without a name stays loading.
const terminology = {
  sanitizeID: (id) => id.replace(/:/g, '_C_'),
  desanitizeID: (id) => id.replace(/_C_/g, ':'),
  isValidID: (id) => /^\d+$/.test(id),
  lookupTerm: () => {},
  createTerm(id, name, callWhenReady) {
    return new DisorderTerm(id, name, this, callWhenReady);
  },
};

describe('Legend.addToCache', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('editor', { getWorkspace: () => ({ getWorkArea: () => document.body }) });
  });

  it('names a cached term that is still unknown, and shows the name in its legend entry', () => {
    const legend = new Legend('Disorders', terminology, 'disorder');
    expect(legend.getTerm('233873004').isUnknown()).toBe(true);
    legend.addCase('233873004', 'loading...', 1);
    legend.addToCache('233873004', 'Hypertrophic cardiomyopathy');
    expect(legend.getTerm('233873004').isUnknown()).toBe(false);
    expect(legend.getTerm('233873004').getName()).toBe('Hypertrophic cardiomyopathy');
    expect(document.querySelector('#legend-box .disorder-name').textContent).toBe('Hypertrophic cardiomyopathy');
  });

  it('keeps a known term as it is', () => {
    const legend = new Legend('Disorders', terminology, 'disorder');
    legend.addToCache('233873004', 'Hypertrophic cardiomyopathy');
    legend.addToCache('233873004', 'Something else');
    expect(legend.getTerm('233873004').getName()).toBe('Hypertrophic cardiomyopathy');
  });
});
