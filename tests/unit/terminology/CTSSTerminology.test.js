import { describe, it, expect } from 'vitest';
import CTSSTerminology from 'pedigree/terminology/CTSSTerminology';

describe('CTSSTerminology lookup URL', () => {
  const terminology = new CTSSTerminology('phenotype', /.*/, 20, 'https://ctss.example/hpo', 'id', 'name');

  it('escapes every colon in the ID for the Solr query, not just the first', () => {
    const url = terminology.getLookupURL(terminology.sanitizeID('http://purl.obolibrary.org/obo/HP:0001250'));
    expect(decodeURI(url)).toBe('https://ctss.example/hpo?q=id%3Ahttp\\://purl.obolibrary.org/obo/HP\\:0001250');
  });

  it('escapes a single-colon ID as before', () => {
    expect(decodeURI(terminology.getLookupURL('HP_C_0001250'))).toBe('https://ctss.example/hpo?q=id%3AHP\\:0001250');
  });
});
