/**
 * open-pedigree's own FHIR definitions: every custom URL open-pedigree (and redcap_pedigree_editor)
 * writes, in one place. Each resolves to a page describing it on the project's GitHub Pages site,
 * with its JSON definition beside it (fhir/ in this repository; see the README).
 */

export const FHIR_BASE = 'https://aehrc.github.io/open-pedigree/fhir/';

const structureDefinition = (id: string): string => FHIR_BASE + 'StructureDefinition/' + id;

// Patient extensions, in saved GA4GH pedigrees.
export const ADOPTED_EXTENSION_URL = structureDefinition('adopted');
export const FETUS_DATE_OF_DEATH_EXTENSION_URL = structureDefinition('fetus-date-of-death');
export const LINKED_RECORD_REF_EXTENSION_URL = structureDefinition('linked-record-ref');
export const LINKED_RECORD_SNAPSHOT_EXTENSION_URL = structureDefinition('linked-record-snapshot');

// Questionnaire item extensions.
export const MAPPING_EXTENSION_URL = structureDefinition('questionnaire-field-mapping');
export const PREDICATE_EXTENSION_URL = structureDefinition('questionnaire-enable-predicate');
export const ACTION_EXTENSION_URL = structureDefinition('questionnaire-action');
export const LINKED_RECORD_SOURCE_EXTENSION_URL = structureDefinition('questionnaire-linked-record-source');
// (used by redcap_pedigree_editor, not read here; defined and published with the rest)
export const REDCAP_SOURCE_EXTENSION_URL = structureDefinition('questionnaire-redcap-source');

// The logical model Questionnaire items' item.definition can point at (#PedigreeIndividual.<element>).
export const PEDIGREE_INDIVIDUAL_URL = structureDefinition('PedigreeIndividual');

// The built-in default Questionnaire's canonical URL.
export const DEFAULT_QUESTIONNAIRE_URL = FHIR_BASE + 'Questionnaire/default';

// The `adopted` extension's value: which way the person was adopted.
export const ADOPTION_DIRECTION_SYSTEM = FHIR_BASE + 'CodeSystem/adoption-direction';
export const ADOPTION_DIRECTION_VALUE_SET = FHIR_BASE + 'ValueSet/adoption-direction';
export const ADOPTED_IN = 'in';
export const ADOPTED_OUT = 'out';

// Every definition published under FHIR_BASE (a test checks each has its JSON in fhir/).
export const PUBLISHED_DEFINITION_URLS = [
  ADOPTED_EXTENSION_URL, FETUS_DATE_OF_DEATH_EXTENSION_URL, LINKED_RECORD_REF_EXTENSION_URL,
  LINKED_RECORD_SNAPSHOT_EXTENSION_URL, MAPPING_EXTENSION_URL, PREDICATE_EXTENSION_URL, ACTION_EXTENSION_URL,
  LINKED_RECORD_SOURCE_EXTENSION_URL, REDCAP_SOURCE_EXTENSION_URL, PEDIGREE_INDIVIDUAL_URL,
  DEFAULT_QUESTIONNAIRE_URL, ADOPTION_DIRECTION_SYSTEM, ADOPTION_DIRECTION_VALUE_SET,
];

// Before 2.0.0 these lived under the repository's GitHub URL, which never resolved. They are no
// longer read; this says what replaced one, for error messages.
export const RETIRED_BASE = 'https://github.com/aehrc/open-pedigree/';

export function replacementFor(retiredUrl: string): string | null {
  if (typeof retiredUrl !== 'string' || retiredUrl.indexOf(RETIRED_BASE) !== 0) {
    return null;
  }
  const rest = retiredUrl.slice(RETIRED_BASE.length);
  if (rest.indexOf('questionnaire-') === 0) {
    return structureDefinition(rest);
  }
  if (rest.indexOf('StructureDefinition/') === 0 || rest.indexOf('Questionnaire/') === 0) {
    return FHIR_BASE + rest;
  }
  return null;
}
