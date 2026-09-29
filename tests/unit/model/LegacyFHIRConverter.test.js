import { describe, it, expect, vi, beforeEach } from 'vitest';
import LegacyFHIRConverter from 'pedigree/LegacyFHIRConverter';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import DefaultFhirTerminologyHelper from 'pedigree/DefaultFhirTerminologyHelper';
import simpleGG from '../fixtures/simple-pedigree-gg.json';
import PedigreeImport from 'pedigree/model/import';
// Saved by open-pedigree as bundled in redcap_pedigree_editor v0.3.2 (the last to write this
// format), from the module's example family plus twins, a consanguineous and a separated couple,
// a death, a maiden name, a note, and a disorder, phenotype and gene. Its SVG image is replaced by
// a tiny one.
import legacyPedigree from '../fixtures/legacy-fhir-v1-pedigree.json';

const legacyText = JSON.stringify(legacyPedigree);

// The code systems v0.3.2 was configured with.
const terminologyHelper = new DefaultFhirTerminologyHelper(
  'http://www.omim.org', 'http://purl.obolibrary.org/obo/hp.fhir', 'http://www.genenames.org/geneId');

// What v0.3.2's own importer read back from the fixture: its graph, vertex by vertex.
const V032_READS = [
  { id: 0, prop: { id: 'FMH_0', gender: 'F', fName: 'Maya', lName: 'Example', dob: '07/12/2016', disorders: ['615688', 'affected'], hpoTerms: ['HP:0001250'], candidateGenes: ['HGNC:1839'] }, to: [] },
  { id: 1, prop: { id: 'FMH_1', gender: 'M', fName: 'Arthur', lName: 'Example', dob: '01/15/1950', dod: '06/21/2012' }, to: [11] },
  { id: 2, prop: { id: 'FMH_2', gender: 'F', fName: 'Edith', lName: 'Example', dob: '08/30/1953' }, to: [11] },
  { id: 3, prop: { id: 'FMH_3', gender: 'M', fName: 'Ray', lName: 'Hartley', dob: '03/11/1955' }, to: [13] },
  { id: 4, prop: { id: 'FMH_4', gender: 'F', fName: 'June', lName: 'Hartley', dob: '04/27/1958' }, to: [13] },
  { id: 5, prop: { id: 'FMH_5', gender: 'M', fName: 'Tom', lName: 'Example', dob: '11/02/1984', carrierStatus: 'carrier' }, to: [9] },
  { id: 6, prop: { id: 'FMH_6', gender: 'F', fName: 'Grace', lName: 'Example', lNameAtB: 'Hartley', dob: '02/19/1986', comments: 'Referred by GP', carrierStatus: 'carrier' }, to: [9] },
  { id: 7, prop: { id: 'FMH_7', gender: 'F', fName: 'Ruby', lName: 'Example', dob: '09/08/2013', twinGroup: 0 }, to: [] },
  { id: 8, prop: { id: 'FMH_8', gender: 'M', twinGroup: 0, fName: 'Leo', lName: 'Example', dob: '09/08/2013', carrierStatus: 'presymptomatic' }, to: [] },
  { id: 9, prop: { consangr: 'Y' }, to: [10] },
  { id: 10, prop: {}, to: [0, 7, 8] },
  { id: 11, prop: {}, to: [12] },
  { id: 12, prop: {}, to: [5] },
  { id: 13, prop: { broken: true }, to: [14] },
  { id: 14, prop: {}, to: [6] },
];

function asVertices(graph) {
  const vertices = [];
  for (let id = 0; id < graph.v.length; id++) {
    vertices.push({ id, prop: graph.properties[id], to: [...graph.getOutEdges(id)].sort((a, b) => a - b) });
  }
  return vertices;
}

// A legacy Composition of the given FamilyMemberHistory resources.
function composition(...familyMembers) {
  return JSON.stringify({ resourceType: 'Composition', status: 'preliminary', contained: familyMembers });
}

function fmh(id, sex, extension = []) {
  return {
    resourceType: 'FamilyMemberHistory', id, name: id + ' Test',
    sex: { coding: [{ system: 'http://hl7.org/fhir/administrative-gender', code: sex }] }, extension,
  };
}

