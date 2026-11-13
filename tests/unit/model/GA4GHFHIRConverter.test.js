import { describe, it, expect, vi, beforeEach } from 'vitest';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import { placeParents, chooseParentClaims } from 'pedigree/model/parentClaims';
import PedigreeImport from 'pedigree/model/import';
import simpleGG from '../fixtures/simple-pedigree-gg.json';
import DynamicPositionedGraph from 'pedigree/model/dynamicGraph';

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

  it('codes two same-gender parents as parents, and reads them back as the child\'s parents', () => {
    for (const gender of ['M', 'F']) {
      const exported = exportWithParents(gender, gender);
      expect(kinCodes(exported)).toEqual(['KIN:003', 'KIN:003']);
      const graph = GA4GHFHIRConverter.initFromFHIR(exported);
      const byName = (name) => Object.keys(graph.properties).map(Number).find((v) => graph.properties[v].fName === name);
      const child = Object.keys(graph.properties).map(Number).find((v) => graph.isPerson(v) && graph.getParents(v).length === 2);
      expect(graph.getParents(child).sort()).toEqual([byName('John'), byName('Jane')].sort());
      expect([graph.properties[byName('John')].gender, graph.properties[byName('Jane')].gender]).toEqual([gender, gender]);
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

describe('GA4GHFHIRConverter reading parent relationships', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  // An export of simpleGG with John (node 0) and Jane's genders set, then each parent code replaced.
  function withParentCodes(johnGender, janeGender, codes) {
    const gg = structuredClone(simpleGG);
    gg[0].prop.gender = johnGender;
    gg[1].prop.gender = janeGender;
    let exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    for (const [from, to] of Object.entries(codes)) {
      exported = exported.split(`"code": "${from}"`).join(`"code": "${to}"`);
    }
    return exported;
  }
  const parentsOfChild = (graph) => {
    const people = Object.keys(graph.properties).map(Number).filter((v) => graph.isPerson(v));
    const child = people.find((v) => graph.getParents(v).length === 2);
    return graph.getParents(child).map((v) => `${graph.properties[v].fName || '?'}:${graph.properties[v].gender}`).sort();
  };

  it('reads two mothers (or two fathers) coded as such, whatever order they come in', () => {
    expect(parentsOfChild(GA4GHFHIRConverter.initFromFHIR(withParentCodes('F', 'F', { 'KIN:003': 'KIN:027' }))))
      .toEqual(['Jane:F', 'John:F']);
    expect(parentsOfChild(GA4GHFHIRConverter.initFromFHIR(withParentCodes('M', 'M', { 'KIN:003': 'KIN:028' }))))
      .toEqual(['Jane:M', 'John:M']);
  });

  it('still refuses a man coded as a mother', () => {
    expect(() => GA4GHFHIRConverter.initFromFHIR(withParentCodes('M', 'F', { 'KIN:028': 'KIN:027' })))
      .toThrow(/declared as male is also declared as being a mother/);
  });

  it('refuses a code that contradicts a gender, whichever parent slot it lands in', () => {
    // both coded as fathers: John is placed as the father, Jane (F) in the other slot - still refused
    expect(() => GA4GHFHIRConverter.initFromFHIR(withParentCodes('M', 'F', { 'KIN:027': 'KIN:028' })))
      .toThrow(/declared as female is also declared as being a father/);
  });

  it('refuses a parent coded as both mother and father, in either order', () => {
    for (const order of ['father-first', 'mother-first']) {
      const exported = JSON.parse(withParentCodes('M', 'F', {}));
      const johnLink = exported.entry.find((e) => e.resource.resourceType === 'FamilyMemberHistory' && e.resource.relationship
        && e.resource.relationship.coding[0].code === 'KIN:028');
      const asMother = structuredClone(johnLink);
      asMother.resource.relationship.coding[0].code = 'KIN:027';
      exported.entry.splice(exported.entry.indexOf(johnLink) + (order === 'father-first' ? 1 : 0), 0, asMother);
      expect(() => GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported))).toThrow(/declared as male is also declared as being a mother/);
    }
  });

  it('places a coded mother and father in their own slots before any spill over', () => {
    const genders = { x: 'M', y: 'M', z: 'F', u: 'U', f: 'F' };
    const place = (claims) => { const slots = placeParents(claims, (n) => genders[n]); return [slots.mother && slots.mother.node, slots.father && slots.father.node]; };
    // two fathers then a mother: the mother keeps the mother slot
    expect(place([{ node: 'x', gender: 'M' }, { node: 'y', gender: 'M' }, { node: 'z', gender: 'F' }])).toEqual(['z', 'x']);
    // parents of known gender before unknown: the female parent takes the mother slot
    expect(place([{ node: 'u', gender: null }, { node: 'f', gender: null }])).toEqual(['f', 'u']);
    // a parent coded twice fills one slot
    expect(place([{ node: 'f', gender: 'F' }, { node: 'f', gender: null }])).toEqual(['f', null]);
  });

  // An export with John and everything that mentions him dropped, leaving Jane (F) the child's only parent.
  function loneJane() {
    const exported = JSON.parse(withParentCodes('M', 'F', {}));
    const johnId = exported.entry.find((e) => e.resource.resourceType === 'Patient' && e.resource.name && e.resource.name[0].given[0] === 'John').resource.id;
    exported.entry = exported.entry.filter((e) => e.resource.resourceType === 'Composition' || !JSON.stringify(e).includes(johnId));
    const composition = exported.entry.find((e) => e.resource.resourceType === 'Composition').resource;
    for (const section of composition.section || []) {
      section.entry = (section.entry || []).filter((ref) => !JSON.stringify(ref).includes(johnId));
    }
    return exported;
  }

  it('gives a lone parent a made-up partner of the other gender', () => {
    expect(parentsOfChild(GA4GHFHIRConverter.initFromFHIR(JSON.stringify(loneJane())))).toEqual(['?:M', 'Jane:F']);
  });

  it('places a parent coded twice only once', () => {
    const exported = loneJane();
    const janeLink = exported.entry.find((e) => e.resource.resourceType === 'FamilyMemberHistory' && e.resource.relationship
      && e.resource.relationship.coding[0].code === 'KIN:027');
    const again = structuredClone(janeLink);
    again.resource.relationship.coding[0].code = 'KIN:003';
    exported.entry.push(again);
    expect(parentsOfChild(GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported)))).toEqual(['?:M', 'Jane:F']);
  });
});

