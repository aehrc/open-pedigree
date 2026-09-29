import BaseGraph from 'pedigree/model/baseGraph';
import RelationshipTracker from 'pedigree/model/relationshipTracker';

/* ===============================================================================================
 *
 * Reads the "Legacy FHIR" format (fhir_v1): a Composition, or a List, of contained
 * FamilyMemberHistory resources linked by the family-member-history-genetics-* extensions. This
 * is what open-pedigree saved before the GA4GH format replaced it (up to redcap_pedigree_editor
 * v0.3.x). Nothing writes it any more - a pedigree read from it is saved as GA4GH - but pedigrees
 * stored in it must still open. GA4GHFHIRConverter.initFromFHIR hands anything that isn't a GA4GH
 * pedigree to this.
 *
 * Ported from the legacy FHIRConverter.js import code (removed from open-pedigree along with its
 * export code), with its code systems now taken from the editor's FHIR terminology helper, as the
 * GA4GH import does.
 * ===============================================================================================
 */

// Typed loosely: this reads untyped FHIR JSON into BaseGraph, which isn't typed either.
var LegacyFHIRConverter: any = function() {
};
const Graph: any = BaseGraph;

// The phenotype and gene code systems this format was saved with (by redcap_pedigree_editor's
// HPO mode, and every mode for genes). Today's defaults differ (hp.owl, hgnc.owl), so these are
// recognised as well as the editor's own.
const LEGACY_PHENOTYPE_SYSTEM = 'http://purl.obolibrary.org/obo/hp.fhir';
const LEGACY_GENE_SYSTEM = 'http://www.genenames.org/geneId';
const GA4GH_PEDIGREE_PROFILE = 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree';

/**
 * Whether a resource declares the GA4GH pedigree profile. meta.profile is a list of canonical URLs,
 * so whole entries are compared, not substrings.
 */
export function hasGA4GHPedigreeProfile(resource) {
  const profiles = (resource && resource.meta && Array.isArray(resource.meta.profile)) ? resource.meta.profile : [];
  return profiles.some((profile) => profile === GA4GH_PEDIGREE_PROFILE);
}

function codeInSystem(codeableConcept, system) {
  const coding = (codeableConcept.coding || []).find((c) => c.system === system);
  return coding ? coding.code : null;
}

LegacyFHIRConverter.prototype = {};

/**
 * Whether a parsed resource is in the legacy format: a Composition without the GA4GH pedigree
 * profile, or a List.
 */
LegacyFHIRConverter.isLegacyResource = function(inputResource) {
  if (!inputResource) {
    return false;
  }
  if (inputResource.resourceType === 'List') {
    return true;
  }
  return inputResource.resourceType === 'Composition' && !hasGA4GHPedigreeProfile(inputResource);
};

