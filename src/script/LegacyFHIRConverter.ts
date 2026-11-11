import BaseGraph, { addPlaceholderChild } from 'pedigree/model/baseGraph';
import validateImportedGraph from 'pedigree/model/validateImportedGraph';
import RelationshipTracker from 'pedigree/model/relationshipTracker';
import { placeParents, chooseParentClaims, leftOutWarning, placedClaims, parentGenderConflict, FETAL_STATUSES } from 'pedigree/model/parentClaims';

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
// HPO mode, and every mode for genes): genenames.org/geneId and hp.fhir from October 2021 (v0.3),
// genenames.org and hp.owl before. Today's defaults differ (hp.owl, hgnc.owl), so these are recognised as well
// as the editor's own.
const LEGACY_PHENOTYPE_SYSTEMS = ['http://purl.obolibrary.org/obo/hp.fhir', 'http://purl.obolibrary.org/obo/hp.owl'];
export const LEGACY_GENE_SYSTEMS = ['http://www.genenames.org/geneId', 'http://www.genenames.org'];
export const HGNC_SYSTEM = 'http://purl.bioontology.org/ontology/HGNC/hgnc.owl';
const HPO_SYSTEM = 'http://purl.obolibrary.org/obo/hp.owl';
const GA4GH_PEDIGREE_PROFILE = 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree';

/**
 * Whether a resource declares the GA4GH pedigree profile. meta.profile is a list of canonical URLs,
 * so whole entries are compared, not substrings.
 */
export function hasGA4GHPedigreeProfile(resource) {
  const profiles = (resource && resource.meta && Array.isArray(resource.meta.profile)) ? resource.meta.profile : [];
  return profiles.some((profile) => profile === GA4GH_PEDIGREE_PROFILE);
}

// How a legacy system's code is coded today: HGNC codes genes by number ("1839" for the legacy
// "HGNC:1839" - anything else isn't an HGNC ID, so isn't translated); hp.owl codes HPO terms as
// hp.fhir did.
const TODAYS_CODE = {
  [HGNC_SYSTEM]: (code) => { const match = /^(?:HGNC:)?(\d+)$/i.exec(code.trim()); return match ? match[1] : null; },
  [HPO_SYSTEM]: (code) => code,
};

/**
 * A code saved in one of a term type's legacy systems. When the editor uses today's system for
 * that type and the code translates into it, it's read through the editor (read) as if saved
 * today, so its saved display names it and it's saved coded again; otherwise it's read as saved.
 */
function readLegacy(codeableConcept, legacySystems, todaysSystem, read) {
  for (const legacySystem of legacySystems) {
    const coding = (codeableConcept.coding || []).find((c) => c.system === legacySystem);
    if (!coding) {
      continue;
    }
    const translate = (typeof coding.code === 'string') ? TODAYS_CODE[todaysSystem] : null;
    const todaysCode = translate ? translate(coding.code) : null;
    return (todaysCode != null) ? read({ coding: [{ ...coding, system: todaysSystem, code: todaysCode }] }) : coding.code;
  }
  return null;
}

