import { MAPPING_EXTENSION_URL, PREDICATE_EXTENSION_URL, ACTION_EXTENSION_URL, MAPS_TO_FIELD_DEFINITIONS } from 'pedigree/questionnaire/questionnaireParser';

const ITEM_CONTROL_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
const ITEM_CONTROL_SYSTEM = 'http://hl7.org/fhir/questionnaire-item-control';

function mapsToFieldExt(): any {
  return { url: MAPPING_EXTENSION_URL, valueCode: 'mapsToField' };
}

function radioControl(): any {
  return { url: ITEM_CONTROL_EXTENSION_URL, valueCodeableConcept: { coding: [{ system: ITEM_CONTROL_SYSTEM, code: 'radio-button' }] } };
}

function predicateCondition(predicate: string, negate?: boolean): any {
  const condition: any = { extension: [{ url: PREDICATE_EXTENSION_URL, valueCode: predicate }] };
  if (negate) {
    condition.negate = true;
  }
  return condition;
}

/**
 * The Questionnaire used whenever no `questionnaireUrl`/`questionnaireLocal` is configured -
 * functionally equivalent to the node-edit form as it existed before any Questionnaire
 * configuration existed (see questionnaire-source-of-truth design D14). Exported as
 * `OpenPedigree.defaultQuestionnaire` so an implementer wanting "everything plus a few new
 * fields" can spread it: `{ ...OpenPedigree.defaultQuestionnaire, item: [...] }`.
 *
 * Known deliberate simplifications from the original hardcoded form (each affects only a
 * cosmetic/edge-case detail, not core behaviour):
 * - The inert `identifier` hidden field (no setter, no visible effect) is dropped entirely.
 * - `gestation_age`'s range-select and `childlessSelect`'s unset-defaults-to-'none' both rely
 *   on the FHIR item shape / a plain HTML <select>'s default-first-option behaviour rather
 *   than the original's explicit JS substitution - same visible outcome, slightly different path.
 * - The `carrier` item's "not affected" option uses `code: ''`, which is not a strictly valid
 *   FHIR `code` primitive (must be non-empty) - harmless here since this object is never
 *   validated against the FHIR spec or round-tripped through a real FHIR server.
 */
