export const MAPPING_EXTENSION_URL = 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping';
export const PREDICATE_EXTENSION_URL = 'https://github.com/aehrc/open-pedigree/questionnaire-enable-predicate';
export const ACTION_EXTENSION_URL = 'https://github.com/aehrc/open-pedigree/questionnaire-action';
export const SUPPORTED_ACTIONS = ['linkPatient', 'importClinicalData'];

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
// getter/setter name every mapsToField target's real Person property. Used by generateNodeMenu()
// to wire the field descriptor's 'function', and by Person.getSummary() to read the current value.
export const MAPS_TO_FIELD_TARGETS: any = {
  'gender':           { propertyBagKey: 'gender',        getter: 'getGender',          setter: 'setGender' },
  'given':            { propertyBagKey: 'fName',         getter: 'getFirstName',       setter: 'setFirstName' },
  'family':           { propertyBagKey: 'lName',         getter: 'getLastName',        setter: 'setLastName' },
  'identifier':       { propertyBagKey: 'externalID',    getter: 'getExternalID',      setter: 'setExternalID' },
  'birthDate':        { propertyBagKey: 'dob',           getter: 'getBirthDate',       setter: 'setBirthDate' },
  'deceasedDateTime': { propertyBagKey: 'dod',           getter: 'getDeathDate',       setter: 'setDeathDate' },
  'lifeStatus':        { propertyBagKey: 'lifeStatus',     getter: 'getLifeStatus',      setter: 'setLifeStatus' },
  'gestationAge':      { propertyBagKey: 'gestationAge',   getter: 'getGestationAge',    setter: 'setGestationAge' },
  'carrierStatus':     { propertyBagKey: 'carrierStatus',  getter: 'getCarrierStatus',   setter: 'setCarrierStatus' },
  'comments':          { propertyBagKey: 'comments',       getter: 'getComments',        setter: 'setComments' },
  'childlessStatus':   { propertyBagKey: 'childlessStatus', getter: 'getChildlessStatus', setter: 'setChildlessStatus' },
  'isAdopted':         { propertyBagKey: 'isAdopted',      getter: 'getAdopted',         setter: 'setAdopted' },
  'monozygotic':       { propertyBagKey: 'monozygotic',    getter: 'getMonozygotic',     setter: 'setMonozygotic' },
  'evaluated':         { propertyBagKey: 'evaluated',      getter: 'getEvaluated',       setter: 'setEvaluated' },
  'lostContact':       { propertyBagKey: 'lostContact',    getter: 'getLostContact',     setter: 'setLostContact' }
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
  'comments':         PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.comments',
  'childlessStatus':  PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.childlessStatus',
  'isAdopted':        PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.isAdopted',
  'monozygotic':      PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.monozygotic',
  'evaluated':        PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.evaluated',
  'lostContact':      PEDIGREE_INDIVIDUAL_SD + '#PedigreeIndividual.lostContact'
};

const SUPPORTED_ITEM_TYPES = ['string', 'text', 'boolean', 'date', 'integer', 'decimal', 'choice', 'open-choice', 'group'];

// The three legend-backed fields that exist independently of the Questionnaire mechanism
// (DisorderLegend/GeneLegend/PhenotypeLegend, configured via disorderOptions/geneOptions/
// phenotypeOptions). The built-in default Questionnaire declares these under the SAME linkIds
// so they keep using their existing terminology config, real Person setters/getters (which
// carry disorders-specific business logic - e.g. the "affected" auto-removal rule - that a
// generic legend item doesn't have), and existing GA4GH Condition/Observation generation
// (addConditions/addObservations), rather than the generic per-linkId mechanism built for a
// genuinely new implementer-defined legend field. See design D15's Risks section.
export const RESERVED_LEGEND_TARGETS: any = {
  'disorders':       { propertyBagKey: 'disorders',     setter: 'setDisorders', getter: 'getDisorders',    ccMethod: 'getCodeableConceptFromDisorder' },
  'candidate_genes': { propertyBagKey: 'candidateGenes', setter: 'setGenes',     getter: 'getGenes',        ccMethod: 'getCodeableConceptFromGene' },
  'hpo_positive':    { propertyBagKey: 'hpoTerms',       setter: 'setHPO',       getter: 'getPhenotypes',   ccMethod: 'getCodeableConceptFromPhenotype' }
};

