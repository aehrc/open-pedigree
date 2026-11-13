import { describe, it, expect } from 'vitest';
import GeneLegend from 'pedigree/view/geneLegend';
import { LOADING_NAME } from 'pedigree/terminology/loadingName';

// GeneLegend.displayName on a stand-in legend (the real one needs the editor's workspace).
const displayName = (name, id) => GeneLegend.prototype.displayName.call({
  _cache: name === undefined ? {} : { [id]: { getName: () => name } },
  sanitizeID: (x) => x, desanitizeID: (x) => 'id:' + x,
}, id);

describe('GeneLegend.displayName', () => {
  it("is the gene's name once it has one", () => {
    expect(displayName('BRCA1', '1100')).toBe('BRCA1');
  });

  it("is the gene's ID while its name is loading, however the placeholder is padded", () => {
    expect(displayName(LOADING_NAME, '1100')).toBe('id:1100');
    expect(displayName(' ' + LOADING_NAME + ' ', '1100')).toBe('id:1100');
    expect(displayName(null, '1100')).toBe('id:1100');
    // (a gene not known yet is not looked up from here)
    expect(displayName(undefined, '1100')).toBe('id:1100');
  });
});