export const DEFAULT_QUESTIONNAIRE: any = {
  resourceType: 'Questionnaire',
  url: 'https://github.com/aehrc/open-pedigree/Questionnaire/default',
  version: '1.0',
  title: 'Open Pedigree default node-edit form',
  status: 'active',
  item: [
    {
      linkId: 'personal_tab',
      type: 'group',
      text: 'Personal',
      item: [
        {
          linkId: 'gender', type: 'choice', text: 'Gender',
          answerOption: [
            { valueCoding: { code: 'M', display: 'Male' } },
            { valueCoding: { code: 'F', display: 'Female' } },
            { valueCoding: { code: 'U', display: 'Unknown' } }
          ],
          columns: 3,
          definition: MAPS_TO_FIELD_DEFINITIONS.gender,
          extension: [mapsToFieldExt(), radioControl()],
          disablingPredicate: 'possibleGenders',
          disablingPredicateTarget: 'inactive'
        },
        {
          linkId: 'first_name', type: 'string', text: 'First name',
          definition: MAPS_TO_FIELD_DEFINITIONS.given, extension: [mapsToFieldExt()]
        },
        {
          linkId: 'last_name', type: 'string', text: 'Last name',
          definition: MAPS_TO_FIELD_DEFINITIONS.family, extension: [mapsToFieldExt()]
        },
        {
          linkId: 'link_patient', type: 'display', text: 'Link to patient',
          extension: [{ url: MAPPING_EXTENSION_URL, valueCode: 'invokesAction' }, { url: ACTION_EXTENSION_URL, valueCode: 'linkPatient' }],
          enableWhen: [predicateCondition('canLinkPatient')]
        },
        {
          linkId: 'external_id', type: 'string', text: 'Identifier',
          definition: MAPS_TO_FIELD_DEFINITIONS.identifier, extension: [mapsToFieldExt()]
        },
        {
          linkId: 'date_of_birth', type: 'date', text: 'Date of birth',
          definition: MAPS_TO_FIELD_DEFINITIONS.birthDate, extension: [mapsToFieldExt()],
          enableWhen: [predicateCondition('isFetus', true)]
        },
        {
          linkId: 'date_of_death', type: 'date', text: 'Date of death',
          definition: MAPS_TO_FIELD_DEFINITIONS.deceasedDateTime, extension: [mapsToFieldExt()],
          enableWhen: [predicateCondition('isFetus', true)]
        },
        {
          linkId: 'state', type: 'choice', text: 'Individual is',
          answerOption: [
            { valueCoding: { code: 'alive', display: 'Alive' } },
            { valueCoding: { code: 'stillborn', display: 'Stillborn' } },
            { valueCoding: { code: 'deceased', display: 'Deceased' } },
            { valueCoding: { code: 'miscarriage', display: 'Miscarriage' } },
            { valueCoding: { code: 'unborn', display: 'Unborn' } },
            { valueCoding: { code: 'aborted', display: 'Aborted' } }
          ],
          columns: 3,
          definition: MAPS_TO_FIELD_DEFINITIONS.lifeStatus,
          extension: [mapsToFieldExt(), radioControl()],
          disablingPredicate: 'lifeStatusAvailability',
          disablingPredicateTarget: 'inactive'
        },
        {
          linkId: 'gestation_age', type: 'integer', text: 'Gestation age',
          range: { start: 0, end: 50, item: ['week', 'weeks'] },
          nullValue: true,
          definition: MAPS_TO_FIELD_DEFINITIONS.gestationAge, extension: [mapsToFieldExt()],
          enableWhen: [predicateCondition('isFetus')]
        },
        {
          linkId: 'childlessSelect', type: 'choice', text: 'Heredity options',
          answerOption: [
            { valueCoding: { code: 'none', display: 'None' } },
            { valueCoding: { code: 'childless', display: 'Childless' } },
            { valueCoding: { code: 'infertile', display: 'Infertile' } }
          ],
          definition: MAPS_TO_FIELD_DEFINITIONS.childlessStatus, extension: [mapsToFieldExt()],
          enableWhen: [predicateCondition('isFetus', true)]
        },
        {
          linkId: 'adopted', type: 'boolean', text: 'Adopted',
          definition: MAPS_TO_FIELD_DEFINITIONS.isAdopted, extension: [mapsToFieldExt()],
          enableWhen: [predicateCondition('isFetus', true), predicateCondition('hasToBeAdopted', true)],
          enableBehavior: 'all'
        },
        {
          linkId: 'monozygotic', type: 'boolean', text: 'Monozygotic twin',
          definition: MAPS_TO_FIELD_DEFINITIONS.monozygotic, extension: [mapsToFieldExt()],
          enableWhen: [predicateCondition('isTwin')],
          disabledWhen: [predicateCondition('isTwinWithConsistentGender')]
        },
        {
          linkId: 'nocontact', type: 'boolean', text: 'Not in contact with proband',
          definition: MAPS_TO_FIELD_DEFINITIONS.lostContact, extension: [mapsToFieldExt()],
          enableWhen: [predicateCondition('isProband', true), predicateCondition('isRelatedToProband')],
          enableBehavior: 'all'
        },
        {
          linkId: 'placeholder', type: 'boolean', text: 'Placeholder node',
          // Dead field in the live UI today (pre-existing, out of scope to fix - see design's
          // Non-Goals). Preserved as always-inactive via a self-contradicting predicate pair,
          // since there is no "always false" predicate in the closed vocabulary.
          enableWhen: [predicateCondition('isProband'), predicateCondition('isProband', true)],
          enableBehavior: 'all'
        }
      ]
    },
    {
      linkId: 'clinical_tab',
      type: 'group',
      text: 'Clinical',
      item: [
        {
          linkId: 'carrier', type: 'choice', text: 'Carrier status',
          answerOption: [
            { valueCoding: { code: '', display: 'Not affected' } },
            { valueCoding: { code: 'carrier', display: 'Carrier' } },
            { valueCoding: { code: 'affected', display: 'Affected' } },
            { valueCoding: { code: 'presymptomatic', display: 'Pre-symptomatic' } }
          ],
          definition: MAPS_TO_FIELD_DEFINITIONS.carrierStatus,
          extension: [mapsToFieldExt(), radioControl()],
          disablingPredicate: 'carrierAvailability',
          disablingPredicateTarget: 'disabled'
        },
        {
          linkId: 'evaluated', type: 'boolean', text: 'Documented evaluation',
          definition: MAPS_TO_FIELD_DEFINITIONS.evaluated, extension: [mapsToFieldExt()]
        },
        {
          linkId: 'disorders', type: 'choice', text: 'Disorders', repeats: true,
          answerValueSet: 'http://purl.bioontology.org/ontology/OMIM',
          extension: [{ url: MAPPING_EXTENSION_URL, valueCode: 'mapsToLegendCondition' }]
        },
        {
          linkId: 'import_from_record', type: 'display', text: 'Import from record',
          extension: [{ url: MAPPING_EXTENSION_URL, valueCode: 'invokesAction' }, { url: ACTION_EXTENSION_URL, valueCode: 'importClinicalData' }],
          enableWhen: [predicateCondition('canImportClinicalData')]
        },
        {
          linkId: 'candidate_genes', type: 'choice', text: 'Genes', repeats: true,
          answerValueSet: 'http://www.genenames.org',
          extension: [{ url: MAPPING_EXTENSION_URL, valueCode: 'mapsToLegendObservation' }]
        },
        {
          linkId: 'hpo_positive', type: 'choice', text: 'Phenotypic features', repeats: true,
          answerValueSet: 'http://purl.obolibrary.org/obo/hp.owl',
          extension: [{ url: MAPPING_EXTENSION_URL, valueCode: 'mapsToLegendObservation' }]
        },
        {
          linkId: 'comments', type: 'text', text: 'Comments',
          definition: MAPS_TO_FIELD_DEFINITIONS.comments, extension: [mapsToFieldExt()]
        }
      ]
    }
  ]
};
