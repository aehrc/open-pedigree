import { describe, it, expect, vi, beforeEach } from 'vitest';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import PedigreeImport from 'pedigree/model/import';
import simpleGG from '../fixtures/simple-pedigree-gg.json';

const mockTerminologyHelper = {
  getCodeableConceptFromDisorder: vi.fn(() => ({})),
  getCodeableConceptFromPhenotype: vi.fn(() => ({})),
  getCodeableConceptFromGene: vi.fn(() => ({})),
};

const mockEditor = {
  getFhirTerminologyHelper: () => mockTerminologyHelper,
  getDisorderLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
  getGeneLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
  getPhenotypeLegend: () => ({ getTerm: (id) => ({ getName: () => id }) }),
};

describe('GA4GHFHIRConverter.exportAsFHIR', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  it('produces a valid JSON string for a simple pedigree', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    const pedigree = { GG: baseGraph };

    const result = GA4GHFHIRConverter.exportAsFHIR(pedigree, 'all', null, null);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('output is a FHIR Bundle', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    const pedigree = { GG: baseGraph };

    const result = JSON.parse(GA4GHFHIRConverter.exportAsFHIR(pedigree, 'all', null, null));
    expect(result.resourceType).toBe('Bundle');
  });

  it('Bundle entries include a Composition and Patient resources', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    const pedigree = { GG: baseGraph };

    const result = JSON.parse(GA4GHFHIRConverter.exportAsFHIR(pedigree, 'all', null, null));
    const resources = result.entry.map(e => e.resource);
    const composition = resources.find(r => r.resourceType === 'Composition');
    const patients = resources.filter(r => r.resourceType === 'Patient');
    expect(composition).toBeDefined();
    expect(patients.length).toBe(3); // John, Jane, child
  });
});