describe('GA4GHFHIRConverter life status', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  for (const privacy of ['all', 'nopersonal', 'minimal']) {
    it(`exports a deceased person as deceased, not unborn (privacy ${privacy})`, () => {
      const gg = structuredClone(simpleGG);
      gg[0].prop.lifeStatus = 'deceased';
      const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, privacy, null, null));
      const patients = exported.entry.map((e) => e.resource).filter((r) => r.resourceType === 'Patient');
      const deceased = patients.find((p) => p.deceasedBoolean === true);
      expect(deceased).toBeDefined();
      const unborn = deceased.extension.find((e) => e.url.endsWith('/patient-unborn'));
      expect(unborn.valueBoolean).toBe(false);
    });
  }
});

describe('GA4GHFHIRConverter life status, reduced privacy', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  it('reads a deceased person saved as unborn by an older export as deceased', () => {
    const gg = structuredClone(simpleGG);
    gg[0].prop.lifeStatus = 'deceased';
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'minimal', null, null));
    const john = exported.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient' && r.deceasedBoolean === true);
    john.extension.find((e) => e.url.endsWith('/patient-unborn')).valueBoolean = true; // as older exports wrote it
    const graph = GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported));
    const statuses = Object.values(graph.properties).map((p) => p.lifeStatus).filter(Boolean);
    expect(statuses).toContain('deceased');
    expect(statuses).not.toContain('unborn');
  });

  it('leaves the gestational age out', () => {
    const gg = structuredClone(simpleGG);
    gg[4].prop.lifeStatus = 'stillborn';
    gg[4].prop.gestationAge = 20;
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'minimal', null, null);
    expect(exported).toContain('"deceasedString": "stillborn"');
    expect(exported).not.toContain('20 weeks');
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

// pedigree-editor-fetus-and-adoption-fidelity
describe('GA4GHFHIRConverter fetus and adoption round trips', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });
  const patients = (exported) => JSON.parse(exported).entry.map((e) => e.resource).filter((r) => r.resourceType === 'Patient');

  it('keeps a stillborn fetus with a date of death a stillborn fetus, with its date (D1)', () => {
    const gg = structuredClone(simpleGG);
    Object.assign(gg[4].prop, { fName: 'Fetus', lifeStatus: 'stillborn', gestationAge: '30', dod: '03/04/2020' });
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    const fetus = patients(exported).find((p) => p.deceasedString);
    expect(fetus.deceasedString).toBe('stillborn 30 weeks');
    expect(fetus.deceasedDateTime).toBeUndefined();
    expect(fetus.extension.find((e) => e.url.endsWith('/fetus-date-of-death')).valueDate).toBe('2020-03-04');

    const graph = GA4GHFHIRConverter.initFromFHIR(exported);
    const read = Object.values(graph.properties).find((p) => p.fName === 'Fetus');
    expect(read.lifeStatus).toBe('stillborn');
    expect(read.gestationAge).toBe('30');
    expect(read.dod).toBe('03/04/2020');
  });

  it('leaves the date out with reduced privacy', () => {
    const gg = structuredClone(simpleGG);
    Object.assign(gg[4].prop, { lifeStatus: 'stillborn', dod: '03/04/2020' });
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'minimal', null, null);
    const fetus = patients(exported).find((p) => p.deceasedString);
    expect(fetus.deceasedString).toBe('stillborn');
    expect(fetus.extension.find((e) => e.url.endsWith('/fetus-date-of-death'))).toBeUndefined();
  });

  it('keeps an adopted child adopted, under the same parents (D2)', () => {
    const gg = structuredClone(simpleGG);
    gg[4].prop.isAdopted = true;
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    expect(exported).toContain('KIN:022');
    const graph = GA4GHFHIRConverter.initFromFHIR(exported);
    const people = Object.keys(graph.properties).map(Number).filter((v) => graph.isPerson(v));
    const child = people.find((v) => graph.getParents(v).length === 2);
    expect(graph.properties[child].isAdopted).toBe(true);
    expect(graph.getParents(child).map((v) => graph.properties[v].fName).sort()).toEqual(['Jane', 'John']);
  });

  // redcap_pedigree_editor#7: no adoptive parents drawn, so no KIN:022 to carry the adoption
  it('keeps a person adopted when their parents aren\'t in the pedigree', () => {
    const gg = structuredClone(simpleGG);
    gg[0].prop.isAdopted = true;
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    const john = patients(exported).find((p) => p.name && p.name[0].given[0] === 'John');
    expect(john.extension).toContainEqual({ url: 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/adopted', valueCode: 'in' });
    expect(exported).not.toContain('KIN:022');

    const graph = GA4GHFHIRConverter.initFromFHIR(exported);
    const read = Object.values(graph.properties).find((p) => p.fName === 'John');
    expect(read.isAdopted).toBe(true);
    // and only John: the others aren't adopted
    expect(Object.values(graph.properties).filter((p) => p.isAdopted).map((p) => p.fName)).toEqual(['John']);
  });

  it('reads neither the adoption nor a fetus date of death under the URLs used before 2.0.0, and says so', () => {
    const gg = structuredClone(simpleGG);
    gg[0].prop.isAdopted = true;
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    const retired = exported
      .replace('https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/adopted', 'https://github.com/aehrc/open-pedigree/StructureDefinition/adopted')
      .replace('"valueCode":"in"', '"valueBoolean":true');
    expect(retired).toContain('https://github.com/aehrc/open-pedigree/StructureDefinition/adopted');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const graph = GA4GHFHIRConverter.initFromFHIR(retired);
      expect(Object.values(graph.properties).filter((p) => p.isAdopted)).toEqual([]);
      expect(warn.mock.calls.map((c) => String(c[0]))).toContain('Ignoring https://github.com/aehrc/open-pedigree/StructureDefinition/adopted: '
        + 'open-pedigree no longer reads it (now https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/adopted)');
    } finally {
      warn.mockRestore();
    }
  });

  it('warns about a retired extension once per import, however many people carry it', () => {
    const gg = structuredClone(simpleGG);
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    const bundle = JSON.parse(exported);
    // (a published name under the retired base, on every person)
    const url = 'https://github.com/aehrc/open-pedigree/StructureDefinition/linked-record-snapshot';
    let people = 0;
    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'Patient') {
        people++;
        entry.resource.extension = (entry.resource.extension || []).concat([{ url, valueString: '{}' }]);
      }
    }
    expect(people).toBeGreaterThan(1);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      GA4GHFHIRConverter.initFromFHIR(JSON.stringify(bundle));
      GA4GHFHIRConverter.initFromFHIR(JSON.stringify(bundle));
      // (two imports, one warning each)
      const expected = 'Ignoring ' + url + ': open-pedigree no longer reads it (now '
        + 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/linked-record-snapshot)';
      expect(warn.mock.calls.filter((c) => String(c[0]) === expected).length).toBe(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('exports none of its own URLs under the retired base', () => {
    const gg = structuredClone(simpleGG);
    gg[0].prop.isAdopted = true;
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    expect(exported).not.toMatch(/github\.com\/aehrc\/open-pedigree\/(StructureDefinition|Questionnaire|questionnaire-)/);
    expect(exported).toContain('https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/adopted');
  });

  it('writes no adopted extension for someone who isn\'t adopted', () => {
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(structuredClone(simpleGG)) }, 'all', null, null);
    expect(exported).not.toContain('/StructureDefinition/adopted');
  });

  it('keeps the adoption with reduced privacy, as the adoptive-parent relationships are', () => {
    const gg = structuredClone(simpleGG);
    gg[0].prop.isAdopted = true;
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'minimal', null, null);
    expect(patients(exported).filter((p) => (p.extension || []).some((e) => e.url.endsWith('/StructureDefinition/adopted'))).length).toBe(1);
    const graph = GA4GHFHIRConverter.initFromFHIR(exported);
    // (no names with this setting: John is the one with no parents and a partner)
    const adopted = Object.keys(graph.properties).map(Number).filter((v) => graph.isPerson(v) && graph.properties[v].isAdopted);
    expect(adopted.length).toBe(1);
    expect(graph.getParents(adopted[0])).toEqual([]);
    expect(graph.properties[adopted[0]].gender).toBe('M');
  });

  it('writes the adoption of a child with parents only as their adoptive-parent relationships', () => {
    const gg = structuredClone(simpleGG);
    gg[4].prop.isAdopted = true;
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    expect(exported).toContain('KIN:022');
    expect(exported).not.toContain('/StructureDefinition/adopted');
  });

  it('writes no adopted extension for a fetus', () => {
    const gg = structuredClone(simpleGG);
    Object.assign(gg[0].prop, { isAdopted: true, lifeStatus: 'stillborn' });
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    expect(exported).not.toContain('/StructureDefinition/adopted');
  });

  // the extension and a person's parents' relationship codes, disagreeing (a file from elsewhere)
  const withAdoptedExtension = (who, valueBoolean) => {
    const gg = structuredClone(simpleGG);
    gg[4].prop.fName = 'Kid';
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null));
    const patient = exported.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given[0] === who);
    patient.extension.push({ url: 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/adopted', valueBoolean });
    return GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported));
  };

  it('leaves a person with birth parents in the pedigree unadopted, whatever the extension says', () => {
    const graph = withAdoptedExtension('Kid', true);
    expect(Object.values(graph.properties).filter((p) => p.isAdopted)).toEqual([]);
    // and their parents are still written as birth parents
    const again = GA4GHFHIRConverter.exportAsFHIR({ GG: graph }, 'all', null, null);
    expect(again).not.toContain('KIN:022');
  });

  it('ignores an adopted extension on a fetus', () => {
    const gg = structuredClone(simpleGG);
    gg[0].prop.lifeStatus = 'stillborn';
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null));
    const john = exported.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given[0] === 'John');
    john.extension.push({ url: 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/adopted', valueBoolean: true });
    const graph = GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported));
    expect(Object.values(graph.properties).filter((p) => p.isAdopted)).toEqual([]);
  });

  it('leaves a person with one parent in the pedigree unadopted, whatever the extension says', () => {
    const gg = structuredClone(simpleGG);
    gg[4].prop.fName = 'Kid';
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null));
    const resources = exported.entry.map((e) => e.resource);
    const ref = (name) => resources.find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given[0] === name).id;
    const kid = ref('Kid');
    resources.find((r) => r.id === kid).extension.push({ url: 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/adopted', valueBoolean: true });
    // without Jane: only John is placed
    const jane = ref('Jane');
    exported.entry = exported.entry.filter((e) => !JSON.stringify(e.resource).includes(jane)
      || e.resource.resourceType === 'Composition');
    const graph = GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported));
    expect(Object.values(graph.properties).filter((p) => p.isAdopted)).toEqual([]);
  });

  it('reads an adopted extension saying false as not adopted', () => {
    const graph = withAdoptedExtension('John', false);
    expect(Object.values(graph.properties).filter((p) => p.isAdopted)).toEqual([]);
  });
});