function parent(ref, display) {
  return {
    url: 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-parent',
    extension: [
      { url: 'type', valueCodeableConcept: { coding: [{ display }] } },
      { url: 'reference', valueReference: { reference: '#' + ref } },
    ],
  };
}

function twinOf(ref, code) {
  return {
    url: 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-sibling',
    extension: [
      { url: 'type', valueCodeableConcept: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code }] } },
      { url: 'reference', valueReference: { reference: '#' + ref } },
    ],
  };
}

describe('LegacyFHIRConverter', () => {
  beforeEach(() => {
    vi.stubGlobal('editor', { getFhirTerminologyHelper: () => terminologyHelper });
  });

  it('reads a pedigree saved in the legacy format exactly as v0.3.2 did', () => {
    expect(asVertices(LegacyFHIRConverter.initFromFHIR(legacyText))).toEqual(V032_READS);
  });

  it('recognises the phenotype and gene code systems it was saved with, whatever the editor uses now', () => {
    // today's defaults (localEditor.html)
    const today = new DefaultFhirTerminologyHelper('http://www.omim.org', 'http://purl.obolibrary.org/obo/hp.owl',
      'http://purl.bioontology.org/ontology/HGNC/hgnc.owl');
    vi.stubGlobal('editor', { getFhirTerminologyHelper: () => today });
    const maya = LegacyFHIRConverter.initFromFHIR(legacyText).properties[0];
    expect(maya.hpoTerms).toEqual(['HP:0001250']);
    expect(maya.candidateGenes).toEqual(['HGNC:1839']);
  });

  it('is what the GA4GH import reads it with', () => {
    expect(asVertices(GA4GHFHIRConverter.initFromFHIR(legacyText))).toEqual(V032_READS);
  });

  it('reads a List of family members too', () => {
    const list = JSON.stringify({ ...legacyPedigree, resourceType: 'List' });
    expect(asVertices(GA4GHFHIRConverter.initFromFHIR(list))).toEqual(V032_READS);
  });

  it('only takes resources that are not GA4GH pedigrees', () => {
    const ga4gh = JSON.parse(GA4GHFHIRConverter.exportAsFHIR({ GG: PedigreeImport.initFromPhenotipsInternal(simpleGG) }, 'all', null, null));
    expect(LegacyFHIRConverter.isLegacyResource(ga4gh)).toBe(false); // a Bundle
    expect(LegacyFHIRConverter.isLegacyResource(ga4gh.entry[0].resource)).toBe(false); // its Composition
    expect(LegacyFHIRConverter.isLegacyResource(legacyPedigree)).toBe(true);
    expect(LegacyFHIRConverter.isLegacyResource({ resourceType: 'List' })).toBe(true);
    expect(LegacyFHIRConverter.isLegacyResource({ resourceType: 'Patient' })).toBe(false);
    // a profile is matched whole, not as a substring
    const profile = 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree';
    expect(LegacyFHIRConverter.isLegacyResource({ resourceType: 'Composition', meta: { profile: [profile + '-other'] } })).toBe(true);
    expect(LegacyFHIRConverter.isLegacyResource({ resourceType: 'Composition', meta: { profile } })).toBe(true); // not a list
  });

  it('puts every twin in one group, and it is fraternal if any of them is', () => {
    const parents = [parent('Mum', 'mother'), parent('Dad', 'father')];
    const graph = LegacyFHIRConverter.initFromFHIR(composition(
      fmh('A', 'female', [...parents, twinOf('C', 'FTWINBRO'), twinOf('B', 'TWINSIS')]),
      fmh('B', 'female', parents),
      fmh('C', 'male', parents),
      fmh('Mum', 'female'),
      fmh('Dad', 'male'),
    ));
    expect([0, 1, 2].map((id) => graph.properties[id].twinGroup)).toEqual([0, 0, 0]);
    expect([0, 1, 2].map((id) => graph.properties[id].monozygotic)).toEqual([undefined, undefined, undefined]);
  });

  it('puts triplets typed only by display in one group', () => {
    const byDisplay = (ref, display) => ({
      url: 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-sibling',
      extension: [{ url: 'type', valueCodeableConcept: { coding: [{ display }] } }, { url: 'reference', valueReference: { reference: '#' + ref } }],
    });
    const parents = [parent('Mum', 'mother'), parent('Dad', 'father')];
    const graph = LegacyFHIRConverter.initFromFHIR(composition(
      fmh('A', 'female', [...parents, byDisplay('B', 'twin sister'), byDisplay('C', 'twin brother')]),
      fmh('B', 'female', parents),
      fmh('C', 'male', parents),
      fmh('Mum', 'female'),
      fmh('Dad', 'male'),
    ));
    expect([0, 1, 2].map((id) => graph.properties[id].twinGroup)).toEqual([0, 0, 0]);
  });

  it('reads the extensions after a plain sibling, or one it can\'t use', () => {
    const sibling = {
      url: 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-sibling',
      extension: [{ url: 'type', valueCodeableConcept: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'NBRO' }] } },
        { url: 'reference', valueReference: { reference: '#B' } }],
    };
    const noRef = { url: 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-parent', extension: [] };
    const parents = [parent('Mum', 'mother'), parent('Dad', 'father')];
    const graph = LegacyFHIRConverter.initFromFHIR(composition(
      fmh('A', 'female', [sibling, noRef, ...parents]),
      fmh('B', 'male', parents),
      fmh('Mum', 'female'),
      fmh('Dad', 'male'),
    ));
    const childhub = graph.getOutEdges(graph.getOutEdges(2)[0])[0];
    expect([...graph.getOutEdges(childhub)].sort()).toEqual([0, 1]);
    expect(graph.v.length).toBe(6); // no virtual parents for A
  });

  it('takes the proband\'s sex from the subject Patient', () => {
    const doc = JSON.parse(composition({ resourceType: 'FamilyMemberHistory', id: 'Me', name: 'Me Test',
      relationship: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'ONESELF' }] } },
    { resourceType: 'Patient', id: 'pat', gender: 'female' }));
    doc.subject = { reference: '#pat' };
    expect(LegacyFHIRConverter.initFromFHIR(JSON.stringify(doc)).properties[0].gender).toBe('F');
  });

  it('makes no twin group from a twin who is not in the pedigree', () => {
    const parents = [parent('Mum', 'mother'), parent('Dad', 'father')];
    const graph = LegacyFHIRConverter.initFromFHIR(composition(
      fmh('A', 'female', [...parents, twinOf('Missing', 'TWINSIS')]),
      fmh('Mum', 'female'),
      fmh('Dad', 'male'),
    ));
    expect(graph.properties[0].twinGroup).toBeUndefined();
  });

  it('reads each parent\'s type from its display', () => {
    const graph = LegacyFHIRConverter.initFromFHIR(composition(
      fmh('Mum', 'female'),
      fmh('Dad', 'male'),
      fmh('Kid1', 'female', [parent('Mum', 'mother'), parent('Dad', 'father')]),
      fmh('Kid2', 'male', [parent('Mum', 'mother'), parent('Dad', 'father')]),
    ));
    const childhub = graph.getOutEdges(graph.getOutEdges(0)[0])[0];
    expect([...graph.getOutEdges(childhub)].sort()).toEqual([2, 3]);
    // no virtual parents were added for either child
    expect(graph.v.length).toBe(6);
  });

  it('takes a parent\'s type from the parent\'s own sex when the type is only "parent"', () => {
    const noSystem = (ref) => ({
      url: 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-parent',
      extension: [{ url: 'type', valueCodeableConcept: { text: 'parent' } }, { url: 'reference', valueReference: { reference: '#' + ref } }],
    });
    const mum = { resourceType: 'FamilyMemberHistory', id: 'Mum', name: 'Mum Test', sex: { text: 'Female' } };
    const dad = { resourceType: 'FamilyMemberHistory', id: 'Dad', name: 'Dad Test', sex: { text: 'Male' } };
    // the child's own sex is text too, and says nothing about its parents
    const kid = { resourceType: 'FamilyMemberHistory', id: 'Kid', name: 'Kid Test', sex: { text: 'male' }, extension: [noSystem('Dad'), noSystem('Mum')] };
    const graph = LegacyFHIRConverter.initFromFHIR(composition(mum, dad, kid));
    expect(graph.properties[0].gender).toBe('F');
    expect(graph.properties[1].gender).toBe('M');
    expect(graph.v.length).toBe(5); // Mum, Dad, Kid, their relationship and childhub
  });
});