// A helper's code system for a term type, if it says (a host's own helper may not).
function helperSystem(helper, getter) {
  return (helper && typeof helper[getter] === 'function') ? helper[getter]() : null;
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

      // as the GA4GH importer: an adoptive parent makes the child adopted, under the adoptive
      // parents; two of a kind are both kept; a parent's code must fit their own gender (checked
      // for the parents placed only - one left out can't fail the import)
      // A parent whose reference can't be resolved (matching nobody, or more than one person) is set
      // aside before placing, so it can't take a real parent's slot - unless they're needed: then
      // the import fails as before, with the reference's own error.
      let ambiguous = new Set();
      let resolves = (node) => {
        try {
          findReferencedPerson(node, 'parent');
          return true;
        } catch (err) {
          if (String(err).indexOf('ambiguous reference') !== -1) {
            ambiguous.add(node);
          }
          return false;
        }
      };
      let fetus = !!newG.properties[personID] && FETAL_STATUSES.indexOf(newG.properties[personID].lifeStatus) !== -1;
      let claims = nextPerson.parentClaims || [];
      let found = claims.filter((c) => resolves(c.node));
      let missing = claims.filter((c) => found.indexOf(c) === -1);
      let unresolved = new Set(missing.map((c) => c.node)).size;
      let chosen = chooseParentClaims(found, fetus);
      let parents = placeParents(chosen.claims, (node) => newG.properties[findReferencedPerson(node, 'parent')].gender);
      let placed = placedClaims(chosen, parents);
      if (missing.length > 0) {
        // needed: one without whom fewer parents are placed than the child has (up to two), or whose
        // absence has another kind of parent (biological, adoptive, step) stand in for the kind the
        // child would have
        let chosenAll = chooseParentClaims(claims, fetus);
        let wanted = Math.min(2, new Set(chosenAll.claims.map((c) => c.node)).size);
        let placedCount = [parents.mother, parents.father].filter(Boolean).length;
        let neededMissing = missing.find((c) => chosenAll.claims.indexOf(c) !== -1);
        let kind = (c) => (c.adoptive ? 'adoptive' : c.step ? 'step' : 'biological');
        let kindsWanted = new Set(chosenAll.claims.map(kind));
        let standsIn = chosen.claims.some((c) => !kindsWanted.has(kind(c)));
        // An ambiguous reference names someone who exists: if they'd be chosen, they're needed (no
        // one else quietly takes their slot).
        let ambiguousChosen = missing.find((c) => ambiguous.has(c.node) && chosenAll.claims.indexOf(c) !== -1);
        if (ambiguousChosen) {
          findReferencedPerson(ambiguousChosen.node, 'parent'); // throws: ambiguous reference
        }
        if (neededMissing && (placedCount < wanted || standsIn)) {
          findReferencedPerson(neededMissing.node, 'parent'); // throws: not a valid reference
        }
      }
      for (const claim of placed.checked) {
        const conflict = parentGenderConflict(claim, newG.properties[findReferencedPerson(claim.node, 'parent')].gender, claim.node);
        if (conflict) {
          throw conflict;
        }
      }
      // (never for a fetus: chooseParentClaims places its biological parents)
      if (chosen.adopted && newG.properties[personID]) {
        newG.properties[personID].isAdopted = true;
      }
      let leftOut = leftOutWarning(chosen, placed.dropped + unresolved);
      if (leftOut) {
        console.warn(leftOut + (unresolved > 0 ? ' (' + unresolved + ' of them a reference that couldn\'t be resolved)' : ''));
      }
      let motherLink = parents.mother ? parents.mother.node : null;
      let fatherLink = parents.father ? parents.father.node : null;

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
      }
      if (motherLink == null) {
        motherID = newG._addVertex(null, Graph.TYPE.PERSON, {
          'gender' : 'F',
          'comments' : 'unknown'
        }, newG.defaultPersonNodeWidth);
      } else {
        motherID = findReferencedPerson(motherLink, 'mother');
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
          let relNode = newG.getRelationshipNode(nextPersonId, partnerId);
          if (!relNode && nextPersonId !== partnerId) {
            // a couple with no shared child: their only child is a placeholder
            // (DynamicPositionedGraph.isPlaceholder)
            addPlaceholderChild(newG, relationshipTracker.createOrGetChildhub(nextPersonId, partnerId), defaultEdgeWeight);
            relNode = newG.getRelationshipNode(nextPersonId, partnerId);
          }
          if (!partnerType.consangr && !partnerType.broken){
            // nothing to set
            continue;
          }

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

    validateImportedGraph(newG);

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
    let motherCodes = [ 'NMTH', 'MTH', 'STPMTH', 'ADOPTM', 'ADOPTMTH' ];
    let fatherCodes = [ 'NFTH', 'FTH', 'STPFTH', 'ADOPTF', 'ADOPTFTH' ];
    // not /g: test() on a global regex starts where its last match ended, so a second parent or
    // twin of the same family member could be missed
    let motherRegex = /mother/i;
    let fatherRegex = /father/i;
    let extensions = familyHistoryResource.extension;
    // each parent as a claim, placed as the GA4GH importer does (placeParents)
    let parentClaims = [];
    let twinCodes = [ 'TWINSIS', 'TWINBRO' ];
    let fraternalTwinCodes = [ 'FTWINSIS', 'FTWINBRO', 'TWIN' ];
    let twinRegex = /twin/i;
    let possibleTwins = null;

    for (let i = 0; i < extensions.length; i++) {
      let ex = extensions[i];
      if (ex.url === 'http://hl7.org/fhir/StructureDefinition/family-member-history-genetics-parent') {
        let type = undefined;
        let ref = undefined;
        let roleCode = '';
        let roleText = '';
        let subExtensions = ex.extension;
        for (let j = 0; j < subExtensions.length; j++) {
          let subEx = subExtensions[j];
          if (subEx.url === 'type') {
            let codings = subEx.valueCodeableConcept.coding || [];
            for (let k = 0; k < codings.length; k++) {
              if (codings[k].system === 'http://terminology.hl7.org/CodeSystem/v3-RoleCode') {
                roleCode = codings[k].code || '';
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
                roleText = roleText + ' ' + codings[k].display;
                if (motherRegex.test(codings[k].display)) {
                  type = 'mother';
                } else if (fatherRegex.test(codings[k].display)) {
                  type = 'father';
                }
              }
            }
            roleText = roleText + ' ' + (subEx.valueCodeableConcept.text || '');
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
        parentClaims.push({
          node: parentId,
          gender: ('mother' === type) ? 'F' : ('father' === type) ? 'M' : null,
          adoptive: /^ADOPT/.test(roleCode) || (!roleCode && /\badoptive\b/i.test(roleText)),
          step: /^STP/.test(roleCode) || (!roleCode && /\bstep[- ]?(mother|father|parent|mom|mum|dad)/i.test(roleText))
        });
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
                ?? readLegacy(concept, LEGACY_GENE_SYSTEMS, helperSystem(fhirTerminologyHelper, 'getGeneSystem'),
                  (c) => fhirTerminologyHelper.getGeneFromCodeableConcept(c, true));
              let phenotype = (gene == null)
                ? (fhirTerminologyHelper.getPhenotypeFromCodeableConcept(concept, true)
                  ?? readLegacy(concept, LEGACY_PHENOTYPE_SYSTEMS, helperSystem(fhirTerminologyHelper, 'getPhenotypeSystem'),
                    (c) => fhirTerminologyHelper.getPhenotypeFromCodeableConcept(c, true)))
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
    // placed in the second pass, once every person (and their gender) is known
    // (pedigree-editor-fetus-and-adoption-fidelity D3)
    result.parentClaims = parentClaims;
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