LegacyFHIRConverter.initFromFHIR = function(inputText) {
  let inputResource: any = null;
  try {
    inputResource = JSON.parse(inputText);
  } catch (err) {
    throw 'Unable to import pedigree: input is not a valid JSON string '
      + err;
  }
  let twinTracker: any = { 'nextTwinGroupId' : 0 , 'lookup': {}};

  if (inputResource.resourceType === 'Composition'
      || inputResource.resourceType === 'List') {

    let containedResourcesLookup = {};
    let familyHistoryResources = [];
    if (inputResource.contained) {
      let containedArr = inputResource.contained;
      for (let i = 0; i < containedArr.length; i++) {
        containedResourcesLookup['#' + containedArr[i].id] = containedArr[i];
        if (containedArr[i].resourceType === 'FamilyMemberHistory') {
          familyHistoryResources.push(containedArr[i]);
        }
      }
    }
    let subjectRef = inputResource.subject;
    let subjectResource = null;
    if (subjectRef && subjectRef.reference
        && subjectRef.reference[0] === '#') {
      // we have a contained patient
      subjectResource = containedResourcesLookup[subjectRef.reference];
    }
    let newG = new Graph();

    let nameToID = {};
    let externalIDToID = {};
    let ambiguousReferences = {};
    let hasID = {};

    let nodeData = [];
    // first pass: add all vertices and assign vertex IDs
    for (let i = 0; i < familyHistoryResources.length; i++) {
      let nextPerson = this.extractDataFromFMH(familyHistoryResources[i],
        subjectResource, containedResourcesLookup, twinTracker);
      nodeData.push(nextPerson);

      if (!nextPerson.properties.hasOwnProperty('id')
          && !nextPerson.properties.hasOwnProperty('fName')
          && !nextPerson.properties.hasOwnProperty('externalId')) {
        throw 'Unable to import pedigree: a node with no ID or name is found';
      }

      let pedigreeID = newG._addVertex(null, Graph.TYPE.PERSON, nextPerson.properties,
        newG.defaultPersonNodeWidth);

      if (nextPerson.properties.id) {
        if (externalIDToID.hasOwnProperty(nextPerson.properties.id)) {
          throw 'Unable to import pedigree: multiple persons with the same ID ['
            + nextPerson.properties.id + ']';
        }
        if (nameToID.hasOwnProperty(nextPerson.properties.id)
            && nameToID[nextPerson.properties.id] !== pedigreeID) {
          delete nameToID[nextPerson.properties.id];
          ambiguousReferences[nextPerson.properties.id] = true;
        } else {
          externalIDToID[nextPerson.properties.id] = pedigreeID;
          hasID[nextPerson.properties.id] = true;
        }
      }
      if (nextPerson.properties.fName) {
        if (nameToID.hasOwnProperty(nextPerson.properties.fName)
            && nameToID[nextPerson.properties.fName] !== pedigreeID) {
          // multiple nodes have this first name
          delete nameToID[nextPerson.properties.fName];
          ambiguousReferences[nextPerson.properties.fName] = true;
        } else if (externalIDToID
          .hasOwnProperty(nextPerson.properties.fName)
            && externalIDToID[nextPerson.properties.fName] !== pedigreeID) {
          // some other node has this name as an ID
          delete externalIDToID[nextPerson.properties.fName];
          ambiguousReferences[nextPerson.properties.fName] = true;
        } else {
          nameToID[nextPerson.properties.fName] = pedigreeID;
        }
      }
      // only use externalID if id is not present
      if (nextPerson.properties.hasOwnProperty('externalId')
          && !hasID.hasOwnProperty(pedigreeID)) {
        externalIDToID[nextPerson.properties.externalId] = pedigreeID;
        hasID[pedigreeID] = true;
      }
    }

    let getPersonID = function(person) {
      if (person.properties.hasOwnProperty('id')) {
        return externalIDToID[person.properties.id];
      }

      if (person.properties.hasOwnProperty('fName')) {
        return nameToID[person.properties.fName];
      }
    };

    let findReferencedPerson = function(reference, refType) {
      if (ambiguousReferences.hasOwnProperty(reference)) {
        throw 'Unable to import pedigree: ambiguous reference to ['
          + reference + ']';
      }

      if (externalIDToID.hasOwnProperty(reference)) {
        return externalIDToID[reference];
      }

      if (nameToID.hasOwnProperty(reference)) {
        return nameToID[reference];
      }

      throw 'Unable to import pedigree: ['
        + reference
        + '] is not a valid '
        + refType
        + ' reference (does not correspond to a name or an ID of another person)';
    };

    let defaultEdgeWeight = 1;

    let relationshipTracker = new RelationshipTracker(newG,
      defaultEdgeWeight);

    // second pass (once all vertex IDs are known): process parents/children & add edges
    for (let i = 0; i < nodeData.length; i++) {
      let nextPerson = nodeData[i];

      let personID = getPersonID(nextPerson);

      let motherLink = nextPerson.hasOwnProperty('mother') ? nextPerson['mother']
        : null;
      let fatherLink = nextPerson.hasOwnProperty('father') ? nextPerson['father']
        : null;

      if (motherLink == null && fatherLink == null) {
        continue;
      }

      // create a virtual parent in case one of the parents is missing
      let fatherID = null;
      let motherID = null;
      if (fatherLink == null) {
        fatherID = newG._addVertex(null, Graph.TYPE.PERSON, {
          'gender' : 'M',
          'comments' : 'unknown'
        }, newG.defaultPersonNodeWidth);
      } else {
        fatherID = findReferencedPerson(fatherLink, 'father');
        if (newG.properties[fatherID].gender === 'F') {
          throw 'Unable to import pedigree: a person declared as female is also declared as being a father ('
            + fatherLink + ')';
        }
      }
      if (motherLink == null) {
        motherID = newG._addVertex(null, Graph.TYPE.PERSON, {
          'gender' : 'F',
          'comments' : 'unknown'
        }, newG.defaultPersonNodeWidth);
      } else {
        motherID = findReferencedPerson(motherLink, 'mother');
        if (newG.properties[motherID].gender === 'M') {
          throw 'Unable to import pedigree: a person declared as male is also declared as being a mother ('
            + motherLink + ')';
        }
      }

      if (fatherID === personID || motherID === personID) {
        throw 'Unable to import pedigree: a person is declared to be his or hew own parent';
      }

      // both motherID and fatherID are now given and represent valid existing nodes in the pedigree

      // if there is a relationship between motherID and fatherID the corresponding childhub is returned
      // if there is no relationship, a new one is created together with the chldhub
      let chhubID = relationshipTracker.createOrGetChildhub(motherID,
        fatherID);

      newG.addEdge(chhubID, personID, defaultEdgeWeight);
    }


    for (const nextPerson of nodeData){
      if (nextPerson.partners){
        let nextPersonId = getPersonID(nextPerson);
        for (let i=0; i < nextPerson.partners.length; i++){
          // (Both partners usually carry the extension; setting the same flags twice is harmless.)
          const partnerId = findReferencedPerson(nextPerson.partners[i].ref, 'partner');
          const partnerType = nextPerson.partners[i].type;
          if (!partnerType.consangr && !partnerType.broken){
            // nothing to set
            continue;
          }

          let relNode = newG.getRelationshipNode(nextPersonId, partnerId);
          if (relNode){
            let relProperties = newG.properties[relNode];
            if (partnerType.consangr){
              if (relProperties['consangr'] !== 'Y'){
                relProperties['consangr'] = 'Y';
                // check if we can make it 'A'
                let nextGreatGrandParents = newG.getParentGenerations(nextPersonId, 3);
                let partnerGreatGrandParents = newG.getParentGenerations(partnerId, 3);
                for (let elem of nextGreatGrandParents) {
                  if (partnerGreatGrandParents.has(elem)) {
                    // found common
                    relProperties['consangr'] = 'A';
                    break;
                  }
                }
              }
            }
            if (partnerType.broken){
              relProperties['broken'] = true;
            }
          }
        }
      }
    }

    newG.validate();

    return newG;
  } else {

    throw 'Unable to import pedigree: input is not a resource type we understand';
  }

};