describe('GA4GHFHIRConverter fetus and adoption edge cases', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  it('ignores a fetus date-of-death extension on someone who isn\'t a fetus', () => {
    const gg = structuredClone(simpleGG);
    gg[0].prop.lifeStatus = 'alive';
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null));
    const john = exported.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given[0] === 'John');
    john.extension.push({ url: 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/fetus-date-of-death', valueDate: '2020-03-04' });
    const graph = GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported));
    const read = Object.values(graph.properties).find((p) => p.fName === 'John');
    expect(read.dod).toBeUndefined();
  });

  it('doesn\'t fail on a biological parent it leaves out, whose code contradicts their gender', () => {
    // John (M) and Jane (F) adopt the child; a second relationship codes John as the child's mother.
    const gg = structuredClone(simpleGG);
    gg[4].prop.isAdopted = true;
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null));
    const fmh = exported.entry.map((e) => e.resource).filter((r) => r.resourceType === 'FamilyMemberHistory' && r.relationship
      && r.relationship.coding[0].code === 'KIN:022');
    const extra = structuredClone(fmh[0]);
    extra.id = extra.id + '-bio';
    extra.relationship.coding[0] = { system: 'http://purl.org/ga4gh/kin.fhir', code: 'KIN:027', display: 'isBiologicalMother' };
    exported.entry.push({ fullUrl: 'FamilyMemberHistory/' + extra.id, resource: extra });
    const graph = GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported));
    const child = Object.keys(graph.properties).map(Number).find((v) => graph.isPerson(v) && graph.getParents(v).length === 2);
    expect(graph.properties[child].isAdopted).toBe(true);
    // under the adoptive parents, John as father: the KIN:027 claim on him was left out
    expect(graph.getParents(child).map((v) => `${graph.properties[v].fName}:${graph.properties[v].gender}`).sort()).toEqual(['Jane:F', 'John:M']);
  });
});

