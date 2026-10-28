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

describe('GA4GHFHIRConverter parent relationships', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  // The fixture's father, John, is node 0: a parent with id 0 was once taken for no parent at all,
  // and exported as a biological parent (KIN:003) rather than a father.
  // "<relative> <code> <person>" for each relationship in an export, by first name ('?' for none).
  function relationships(exported) {
    const resources = JSON.parse(exported).entry;
    const names = {};
    for (const { fullUrl, resource } of resources) {
      if (resource.resourceType === 'Patient') {
        const name = (resource.name && resource.name[0] && resource.name[0].given && resource.name[0].given[0]) || '?';
        names[fullUrl] = name;
        names[`Patient/${resource.id}`] = name;
        names[`#${resource.id}`] = name;
        names[resource.id] = name;
      }
    }
    return resources.map(({ resource }) => resource)
      .filter((r) => r.resourceType === 'FamilyMemberHistory' && r.relationship)
      .map((r) => `${names[r.extension[0].valueReference.reference]} ${r.relationship.coding[0].code} ${names[r.patient.reference]}`)
      .sort();
  }

  it('codes each parent by gender, including a parent that is node 0', () => {
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(structuredClone(simpleGG)) }, 'all', null, null);
    const parentCodes = relationships(exported).filter((r) => !r.includes('KIN:026'));
    expect(parentCodes).toEqual(expect.arrayContaining(['Jane KIN:027 ?', 'John KIN:028 ?']));
    expect(parentCodes.join()).not.toContain('KIN:003');
  });

  // simpleGG with the parents' genders set: John is node 0, Jane node 1.
  function exportWithParents(johnGender, janeGender) {
    const gg = structuredClone(simpleGG);
    gg[0].prop.gender = johnGender;
    gg[1].prop.gender = janeGender;
    return GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
  }
  const kinCodes = (exported) => [...exported.matchAll(/"code": "(KIN:0\d\d)"/g)].map((m) => m[1]).filter((c) => c !== 'KIN:026').sort();

  it('codes a parent of unknown gender as a parent, not by guessing from the other parent', () => {
    expect(kinCodes(exportWithParents('U', 'F'))).toEqual(['KIN:003', 'KIN:027']);
    expect(kinCodes(exportWithParents('M', 'U'))).toEqual(['KIN:003', 'KIN:028']);
  });

  // (The import still reads a pedigree only with one mother and one father, so it can't read these back.)
  it('codes two same-gender parents as parents, not one of them as the other gender', () => {
    for (const gender of ['M', 'F']) {
      expect(kinCodes(exportWithParents(gender, gender))).toEqual(['KIN:003', 'KIN:003']);
    }
  });

  it('marks twins in twin group 0 as a multiple birth', () => {
    const gg = structuredClone(simpleGG);
    gg[3].outedges.push({ to: 5 });
    gg[4].prop = { gender: 'F', fName: 'Ann', twinGroup: 0 };
    gg.push({ id: 5, prop: { gender: 'F', fName: 'Bea', twinGroup: 0 } });
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    const twins = JSON.parse(exported).entry.map((e) => e.resource)
      .filter((r) => r.resourceType === 'Patient' && ['Ann', 'Bea'].includes(r.name[0].given[0]));
    expect(twins.map((p) => p.multipleBirthBoolean)).toEqual([true, true]);
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
    // A profile that's a string rather than a list, and only contains the URL: includes() on it was a
    // substring test, which took it for the GA4GH profile.
    const profile = exported.entry[0].resource.meta.profile;
    exported.entry[0].resource.meta.profile = 'https://example.org/?' + profile[0];
    expect(() => GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported))).toThrow(/not expected JSON format/);
  });
});
