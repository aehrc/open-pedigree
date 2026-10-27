import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'pedigree/terminology/abstractTerminology';
import DisorderTerm from 'pedigree/terminology/disorderTerm';
import Legend from 'pedigree/view/legend';

// A terminology whose lookups never answer, so a term created without a name stays loading.
const terminology = {
  sanitizeID: (id) => id.replace(/:/g, '_C_'),
  desanitizeID: (id) => id.replace(/_C_/g, ':'),
  isValidID: () => true,
  lookupTerm: () => {},
  createTerm(id, name, callWhenReady) {
    return new DisorderTerm(id, name, this, callWhenReady);
  },
};

describe('Legend', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('editor', { getWorkspace: () => ({ getWorkArea: () => document.body }) });
  });

  describe('seedTermName', () => {
    it('names a cached term that is still unknown, and shows the name in its legend entry', () => {
      const legend = new Legend('Disorders', terminology, 'disorder');
      const term = legend.getTerm('233873004');
      expect(term.isUnknown()).toBe(true);
      legend.addCase('233873004', 'loading...', 1);
      legend.seedTermName('233873004', ' Hypertrophic cardiomyopathy ');
      expect(legend.getTerm('233873004')).toBe(term);
      expect(term.isUnknown()).toBe(false);
      expect(term.getName()).toBe('Hypertrophic cardiomyopathy');
      expect(document.querySelector('#legend-box .disorder-name').textContent).toBe('Hypertrophic cardiomyopathy');
    });

    it('caches a term not seen yet under its name, with no lookup', () => {
      const legend = new Legend('Disorders', terminology, 'disorder');
      legend.seedTermName('HP:0001250', 'Seizure');
      expect(legend.getTerm('HP:0001250').isUnknown()).toBe(false);
      expect(legend.getTerm('HP:0001250').getName()).toBe('Seizure');
    });

    it('ignores a blank display, or one that is just the code', () => {
      const legend = new Legend('Disorders', terminology, 'disorder');
      legend.getTerm('233873004');
      for (const display of ['', '  ', '233873004', undefined]) {
        legend.seedTermName('233873004', display);
        expect(legend.getTerm('233873004').isUnknown()).toBe(true);
      }
    });

    it('leaves a confirmed term\'s name alone', () => {
      const legend = new Legend('Disorders', terminology, 'disorder');
      legend.addToCache('233873004', 'Hypertrophic cardiomyopathy');
      legend.seedTermName('233873004', 'Something else');
      expect(legend.getTerm('233873004').getName()).toBe('Hypertrophic cardiomyopathy');
    });
  });

  it('addToCache still leaves an unknown term unknown (e.g. the node menu re-adding "loading...")', () => {
    const legend = new Legend('Disorders', terminology, 'disorder');
    legend.getTerm('233873004');
    legend.addToCache('233873004', 'loading...');
    expect(legend.getTerm('233873004').isUnknown()).toBe(true);
  });
});