describe('GA4GHFHIRConverter adoption: fetus and step-parents', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  it('doesn\'t mark a fetus adopted, as the editor can\'t show one', () => {
    const gg = structuredClone(simpleGG);
    Object.assign(gg[4].prop, { fName: 'Fetus', lifeStatus: 'stillborn', isAdopted: true });
    const exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    expect(exported).toContain('KIN:022');
    const graph = GA4GHFHIRConverter.initFromFHIR(exported);
    const fetus = Object.values(graph.properties).find((p) => p.fName === 'Fetus');
    expect(fetus.isAdopted).toBeFalsy();
  });

  it('places step-parents (KIN:023) when a child has no other parents, so the pedigree opens', () => {
    const gg = structuredClone(simpleGG);
    let exported = GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(gg) }, 'all', null, null);
    for (const code of ['KIN:027', 'KIN:028', 'KIN:003']) {
      exported = exported.split(`"code": "${code}"`).join('"code": "KIN:023"');
    }
    const graph = GA4GHFHIRConverter.initFromFHIR(exported);
    const child = Object.keys(graph.properties).map(Number).find((v) => graph.isPerson(v) && graph.getParents(v).length === 2);
    expect(graph.getParents(child).map((v) => graph.properties[v].fName).sort()).toEqual(['Jane', 'John']);
  });
});

