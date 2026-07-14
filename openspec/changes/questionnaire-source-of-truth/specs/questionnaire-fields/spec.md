## MODIFIED Requirements

### Requirement: Editor accepts a Questionnaire configuration
The editor SHALL accept a `questionnaireUrl` option (fetched from a FHIR server at construction time) and a `questionnaireLocal` option (an inline `Questionnaire` resource, used synchronously) in `initialiseEditor()`. There SHALL always be an effective Questionnaire driving the node-edit form: when neither option is supplied, or the configured one fails to load, the editor SHALL use its built-in default Questionnaire (see `questionnaire-source-of-truth`), which reproduces the full node-edit form exactly as it existed before any Questionnaire configuration existed.

#### Scenario: Editor initialises without any questionnaire configuration
- **WHEN** `initialiseEditor()` is called without `questionnaireUrl` or `questionnaireLocal`
- **THEN** the editor SHALL use its built-in default Questionnaire and render the full node-edit form (all tabs and fields) exactly as before

#### Scenario: Editor initialises with an inline Questionnaire
- **WHEN** `initialiseEditor({ questionnaireLocal: myQuestionnaire })` is called
- **THEN** the node menu SHALL be built entirely from `myQuestionnaire`'s items as soon as the editor is constructed, with no reference to the built-in default

#### Scenario: Editor initialises with a Questionnaire URL
- **WHEN** `initialiseEditor({ questionnaireUrl: 'https://fhir.example.org/Questionnaire/123' })` is called
- **THEN** the editor SHALL render the node menu from the built-in default Questionnaire until the fetch resolves, then rebuild the node menu entirely from the fetched resource's items

#### Scenario: Questionnaire fetch fails
- **WHEN** the `questionnaireUrl` fetch fails (network error or non-2xx response) or the fetched resource is not a valid `Questionnaire`
- **THEN** the editor SHALL log the failure and continue rendering the node menu from the built-in default Questionnaire, without throwing an unhandled error

---