LegacyFHIRConverter.extractDataFromFMH = function(familyHistoryResource,
  subjectResource, containedResourcesLookup, twinTracker) {
  let properties: any = {};
  let result: any = {
    'properties' : properties
  };

  properties.id = familyHistoryResource.id;
  properties.gender = 'U';

  let lookForTwins = true;
  if (twinTracker.lookup.hasOwnProperty(properties.id)){
    let twinDataForThisNode = twinTracker.lookup[properties.id];
    properties.twinGroup = twinDataForThisNode.twinGroup;
    if (twinDataForThisNode.hasOwnProperty('monozygotic')){
      properties.monozygotic = twinDataForThisNode.monozygotic;
    }
    lookForTwins = false;
  }

  if (familyHistoryResource.sex) {
    let foundCode = false;
    if (familyHistoryResource.sex.coding) {
      let codings = familyHistoryResource.sex.coding;
      for (let i = 0; i < codings.length; i++) {
        if (codings[i].system === 'http://hl7.org/fhir/administrative-gender') {
          foundCode = true;
          if (codings[i].code === 'male') {
            properties.gender = 'M';
          }
          if (codings[i].code === 'female') {
            properties.gender = 'F';
          }
          break;
        }
      }
    }
    if (!foundCode && familyHistoryResource.sex.text) {
      if (familyHistoryResource.sex.text.toLowerCase() === 'male') {
        properties.gender = 'M';
      } else if (familyHistoryResource.sex.text.toLowerCase() === 'female') {
        properties.gender = 'F';
      }
    }
  }
  if (familyHistoryResource.name) {
    // everything but the last word is the first name
    // a trailing '(name)' will be taken as last name at birth
    let nameSplitter = /^(.*?)( ([^ (]*)) ?(\(([^)]*)\))?$/;
    let nameSplit = nameSplitter.exec(familyHistoryResource.name);
    if (nameSplit == null) {
      properties.fName = familyHistoryResource.name;
    } else {
      properties.fName = nameSplit[1];
      properties.lName = nameSplit[3];
      if (nameSplit[5]) {
        properties.lNameAtB = nameSplit[5];
      }
    }
  }

  if (familyHistoryResource.identifier){
    for (let i = 0; i < familyHistoryResource.identifier.length; i++) {
      if (familyHistoryResource.identifier[i].system === 'https://github.com/phenotips/open-pedigree?externalID'){
        properties.externalID = familyHistoryResource.identifier[i].value;
        break;
      }
    }
  }
  let dateSplitter = /([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2]|[1-9])(-(0[1-9]|[1-2][0-9]|3[0-1]|[1-9]))?)?/;
  if (familyHistoryResource.bornDate) {
    let bornDateSplit = dateSplitter.exec(familyHistoryResource.bornDate);
    if (bornDateSplit == null) {
      // failed to parse the data
    } else {
      let year = bornDateSplit[1];
      let month = (bornDateSplit[5]) ? bornDateSplit[5] : '01';
      let day = (bornDateSplit[7]) ? bornDateSplit[7] : '01';
      properties.dob = month + '/' + day + '/' + year;
    }
  }
  if (familyHistoryResource.deceasedDate) {
    let deceasedDateSplit = dateSplitter.exec(familyHistoryResource.deceasedDate);
    if (deceasedDateSplit == null) {
      // failed to parse the data
    } else {
      let year = deceasedDateSplit[1];
      let month = (deceasedDateSplit[5]) ? deceasedDateSplit[5] : '01';
      let day = (deceasedDateSplit[7]) ? deceasedDateSplit[7] : '01';
      properties.dod = month + '/' + day + '/' + year;
    }
  }

  if (familyHistoryResource.deceasedString) {
    let deceasedSplitter = /(stillborn|miscarriage|aborted|unborn)( ([1-9][0-9]?) weeks)?/;
    let deceasedSplit = deceasedSplitter.exec(familyHistoryResource.deceasedString);
    if (deceasedSplit == null) {
      // not something we understand
      properties.lifeStatus = 'deceased';
    } else {
      properties.lifeStatus = deceasedSplit[1];
      if (deceasedSplit[3]){
        properties.gestationAge = deceasedSplit[3];
      }
    }
  }
  if (familyHistoryResource.deceasedBoolean) {
    properties.lifeStatus = 'deceased';
  }

  if (familyHistoryResource.note && familyHistoryResource.note[0].text) {
    properties.comments = familyHistoryResource.note[0].text;
  }

  let fhirTerminologyHelper = editor.getFhirTerminologyHelper();

  if (familyHistoryResource.condition) {
    let disorders = [];
    for (let i = 0; i < familyHistoryResource.condition.length; i++) {
      let condition = familyHistoryResource.condition[i].code;
      if (condition && condition.coding) {
        // the code in the editor's disorder code system, else the first coding's code if it has a
        // display, else the text
        let disorder = fhirTerminologyHelper.getDisorderFromCodeableConcept(condition, true);
        if (disorder != null) {
          disorders.push(disorder);
          continue;
        }
        let firstCoding = condition.coding[0];
        if (firstCoding && firstCoding.display) {
          disorders.push(firstCoding.code);
          continue;
        }
      }
      if (condition && condition.text) {
        disorders.push(condition.text);
      }
    }
    properties.disorders = disorders;
  }

  if (familyHistoryResource.extension) {
    let motherCodes = [ 'NMTH', 'MTH', 'STPMTH', 'ADOPTM' ];
    let fatherCodes = [ 'NFTH', 'FTH', 'STPFTH', 'ADOPTF' ];
    // not /g: test() on a global regex starts where its last match ended, so a second parent or
    // twin of the same family member could be missed
    let motherRegex = /mother/i;
    let fatherRegex = /father/i;
    let extensions = familyHistoryResource.extension;
    let possibleMother = [];
    let possibleFather = [];
    let possibleParent = [];
    let twinCodes = [ 'TWINSIS', 'TWINBRO' ];
    let fraternalTwinCodes = [ 'FTWINSIS', 'FTWINBRO', 'TWIN' ];
    let twinRegex = /twin/i;
    let possibleTwins = null;

    for (let i = 0; i < extensions.length; i++) {
      let ex = extensions[i];
      if (ex.url === 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-parent') {
        let type = undefined;
        let ref = undefined;
        let subExtensions = ex.extension;
        for (let j = 0; j < subExtensions.length; j++) {
          let subEx = subExtensions[j];
          if (subEx.url === 'type') {
            let codings = subEx.valueCodeableConcept.coding || [];
            for (let k = 0; k < codings.length; k++) {
              if (codings[k].system === 'http://terminology.hl7.org/CodeSystem/v3-RoleCode') {
                if (motherCodes.includes(codings[k].code)) {
                  type = 'mother';
                } else if (fatherCodes
                  .includes(codings[k].code)) {
                  type = 'father';
                } else {
                  type = 'parent';
                }
                break;
              } else if (codings[k].display) {
                if (motherRegex.test(codings[k].display)) {
                  type = 'mother';
                } else if (fatherRegex.test(codings[k].display)) {
                  type = 'father';
                }
              }
            }
            if (type == null && subEx.valueCodeableConcept.text) {
              if (motherRegex
                .test(subEx.valueCodeableConcept.text)) {
                type = 'mother';
              } else if (fatherRegex
                .test(subEx.valueCodeableConcept.text)) {
                type = 'father';
              }
            }
            if (!type) {
              type = 'parent';
            }
          } else if (subEx.url === 'reference') {
            ref = subEx.valueReference.reference;
          }
        }
        if (ref == null) {
          // we didn't find the reference (continue, not break: the extensions after it still count)
          continue;
        }
        if (type == null || 'parent' === type ) {
          // check the reference entity for a gender
          if (containedResourcesLookup[ref]) {
            let parentResource = containedResourcesLookup[ref];
            if (parentResource.sex) {
              let foundCode = false;
              if (parentResource.sex.coding) {
                let codings = parentResource.sex.coding;
                for (let c = 0; c < codings.length; c++) {
                  if (codings[c].system === 'http://hl7.org/fhir/administrative-gender') {
                    foundCode = true;
                    if (codings[c].code === 'male') {
                      type = 'father';
                    }
                    if (codings[c].code === 'female') {
                      type = 'mother';
                    }
                    break;
                  }
                }
              }
              if (!foundCode && parentResource.sex.text) {
                if (parentResource.sex.text
                  .toLowerCase() === 'male') {
                  type = 'father';
                } else if (parentResource.sex.text
                  .toLowerCase() === 'female') {
                  type = 'mother';
                }
              }
            }
          }
        }
        let parentId = ref.substring(1); // remove leading #
        if ('mother' === type) {
          possibleMother.push(parentId);
        } else if ('father' === type) {
          possibleFather.push(parentId);
        } else {
          possibleParent.push(parentId);
        }
      } else if (ex.url === 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-sibling') {
        let type = undefined;
        let ref = undefined;
        let subExtensions = ex.extension;
        for (let j = 0; j < subExtensions.length; j++) {
          let subEx = subExtensions[j];
          if (subEx.url === 'type') {
            let codings = subEx.valueCodeableConcept.coding || [];
            for (let k = 0; k < codings.length; k++) {
              if (codings[k].system === 'http://terminology.hl7.org/CodeSystem/v3-RoleCode') {
                if (twinCodes.includes(codings[k].code)) {
                  type = 'twin';
                } else if (fraternalTwinCodes
                  .includes(codings[k].code)) {
                  type = 'ftwin';
                } else {
                  type = 'sibling';
                }
                break;
              } else if (codings[k].display) {
                if (twinRegex.test(codings[k].display)) {
                  type = 'ftwin';
                }
              }
            }
            if (type == null && subEx.valueCodeableConcept.text) {
              if (twinRegex.test(subEx.valueCodeableConcept.text)) {
                type = 'ftwin';
              }
            }
            if (!type) {
              type = 'sibling';
            }
          } else if (subEx.url === 'reference') {
            ref = subEx.valueReference.reference;
          }
        }
        if (!ref || !type || 'sibling' === type) {
          // we didn't find the reference or its a sibling not a twin
          continue;
        }
        if (possibleTwins == null){
          possibleTwins = {};
        }
        possibleTwins[ref] = type;
      } else if (ex.url === 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-partner') {
        let type = undefined;
        let ref = undefined;
        let subExtensions = ex.extension;
        for (let j = 0; j < subExtensions.length; j++) {
          let subEx = subExtensions[j];
          if (subEx.url === 'type') {
            let codings = subEx.valueCodeableConcept.coding || [];
            for (let k = 0; k < codings.length; k++) {
              if (codings[k].system === 'http://purl.org/ga4gh/kin.fhir') {
                let code = codings[k].code;
                let isConsang = (code === 'KIN:030' || code === 'KIN:049');
                let isBroken = (code === 'KIN:048' || code === 'KIN:049');
                type = {consangr: isConsang, broken: isBroken};
                break;
              }
            }
          } else if (subEx.url === 'reference') {
            ref = subEx.valueReference.reference;
          }
        }
        if (!ref || !type) {
          // we didn't find the reference or the partnership type
          continue;
        }
        ref = ref.substring(1); // remove leading #
        if (result.hasOwnProperty('partners')){
          result.partners.push({ref: ref, type: type});
        } else {
          result.partners= [{ref: ref, type: type}];
        }
      } else if (ex.url === 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-observation') {
        let observationRef = ex.valueReference.reference;
        let observationResource = containedResourcesLookup[observationRef];
        if (observationResource) {
          let clinical = 'fmh_clinical';
          let genes = 'fmh_genes';
          let carrierOb = 'fmh_carrierStatus';
          let childlessOb = 'fmh_childlessStatus';
          let isSympton = false;
          let isGene = false;
          let value = null;
          if (observationResource.id.substring(0, carrierOb.length) === carrierOb) {
            if (observationResource.valueCodeableConcept){
              for (let cIndex = 0; cIndex < observationResource.valueCodeableConcept.coding.length; cIndex++){
                let coding = observationResource.valueCodeableConcept.coding[cIndex];
                if (coding.system === 'http://snomed.info/sct' && coding.code === '87955000'){
                  properties['carrierStatus'] =  'carrier';
                  break;
                }
                if (coding.system === 'http://snomed.info/sct' && coding.code === '24800002'){
                  properties['carrierStatus'] =  'presymptomatic';
                  break;
                }
              }
            }
          } else if (observationResource.id.substring(0, childlessOb.length) === childlessOb){
            if (observationResource.code){
              for (let cIndex = 0; cIndex < observationResource.code.coding.length; cIndex++){
                let coding = observationResource.code.coding[cIndex];
                if (coding.system === 'http://snomed.info/sct' && coding.code === '8619003'){
                  properties['childlessStatus'] =  'infertile';
                  break;
                }
                if (coding.system === 'http://snomed.info/sct' && coding.code === '224118004'
                    && observationResource.valueInteger === 0){
                  properties['childlessStatus'] =  'childless';
                  break;
                }
              }
            }
          } else {
            if (observationResource.id.substring(0, clinical.length) === clinical) {
              isSympton = true;
            } else if (observationResource.id.substring(0, genes.length) === genes) {
              isGene = true;
            }
            if (observationResource.valueString){
              value = observationResource.valueString;
            } else if (observationResource.valueCodeableConcept){
              // a code in a gene or phenotype code system says which it is
              let concept = observationResource.valueCodeableConcept;
              let gene = fhirTerminologyHelper.getGeneFromCodeableConcept(concept, true)
                ?? codeInSystem(concept, LEGACY_GENE_SYSTEM);
              let phenotype = (gene == null)
                ? (fhirTerminologyHelper.getPhenotypeFromCodeableConcept(concept, true)
                  ?? codeInSystem(concept, LEGACY_PHENOTYPE_SYSTEM))
                : null;
              if (gene != null) {
                isGene = true;
                value = gene;
              } else if (phenotype != null) {
                isSympton = true;
                value = phenotype;
              }
              if (value == null && observationResource.valueCodeableConcept.text){
                value = observationResource.valueCodeableConcept.text;
              }
            }
            if (value != null) {
              if (isSympton) {
                if (!properties.hpoTerms) {
                  properties.hpoTerms = [];
                }
                properties.hpoTerms.push(value);
              } else if (isGene) {
                if (!properties.candidateGenes) {
                  properties.candidateGenes = [];
                }
                properties.candidateGenes.push(value);
              }
            }
          }
        } else {
          console.log('Failed to find resource', observationRef, properties);
        }
      }
    }
    if (possibleMother.length === 1) {
      result.mother = possibleMother[0];
    }
    if (possibleFather.length === 1) {
      result.father = possibleFather[0];
    }
    if (!result.father && possibleMother.length > 1) {
      result.father = possibleMother[1];
    }
    if (!result.mother && possibleFather.length > 1) {
      result.mother = possibleFather[1];
    }
    if (possibleParent.length > 0) {
      if (!result.mother) {
        result.mother = possibleParent[0];
      } else if (!result.father) {
        result.father = possibleParent[0];
      }
    }
    if (possibleParent.length > 1) {
      if (!result.mother) {
        result.mother = possibleParent[1];
      } else if (!result.father) {
        result.father = possibleParent[1];
      }
    }
    if (lookForTwins && possibleTwins != null){
      // the group is fraternal if any of its twins is
      let isFraternal = false;
      let twinsToAdd = [];
      for (let key in possibleTwins){
        if (!containedResourcesLookup[key]){
          // don't check references we can't find
          continue;
        }
        twinsToAdd.push(containedResourcesLookup[key].id);
        if (possibleTwins[key] === 'ftwin'){
          isFraternal = true;
        }
      }
      if (twinsToAdd.length > 0){
        // we found some twins
        let twinGroup = twinTracker.nextTwinGroupId;
        twinTracker.nextTwinGroupId = twinTracker.nextTwinGroupId + 1;
        properties.twinGroup = twinGroup;
        if (!isFraternal){
          properties.monozygotic = true;
        }
        for (let i = 0; i < twinsToAdd.length; i++){
          let twinData: any = { twinGroup: twinGroup};
          if (!isFraternal){
            twinData.monozygotic = true;
          }
          twinTracker.lookup[twinsToAdd[i]] = twinData;
        }
      }
    }
  }

  if (familyHistoryResource.relationship
      && familyHistoryResource.relationship.coding
      && familyHistoryResource.relationship.coding.some((c) => c.code === 'ONESELF')) {
    // this is the patient, use the subject resource if we have one
    if (subjectResource) {
      if (subjectResource.gender === 'male') {
        properties.gender = 'M';
      } else if (subjectResource.gender === 'female') {
        properties.gender = 'F';
      }
    }
  }

  return result;
};

export default LegacyFHIRConverter;
