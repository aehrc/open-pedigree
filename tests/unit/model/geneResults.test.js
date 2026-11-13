import { describe, it, expect } from 'vitest';
import { geneDisplayName } from 'pedigree/model/geneResults';
import { LOADING_NAME } from 'pedigree/terminology/loadingName';

describe('geneDisplayName', () => {
  const legend = (name) => ({ getTerm: () => ({ getName: () => name }), desanitizeID: (id) => 'id:' + id });

  it("is the gene's name once it has one", () => {
    expect(geneDisplayName(legend('BRCA1'), '1100')).toBe('BRCA1');
  });

  it("is the gene's ID while its name is loading, however the placeholder is padded", () => {
    expect(geneDisplayName(legend(LOADING_NAME), '1100')).toBe('id:1100');
    expect(geneDisplayName(legend(' ' + LOADING_NAME + ' '), '1100')).toBe('id:1100');
    expect(geneDisplayName(legend(null), '1100')).toBe('id:1100');
  });
});
