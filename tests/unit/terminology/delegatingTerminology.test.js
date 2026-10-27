import { describe, it, expect, vi } from 'vitest';
import 'pedigree/terminology/abstractTerminology';
import DelegatingTerminology from 'pedigree/terminology/DelegatingTerminology';

describe('DelegatingTerminology', () => {
  it('gives the host the real code, not the ID the editor sanitised it to', () => {
    const lookupUrlFn = vi.fn(() => 'url');
    const lookupAjaxOptionsFn = vi.fn(() => ({}));
    const terminology = new DelegatingTerminology('phenotype', /^HP:/, 20, lookupUrlFn, null, lookupAjaxOptionsFn, null, null, null);
    const id = terminology.sanitizeID('HP:0001250');
    expect(id).toBe('HP_C_0001250');
    terminology.getLookupURL(id);
    terminology.getLookupAjaxOptions(id);
    expect(lookupUrlFn).toHaveBeenCalledWith('HP:0001250');
    expect(lookupAjaxOptionsFn).toHaveBeenCalledWith('HP:0001250');
  });

  it('leaves a code with nothing sanitised as it is', () => {
    const lookupUrlFn = vi.fn(() => 'url');
    new DelegatingTerminology('disorder', /\d+/, 20, lookupUrlFn).getLookupURL('233873004');
    expect(lookupUrlFn).toHaveBeenCalledWith('233873004');
  });
});