// Standard FHIR extension for a rendering hint (radio buttons vs a dropdown) on an inline
// answerOption choice item - https://hl7.org/fhir/R4/extension-questionnaire-itemcontrol.html.
// Unlike the mapping/predicate/action extensions, this one IS drawn from the FHIR spec, since
// FHIR already has a standard way to express it.
const ITEM_CONTROL_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
const ITEM_CONTROL_SYSTEM = 'http://hl7.org/fhir/questionnaire-item-control';

function hasRadioItemControl(item: any): boolean {
  if (!item.extension) {
    return false;
  }
  const ext = item.extension.find((e: any) => e.url === ITEM_CONTROL_EXTENSION_URL);
  const coding = ext && ext.valueCodeableConcept && ext.valueCodeableConcept.coding;
  return !!(coding && coding.some((c: any) => c.system === ITEM_CONTROL_SYSTEM && c.code === 'radio-button'));
}

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
    // A non-standard `item.range` sibling property (see the disablingPredicate/columns
    // properties below) opts into rendering as a bounded numeric dropdown (NodeMenu's
    // 'select' + range) instead of a free-entry number field - needed to reproduce
    // gestation_age's existing widget exactly (see defaultQuestionnaire.ts).
    return item.range ? 'select' : 'number';
  case 'decimal':
    return 'number';
  case 'choice':
  case 'open-choice':
    if (item.answerValueSet) {
      return 'questionnaire-choice-picker';
    }
    return hasRadioItemControl(item) ? 'radio' : 'select';
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

  if (kind === 'mapsToLegendCondition' || kind === 'mapsToLegendObservation') {
    if (item.type === 'group') {
      console.warn('Questionnaire item ' + item.linkId + ' is a group and cannot declare ' + kind + ' - ignoring mapping');
      return null;
    }
    if (!item.repeats || (item.type !== 'choice' && item.type !== 'open-choice') || !item.answerValueSet) {
      console.warn('Questionnaire item ' + item.linkId + ' declares ' + kind + ' but is not a repeats=true choice/open-choice item with an answerValueSet - ignoring mapping');
      return null;
    }
    return { kind: kind === 'mapsToLegendCondition' ? 'legendCondition' : 'legendObservation' };
  }

  if (kind === 'invokesAction') {
    if (item.type === 'group') {
      console.warn('Questionnaire item ' + item.linkId + ' is a group and cannot declare invokesAction - ignoring mapping');
      return null;
    }
    var actionExt = item.extension.find((ext: any) => ext.url === ACTION_EXTENSION_URL);
    var action = actionExt && actionExt.valueCode;
    if (!action || SUPPORTED_ACTIONS.indexOf(action) === -1) {
      console.warn('Questionnaire item ' + item.linkId + ' declares invokesAction but has no recognised questionnaire-action extension - item will not be rendered');
      return { kind: 'invalidAction' };
    }
    return { kind: 'action', action: action };
  }

  console.warn('Questionnaire item ' + item.linkId + ' declares an unrecognised mapping kind "' + kind + '" - ignoring mapping');
  return null;
}

/**
 * Converts a raw FHIR enableWhen/disabledWhen condition into its evaluator-ready form: a
 * condition carrying the predicate extension becomes {predicate, negate}, referencing a named
 * graph/app-state predicate (see graphPredicateEvaluator.ts) instead of a sibling item's
 * answer. `negate` is a non-standard sibling boolean (not part of the FHIR condition element)
 * letting a predicate be combined as its inverse - needed to express rules like "enabled only
 * when neither X nor Y holds" via De Morgan's with enableBehavior 'all'.
 */
