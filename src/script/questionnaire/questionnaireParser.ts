export const MAPPING_EXTENSION_URL = 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping';

// FHIR StructureDefinition canonical URLs used in item.definition for mapsToField items.
// Patient.* targets are real, resolvable Patient elements. PedigreeIndividual.* targets don't
// correspond to any single real Patient element (they become fixed-code Observations, or drive
// several Patient fields/extensions at once in GA4GHFHIRConverter) - item.definition permits
// pointing at a self-hosted logical model just as readily as a published FHIR resource
// (see https://hl7.org/fhir/R4/questionnaire-definitions.html#Questionnaire.item.definition),
// so this documents our own model's shape rather than misrepresenting these as Patient elements.
const PATIENT_SD = 'http://hl7.org/fhir/StructureDefinition/Patient';
const PEDIGREE_INDIVIDUAL_SD = 'https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual';

// Keyed by the terminal (last '.') segment of the item.definition fragment - e.g.
// ".../Patient#Patient.name.given" matches on "given" - so it doesn't matter whether an
// implementer's definition points at the real Patient SD or our PedigreeIndividual one.
// propertyBagKey is the key this property is stored under in Person.getProperties() / the
// graph model's properties bag (pedigree.GG.properties[index]) - used by GA4GHFHIRConverter,
// which only ever sees the plain properties bag, never a live Person instance.
export const MAPS_TO_FIELD_TARGETS: any = {
  'gender':           { propertyBagKey: 'gender' },
  'given':            { propertyBagKey: 'fName' },
  'family':           { propertyBagKey: 'lName' },
  'identifier':       { propertyBagKey: 'externalID' },
  'birthDate':        { propertyBagKey: 'dob' },
  'deceasedDateTime': { propertyBagKey: 'dod' },
  'lifeStatus':        { propertyBagKey: 'lifeStatus' },
  'gestationAge':      { propertyBagKey: 'gestationAge' },
  'carrierStatus':     { propertyBagKey: 'carrierStatus' },
  'comments':          { propertyBagKey: 'comments' }
};

// Reference item.definition values for each supported mapsToField target, for use by
// implementers and fixtures. Patient.* are real Patient elements; PedigreeIndividual.* are
// this library's own logical model (see MAPS_TO_FIELD_TARGETS comment above).
export const MAPS_TO_FIELD_DEFINITIONS: any = {
  'gender':           PATIENT_SD + '#Patient.gender',
  'given':            PATIENT_SD + '#Patient.name.given',
  'family':           PATIENT_SD + '#Patient.name.family',
  'identifier':       PATIENT_SD + '#Patient.identifier',
  'birthDate':        PATIENT_SD + '#Patient.birthDate',
  'deceasedDateTime': PATIENT_SD + '#Patient.deceasedDateTime',
  'lifeStatus':       PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.lifeStatus',
  'gestationAge':     PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.gestationAge',
  'carrierStatus':    PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.carrierStatus',
  'comments':         PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.comments'
};

const SUPPORTED_ITEM_TYPES = ['string', 'text', 'boolean', 'date', 'integer', 'decimal', 'choice', 'open-choice', 'group'];

function itemTypeToFieldType(item: any): any {
  switch (item.type) {
  case 'string':
    return 'text';
  case 'text':
    return 'textarea';
  case 'boolean':
    return 'checkbox';
  case 'date':
    return 'date-picker';
  case 'integer':
  case 'decimal':
    return 'number';
  case 'choice':
  case 'open-choice':
    return item.answerValueSet ? 'questionnaire-choice-picker' : 'select';
  case 'group':
    return 'heading';
  default:
    return null;
  }
}

function terminalDefinitionSegment(definition: any): any {
  if (!definition) {
    return null;
  }
  const fragment = definition.split('#')[1];
  if (!fragment) {
    return null;
  }
  const segments = fragment.split('.');
  return segments[segments.length - 1];
}

function parseMappingExtension(item: any): any {
  if (!item.extension) {
    return null;
  }
  const mappingExt = item.extension.find((ext: any) => ext.url === MAPPING_EXTENSION_URL);
  const kind = mappingExt && mappingExt.valueCode;
  if (!kind) {
    return null;
  }

  if (kind === 'mapsToField') {
    if (item.type === 'group') {
      console.warn('Questionnaire item ' + item.linkId + ' is a group and cannot declare mapsToField - ignoring mapping');
      return null;
    }
    const target = terminalDefinitionSegment(item.definition);
    if (!target || !MAPS_TO_FIELD_TARGETS.hasOwnProperty(target)) {
      console.warn('Questionnaire item ' + item.linkId + ' declares mapsToField but item.definition ("' + item.definition + '") does not resolve to a supported property - ignoring mapping');
      return null;
    }
    return { kind: 'field', field: target };
  }

  if (kind === 'mapsToCondition' || kind === 'mapsToObservation') {
    if (item.type === 'group') {
      console.warn('Questionnaire item ' + item.linkId + ' is a group and cannot declare ' + kind + ' - ignoring mapping');
      return null;
    }
    if (!item.code || item.code.length === 0) {
      console.warn('Questionnaire item ' + item.linkId + ' declares ' + kind + ' but has no item.code - ignoring mapping');
      return null;
    }
    return { kind: kind === 'mapsToCondition' ? 'condition' : 'observation', code: { coding: item.code } };
  }

  console.warn('Questionnaire item ' + item.linkId + ' declares an unrecognised mapping kind "' + kind + '" - ignoring mapping');
  return null;
}

function parseAnswerOptions(item: any): any {
  if (!item.answerOption) {
    return undefined;
  }
  return item.answerOption.map((opt: any) => {
    if (opt.hasOwnProperty('valueCoding')) {
      return { value: opt.valueCoding.code, display: opt.valueCoding.display || opt.valueCoding.code };
    }
    if (opt.hasOwnProperty('valueString')) {
      return { value: opt.valueString, display: opt.valueString };
    }
    if (opt.hasOwnProperty('valueInteger')) {
      return { value: opt.valueInteger, display: String(opt.valueInteger) };
    }
    return { value: undefined, display: '' };
  });
}

function walkItems(items: any, out: any): void {
  for (const item of items) {
    if (!item.linkId) {
      continue;
    }
    const fieldType = itemTypeToFieldType(item);
    if (fieldType === null) {
      console.warn('Questionnaire item ' + item.linkId + ' has unsupported type "' + item.type + '" - skipping');
      continue;
    }

    const parsed: any = {
      linkId: item.linkId,
      label: item.text || item.linkId,
      itemType: item.type,
      fieldType: fieldType,
      repeats: !!item.repeats,
      answerValueSet: item.answerValueSet,
      answerOption: parseAnswerOptions(item),
      enableWhen: item.enableWhen,
      enableBehavior: item.enableBehavior || 'all',
      mapping: parseMappingExtension(item)
    };
    out.push(parsed);

    if (item.item && item.item.length > 0) {
      walkItems(item.item, out);
    }
  }
}

export function parseQuestionnaire(questionnaire: any): any {
  const items: any[] = [];
  walkItems(questionnaire.item || [], items);

  let canonicalUrl = questionnaire.url;
  if (canonicalUrl && questionnaire.version) {
    canonicalUrl = canonicalUrl + '|' + questionnaire.version;
  }

  return {
    canonicalUrl: canonicalUrl,
    items: items
  };
}

export function isSupportedItemType(type: any): boolean {
  return SUPPORTED_ITEM_TYPES.indexOf(type) >= 0;
}
