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

  // See generalize-patient-provider-import design D5: a REDCap-shaped (or any other non-FHIR)
  // linkedPatientRef must not leak into the exported Patient reference - only a Patient/<id>
  // reference is honoured, everything else falls back to default reference generation.
  it('a Patient/-prefixed linkedPatientRef is used as the exported Patient id', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    baseGraph.properties[0].linkedPatientRef = 'Patient/42';
    const pedigree = { GG: baseGraph };

    const result = JSON.parse(GA4GHFHIRConverter.exportAsFHIR(pedigree, 'all', null, null));
    const patients = result.entry.map(e => e.resource).filter(r => r.resourceType === 'Patient');
    expect(patients.some(p => p.id === '42')).toBe(true);
  });

  it('a non-Patient/-prefixed linkedPatientRef (e.g. REDCap-shaped) is excluded from the exported reference', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(simpleGG);
    baseGraph.properties[0].linkedPatientRef = 'record:5/instance:2';
    const pedigree = { GG: baseGraph };

    const result = JSON.parse(GA4GHFHIRConverter.exportAsFHIR(pedigree, 'all', null, null));
    const patients = result.entry.map(e => e.resource).filter(r => r.resourceType === 'Patient');
    expect(patients.some(p => p.id === 'record:5/instance:2')).toBe(false);
    // Falls back to a generated urn:uuid: reference rather than the REDCap-shaped ref.
    expect(patients.some(p => /^urn:uuid:[0-9a-f-]{36}$/i.test(p.id))).toBe(true);
  });
});

describe('GA4GHFHIRConverter last name at birth', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  function roundTrip(properties) {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(structuredClone(simpleGG));
    Object.assign(baseGraph.properties[1], properties);
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null);
    return Object.values(GA4GHFHIRConverter.initFromFHIR(exported).properties).find((p) => p.gender === 'F');
  }

  it('reads it back, without taking it for the last name', () => {
    const jane = roundTrip({ lName: 'Smith', lNameAtB: 'Jones' });
    expect(jane.lName).toBe('Smith');
    expect(jane.lNameAtB).toBe('Jones');
  });

  it('takes a maiden name as one, but not an old name that has a period', () => {
    const baseGraph = PedigreeImport.initFromPhenotipsInternal(structuredClone(simpleGG));
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: baseGraph }, 'all', null, null));
    const janeOf = (names) => {
      const patient = exported.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given[0] === 'Jane');
      patient.name = names;
      return Object.values(GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported)).properties).find((p) => p.fName === 'Jane');
    };
    const current = { use: 'official', family: 'Smith', given: ['Jane'] };
    expect(janeOf([current, { use: 'maiden', family: 'Jones' }]).lNameAtB).toBe('Jones');
    // an earlier married name, from another FHIR source
    const earlier = janeOf([current, { use: 'old', family: 'Brown', period: { end: '2012' } }]);
    expect(earlier.lNameAtB).toBeUndefined();
    expect(earlier.lName).toBe('Smith');
  });

  it('reads it back when there is no last name', () => {
    const jane = roundTrip({ lNameAtB: 'Jones' });
    expect(jane.fName).toBe('Jane');
    expect(jane.lName).toBeUndefined();
    expect(jane.lNameAtB).toBe('Jones');
  });
});

describe('GA4GHFHIRConverter.initFromFHIR profile check', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  it('reads a Bundle only if its Composition lists the GA4GH pedigree profile itself', () => {
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(structuredClone(simpleGG)) }, 'all', null, null));
    expect(() => GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported))).not.toThrow();
    const profile = exported.entry[0].resource.meta.profile;
    exported.entry[0].resource.meta.profile = profile.map((p) => 'https://example.org/?' + p);
    expect(() => GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported))).toThrow(/not expected JSON format/);
  });
});