function parseCondition(condition: any): any {
  const predicateExt = condition.extension && condition.extension.find((ext: any) => ext.url === PREDICATE_EXTENSION_URL);
  if (predicateExt && predicateExt.valueCode) {
    return { predicate: predicateExt.valueCode, negate: !!condition.negate };
  }
  return condition;
}

function parseConditions(conditions: any): any {
  if (!conditions) {
    return undefined;
  }
  return conditions.map(parseCondition);
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

function walkItems(items: any, out: any, tab: any): void {
  for (const item of items) {
    if (!item.linkId) {
      continue;
    }

    const mapping = parseMappingExtension(item);
    if (mapping && mapping.kind === 'invalidAction') {
      continue;
    }

    let fieldType;
    if (mapping && mapping.kind === 'action') {
      fieldType = 'button-action';
    } else if (mapping && (mapping.kind === 'legendCondition' || mapping.kind === 'legendObservation')) {
      fieldType = 'questionnaire-legend-picker';
    } else {
      fieldType = itemTypeToFieldType(item);
      if (fieldType === null) {
        console.warn('Questionnaire item ' + item.linkId + ' has unsupported type "' + item.type + '" - skipping');
        continue;
      }
    }

    const parsed: any = {
      linkId: item.linkId,
      label: item.text || item.linkId,
      itemType: item.type,
      fieldType: fieldType,
      tab: tab,
      repeats: !!item.repeats,
      answerValueSet: item.answerValueSet,
      answerOption: parseAnswerOptions(item),
      enableWhen: parseConditions(item.enableWhen),
      enableBehavior: item.enableBehavior || 'all',
      disabledWhen: parseConditions(item.disabledWhen),
      disabledBehavior: item.disabledBehavior || 'all',
      disablingPredicate: item.disablingPredicate || null,
      disablingPredicateTarget: item.disablingPredicateTarget || 'inactive',
      columns: item.columns,
      range: item.range,
      nullValue: item.nullValue,
      mapping: mapping,
      buttonLabel: item.text
    };
    out.push(parsed);

    if (item.item && item.item.length > 0) {
      walkItems(item.item, out, tab);
    }
  }
}

/**
 * Derives node-menu tabs from the Questionnaire's top-level items: each top-level `group`
 * becomes a tab (keyed by linkId, labelled by text); a non-group top-level item is placed on
 * an implicit "General" tab (with a warning) - see questionnaire-source-of-truth design D13.
 */
function walkTopLevelItems(topLevelItems: any, out: any, tabOrder: any): void {
  const GENERAL_TAB = { key: 'general', label: 'General' };
  for (const item of topLevelItems) {
    if (item.type === 'group') {
      const tab = { key: item.linkId, label: item.text || item.linkId };
      tabOrder.push(tab);
      walkItems(item.item || [], out, tab);
    } else {
      if (tabOrder.indexOf(GENERAL_TAB) === -1) {
        tabOrder.push(GENERAL_TAB);
      }
      console.warn('Questionnaire item ' + item.linkId + ' is a top-level item that is not a group - placing it on an implicit "General" tab');
      walkItems([item], out, GENERAL_TAB);
    }
  }
}

export function parseQuestionnaire(questionnaire: any): any {
  const items: any[] = [];
  const tabs: any[] = [];
  walkTopLevelItems(questionnaire.item || [], items, tabs);

  let canonicalUrl = questionnaire.url;
  if (canonicalUrl && questionnaire.version) {
    canonicalUrl = canonicalUrl + '|' + questionnaire.version;
  }

  return {
    canonicalUrl: canonicalUrl,
    items: items,
    tabs: tabs
  };
}

export function isSupportedItemType(type: any): boolean {
  return SUPPORTED_ITEM_TYPES.indexOf(type) >= 0;
}