describe('chooseParentClaims (D2)', () => {
  it('takes the adoptive claims, and the child is adopted', () => {
    const claims = [{ node: 1, gender: 'F' }, { node: 2, gender: null, adoptive: true }, { node: 3, gender: 'M' }];
    expect(chooseParentClaims(claims)).toEqual({ claims: [claims[1]], adopted: true, left: [claims[0], claims[2]] });
  });
  it('takes the claims that aren\'t step-parents when there are any', () => {
    const claims = [{ node: 1, gender: 'F', step: true }, { node: 2, gender: 'M' }];
    expect(chooseParentClaims(claims)).toEqual({ claims: [claims[1]], adopted: false, left: [claims[0]] });
  });
  it('takes a fetus\'s biological parents over its adoptive ones (a fetus can\'t be adopted)', () => {
    const claims = [{ node: 1, gender: 'F' }, { node: 2, gender: null, adoptive: true }, { node: 3, gender: 'M' }];
    expect(chooseParentClaims(claims, true)).toEqual({ claims: [claims[0], claims[2]], adopted: false, left: [claims[1]] });
  });
  it('takes a fetus\'s adoptive parents, not adopted, when they are all it has', () => {
    const claims = [{ node: 2, gender: null, adoptive: true }];
    expect(chooseParentClaims(claims, true).adopted).toBe(false);
    expect(chooseParentClaims(claims, true).claims).toEqual(claims);
  });
  it('takes step-parents when they are all there is', () => {
    const claims = [{ node: 1, gender: 'F', step: true }];
    expect(chooseParentClaims(claims)).toEqual({ claims, adopted: false, left: [] });
  });
});