### Requirement: Supported Questionnaire item types render as fields on their containing tab
The editor SHALL render `Questionnaire.item` entries of type `string`, `text`, `boolean`, `date`, `integer`, `decimal`, `choice`, and `open-choice` as fields on their containing tab, and non-top-level `group` items as non-interactive section headings whose children are rendered in document order immediately below them. (Top-level `group` items are handled separately — see `questionnaire-source-of-truth`'s tab-derivation requirement.)

#### Scenario: String and text items render as text fields
- **WHEN** a configured Questionnaire has a `string` item and a `text` item
- **THEN** both SHALL render as free-text input fields on their containing tab

#### Scenario: Boolean item renders as a checkbox
- **WHEN** a configured Questionnaire has a `boolean` item
- **THEN** it SHALL render as a checkbox field on its containing tab

#### Scenario: Date item renders as a date picker
- **WHEN** a configured Questionnaire has a `date` item
- **THEN** it SHALL render using the existing date-picker field type

#### Scenario: Integer and decimal items render as numeric fields
- **WHEN** a configured Questionnaire has an `integer` or `decimal` item
- **THEN** it SHALL render as a numeric input field that rejects non-numeric entry

#### Scenario: Nested group item renders as a heading, not an input
- **WHEN** a configured Questionnaire has a `group` item nested inside a top-level group, containing two child items
- **THEN** the nested group SHALL render as a non-interactive heading within its parent tab, followed by its two children's fields, and the heading SHALL NOT appear in the node's saved properties

#### Scenario: Unsupported item type is skipped
- **WHEN** a configured Questionnaire item has a type outside the supported set (e.g. `attachment`, `reference`, `quantity`)
- **THEN** the editor SHALL skip rendering that item and SHALL log a warning, without failing to render the rest of its containing tab

---

### Requirement: enableWhen controls field visibility
An item with `enableWhen` conditions SHALL be hidden (marked inactive, consistent with existing node-menu field visibility) unless its conditions are satisfied, combined per `enableBehavior` (`all` by default, or `any`). Each condition's `question` SHALL reference another item within the same configured Questionnaire, **or** the condition MAY instead carry a graph/app-state predicate reference (a non-standard extension — see `questionnaire-source-of-truth`) in place of a `question`/answer pair.

#### Scenario: Single enableWhen condition hides a field
- **WHEN** an item has `enableWhen: [{question: 'q1', operator: '=', answerBoolean: true}]` and the node's current answer for `q1` is `false` or unanswered
- **THEN** the dependent item SHALL be hidden

#### Scenario: Single enableWhen condition reveals a field
- **WHEN** the same item's `q1` answer becomes `true`
- **THEN** the dependent item SHALL become visible without requiring the node menu to be closed and reopened

#### Scenario: Multiple conditions with enableBehavior "all"
- **WHEN** an item has two `enableWhen` conditions and `enableBehavior: 'all'`, and only one condition is currently satisfied
- **THEN** the item SHALL remain hidden

#### Scenario: Multiple conditions with enableBehavior "any"
- **WHEN** an item has two `enableWhen` conditions and `enableBehavior: 'any'`, and at least one condition is currently satisfied
- **THEN** the item SHALL be visible

---

### Requirement: Items can map to an existing scalar node property
An item may declare a `mapsToField` mapping, naming the target via the item's own `item.definition` (standard `<canonical-url>#<element-id>` fragment syntax). The parser resolves the *terminal* segment of that fragment against the supported converter-aware scalar targets: `gender`, `given` (first name), `family` (last name), `identifier` (external ID), `birthDate`, `deceasedDateTime` (death date), `lifeStatus`, `gestationAge`, `carrierStatus`, `comments`, `childlessStatus`, `isAdopted`, `monozygotic`, `evaluated`, `lostContact`. A mapped item renders exactly like any other item (its field type still comes from the Questionnaire item), but instead of reading/writing a generic per-`linkId` answer, it reads/writes the named property directly through its existing setter/getter — so cross-field behaviour already implemented on that setter (e.g. `setLifeStatus`'s cascades, `setDisorders`↔`setCarrierStatus`'s undo memo) keeps working unchanged. (Historical note: under the earlier additive "Custom tab" model, a mapped item was excluded from rendering because the mapped property already had a separate hardcoded field elsewhere; now that the Questionnaire is the only source of the form, that exclusion no longer applies — the mapped item's own rendering *is* that property's only UI.)

#### Scenario: Mapped item dispatches through the existing setter, not a generic answer store
- **WHEN** a Questionnaire item declares `mapsToField: 'carrierStatus'` and the user changes its value
- **THEN** the change SHALL be dispatched through `setCarrierStatus` (with its existing undo/cross-field behaviour), not stored as a generic Questionnaire answer

#### Scenario: Mapped item's export uses the existing FHIR shape unchanged
- **WHEN** a pedigree with a `mapsToField: 'gender'` item is exported
- **THEN** the node's `Patient.gender` SHALL be produced exactly as it is today, with no new resource introduced for the mapping

#### Scenario: Mapped item still produces a dual-written QuestionnaireResponse entry
- **WHEN** a node has a non-empty value for a `mapsToField`-mapped property and the pedigree is exported
- **THEN** the exported `QuestionnaireResponse` for that node SHALL include an `item` entry for that `linkId`, sourced from the current value of the mapped property

#### Scenario: Unknown mapsToField target degrades to unmapped
- **WHEN** an item declares `mapsToField` naming a property that isn't in the supported scalar list
- **THEN** the editor SHALL log a warning and treat the item as an ordinary (unmapped) field

---

### Requirement: Items can map to a coded Condition or Observation
An item with no existing hardcoded home may declare `mapsToCondition` or `mapsToObservation` with an implementer-supplied code. Such items SHALL still render as a field wherever the Questionnaire places them. On export, a `boolean` item mapped to `mapsToCondition` SHALL produce a `Condition` with that code when answered `true`, and produce none when `false` or unanswered; any item mapped to `mapsToObservation` SHALL produce an `Observation` with the answer as its value whenever answered. On import, a `Condition`/`Observation` whose code matches a configured mapping SHALL populate that item's answer instead of the generic disorders/phenotypes list.

#### Scenario: Boolean item mapped to a Condition, answered true
- **WHEN** a `boolean` item with `mapsToCondition` is answered `true` and the pedigree is exported
- **THEN** a `Condition` resource with the mapped code SHALL be produced for that node, in addition to its `QuestionnaireResponse` entry

#### Scenario: Boolean item mapped to a Condition, answered false
- **WHEN** a `boolean` item with `mapsToCondition` is answered `false`
- **THEN** no `Condition` resource SHALL be produced for that mapping on export

#### Scenario: Non-boolean item mapped to an Observation
- **WHEN** a `choice` item with `mapsToObservation` is answered
- **THEN** an `Observation` resource with the mapped code and the answer as its value SHALL be produced for that node

#### Scenario: Mapped Condition is excluded from generic disorders extraction
- **WHEN** importing a pedigree containing a `Condition` whose code matches a configured `mapsToCondition` mapping
- **THEN** that Condition SHALL populate the mapped item's answer and SHALL NOT also appear in the node's generic `disorders` list

#### Scenario: Mapped Observation is excluded from generic phenotype/gene extraction
- **WHEN** importing a pedigree containing an `Observation` whose code matches a configured `mapsToObservation` mapping
- **THEN** that Observation SHALL populate the mapped item's answer and SHALL NOT also appear in the node's generic `hpoTerms`/`candidateGenes` lists