describe('GA4GHFHIRConverter import errors', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  it('reports a disconnected pedigree in the same words as the other importers', () => {
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(structuredClone(simpleGG)) }, 'all', null, null));
    // no relationships: three unconnected people
    exported.entry = exported.entry.filter((e) => e.resource.resourceType !== 'FamilyMemberHistory');
    expect(() => GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported)))
      .toThrow(/^Unsupported pedigree: some components of the imported pedigree are disconnected from each other \(disconnected component detected/);
  });
});

// pedigree-editor-partner-without-child: a couple with no children has a placeholder child
describe('GA4GHFHIRConverter and a couple with no children', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', mockEditor);
  });

  // John and Jane, with no children: John (vertex 0) given a partner without a child
  function childlessCouple(partnerProperties) {
    const graph = DynamicPositionedGraph.makeEmpty(10, 2);
    graph.fromImport('f 1 0 0 1 1', 'ped', {});
    graph.setProperties(0, { gender: 'M', fName: 'John' });
    const changeSet = graph.addNewRelationship(0, null);
    const partner = changeSet.new.find((v) => graph.isPerson(v) && !graph.isPlaceholder(v));
    graph.setProperties(partner, { gender: 'F', fName: 'Jane', ...partnerProperties });
    return graph;
  }
  const resources = (exported) => JSON.parse(exported).entry.map((e) => e.resource);
  const kinCodes = (exported) => resources(exported).filter((r) => r.resourceType === 'FamilyMemberHistory').map((r) => r.relationship.coding[0].code);
  const placeholders = (graph) => Object.keys(graph.properties).map(Number).filter((v) => graph.isPerson(v) && graph.properties[v].placeholder === true);

  it('writes the couple as their partner relationship only', () => {
    const exported = GA4GHFHIRConverter.exportAsFHIR(childlessCouple().DG, 'all', null, null);
    const patients = resources(exported).filter((r) => r.resourceType === 'Patient');
    expect(patients.map((p) => p.name[0].given[0]).sort()).toEqual(['Jane', 'John']);
    expect(kinCodes(exported).sort()).toEqual(['KIN:026']);
    expect(resources(exported).filter((r) => r.resourceType === 'QuestionnaireResponse').length).toBeLessThanOrEqual(2);
  });

  it('reads a couple with no shared child back as a couple with a placeholder', () => {
    const graph = GA4GHFHIRConverter.initFromFHIR(GA4GHFHIRConverter.exportAsFHIR(childlessCouple().DG, 'all', null, null));
    const john = Object.keys(graph.properties).map(Number).find((v) => graph.properties[v].fName === 'John');
    const jane = Object.keys(graph.properties).map(Number).find((v) => graph.properties[v].fName === 'Jane');
    const rel = graph.getRelationshipNode(john, jane);
    expect(rel).not.toBeNull();
    expect(placeholders(graph)).toEqual(graph.getOutEdges(graph.getRelationshipChildhub(rel)));
    expect(placeholders(graph).length).toBe(1);
  });

  it('keeps a separated couple separated', () => {
    const graph = childlessCouple();
    const rel = graph.DG.GG.getRelationshipNode(0, graph.DG.GG.getAllPartners(0)[0]);
    graph.setProperties(rel, { broken: true });
    const exported = GA4GHFHIRConverter.exportAsFHIR(graph.DG, 'all', null, null);
    expect(kinCodes(exported)).toEqual(['KIN:048']);
    const again = GA4GHFHIRConverter.initFromFHIR(exported);
    const relAgain = Object.keys(again.properties).map(Number).find((v) => again.isRelationship(v));
    expect(again.properties[relAgain].broken).toBe(true);
  });

  it('opens a bundle from elsewhere whose partners share no child, instead of failing as disconnected', () => {
    // John and Jane with a child, Jane's second partner Bob with none
    const exported = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(structuredClone(simpleGG)) }, 'all', null, null));
    const jane = exported.entry.find((e) => e.resource.resourceType === 'Patient' && e.resource.name && e.resource.name[0].given[0] === 'Jane');
    const bobRef = 'urn:uuid:0f8fad5b-d9cb-469f-a165-70867728950e';
    exported.entry.push({ fullUrl: bobRef, resource: { resourceType: 'Patient', id: bobRef, gender: 'male', name: [{ given: ['Bob'] }] } });
    exported.entry.push({ fullUrl: 'urn:uuid:7c9e6679-7425-40de-944b-e07fc1f90ae7', resource: { resourceType: 'FamilyMemberHistory', id: 'urn:uuid:7c9e6679-7425-40de-944b-e07fc1f90ae7', status: 'completed', patient: { reference: jane.resource.id },
      extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/familymemberhistory-patient-record', valueReference: { reference: bobRef } }],
      relationship: { coding: [{ system: 'http://purl.org/ga4gh/kin.fhir', code: 'KIN:026', display: 'isPartner' }] } } });
    const graph = GA4GHFHIRConverter.initFromFHIR(JSON.stringify(exported));
    const bob = Object.keys(graph.properties).map(Number).find((v) => graph.properties[v].fName === 'Bob');
    const janeId = Object.keys(graph.properties).map(Number).find((v) => graph.properties[v].fName === 'Jane');
    expect(graph.getRelationshipNode(bob, janeId)).not.toBeNull();
    expect(placeholders(graph).length).toBe(1);
  });
});
