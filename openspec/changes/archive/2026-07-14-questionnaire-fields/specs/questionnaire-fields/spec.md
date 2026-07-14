## ADDED Requirements

### Requirement: Editor accepts a Questionnaire configuration
The editor SHALL accept a `questionnaireUrl` option (fetched from a FHIR server at construction time) and a `questionnaireLocal` option (an inline `Questionnaire` resource, used synchronously) in `initialiseEditor()`. When neither is supplied, the editor SHALL function normally with no "Custom" node-menu tab.

#### Scenario: Editor initialises without any questionnaire configuration
- **WHEN** `initialiseEditor()` is called without `questionnaireUrl` or `questionnaireLocal`
- **THEN** the editor SHALL load normally and the node menu SHALL NOT show a "Custom" tab

#### Scenario: Editor initialises with an inline Questionnaire
- **WHEN** `initialiseEditor({ questionnaireLocal: myQuestionnaire })` is called
- **THEN** the "Custom" tab SHALL be present in the node menu as soon as the editor is constructed

#### Scenario: Editor initialises with a Questionnaire URL
- **WHEN** `initialiseEditor({ questionnaireUrl: 'https://fhir.example.org/Questionnaire/123' })` is called
- **THEN** the editor SHALL fetch the resource and, once the fetch resolves, add the "Custom" tab's fields to the node menu

#### Scenario: Questionnaire fetch fails
- **WHEN** the `questionnaireUrl` fetch fails (network error or non-2xx response) or the fetched resource is not a valid `Questionnaire`
- **THEN** the editor SHALL log the failure and continue functioning normally with no "Custom" tab, without throwing an unhandled error

---

### Requirement: Supported Questionnaire item types render as Custom-tab fields
The editor SHALL render `Questionnaire.item` entries of type `string`, `text`, `boolean`, `date`, `integer`, `decimal`, `choice`, and `open-choice` as fields on the node menu's "Custom" tab, and `group` items as non-interactive section headings whose children are rendered in document order immediately below them.

#### Scenario: String and text items render as text fields
- **WHEN** a configured Questionnaire has a `string` item and a `text` item
- **THEN** both SHALL render as free-text input fields on the Custom tab

#### Scenario: Boolean item renders as a checkbox
- **WHEN** a configured Questionnaire has a `boolean` item
- **THEN** it SHALL render as a checkbox field on the Custom tab

#### Scenario: Date item renders as a date picker
- **WHEN** a configured Questionnaire has a `date` item
- **THEN** it SHALL render using the existing date-picker field type

#### Scenario: Integer and decimal items render as numeric fields
- **WHEN** a configured Questionnaire has an `integer` or `decimal` item
- **THEN** it SHALL render as a numeric input field that rejects non-numeric entry

#### Scenario: Group item renders as a heading, not an input
- **WHEN** a configured Questionnaire has a `group` item containing two child items
- **THEN** the group SHALL render as a non-interactive heading on the Custom tab, followed by its two children's fields, and the heading SHALL NOT appear in the node's saved properties

#### Scenario: Unsupported item type is skipped
- **WHEN** a configured Questionnaire item has a type outside the supported set (e.g. `attachment`, `reference`, `quantity`)
- **THEN** the editor SHALL skip rendering that item and SHALL log a warning, without failing to render the rest of the Custom tab

---

### Requirement: Choice and open-choice items with answerValueSet are terminology-backed
A `choice` or `open-choice` item with an `answerValueSet` SHALL render as a searchable picker backed by the editor's terminology subsystem, using the item's `linkId` as the terminology type key and `answerValueSet` as the FHIR ValueSet to search. A `choice` item with inline `answerOption` and no `answerValueSet` SHALL render as a static dropdown of those options, without involving the terminology subsystem.

#### Scenario: answerValueSet choice item searches the configured terminology server
- **WHEN** a user types into a choice field backed by `answerValueSet`
- **THEN** the editor SHALL search that ValueSet via the configured terminology base URL and display matching `{code, display}` results

#### Scenario: Selected choice answer stores the full coding triple
- **WHEN** a user selects a result from an answerValueSet-backed picker
- **THEN** the node SHALL store the selected `{system, code, display}` (or `code`/`display` when `system` is unknown) as that item's answer, without a separate lookup call

#### Scenario: answerOption choice item renders without terminology
- **WHEN** a `choice` item has inline `answerOption` values and no `answerValueSet`
- **THEN** it SHALL render as a plain dropdown of those literal options

#### Scenario: answerValueSet item with no terminology base URL configured
- **WHEN** an item declares `answerValueSet` but no terminology base URL is configured for questionnaire fields
- **THEN** the editor SHALL log a warning and render the item as a plain dropdown (or free-text field if no `answerOption` is present) instead of failing to render the Custom tab

---

### Requirement: enableWhen controls Custom-tab field visibility
An item with `enableWhen` conditions SHALL be hidden (marked inactive, consistent with existing node-menu field visibility) unless its conditions are satisfied by the current node's other Questionnaire answers, combined per `enableBehavior` (`all` by default, or `any`). `enableWhen.question` SHALL only reference other items within the same configured Questionnaire; it SHALL NOT reference built-in pedigree fields (e.g. gender, disorders).

#### Scenario: Single enableWhen condition hides a field
- **WHEN** an item has `enableWhen: [{question: 'q1', operator: '=', answerBoolean: true}]` and the node's current answer for `q1` is `false` or unanswered
- **THEN** the dependent item SHALL be hidden on the Custom tab

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

### Requirement: Questionnaire answers persist on the node and round-trip through internal JSON
Each node SHALL support a per-`linkId` answer store, persisted through the internal JSON serialisation (`toJSON`/`loadGraph`) exactly like any other node property.

#### Scenario: Answers survive save and reload
- **WHEN** a pedigree with nodes carrying Questionnaire answers is saved and reloaded via the internal JSON format
- **THEN** every node's answers SHALL be preserved exactly, keyed by `linkId`

#### Scenario: Editing an answer is undoable
- **WHEN** a user changes a Custom-tab field's value and then triggers undo
- **THEN** the node's answer for that field SHALL revert to its previous value, consistent with undo behavior for every other node field

---

### Requirement: GA4GH FHIR export emits a QuestionnaireResponse per answered node
For every node with at least one Questionnaire answer, GA4GH FHIR export SHALL emit a contained `QuestionnaireResponse` resource whose `subject` references that node's Patient resource (using the same reference convention as `Condition`/`Observation`), whose `questionnaire` field identifies the configured Questionnaire's canonical URL, and whose `item[]` contains one entry per answered `linkId`. These resources SHALL be listed in a dedicated `Composition.section` (code `questionnaire-responses`).

#### Scenario: Node with answers produces a QuestionnaireResponse
- **WHEN** exporting a pedigree where one node has two answered Custom-tab fields
- **THEN** the exported Composition SHALL contain one `QuestionnaireResponse` resource for that node, with `subject` referencing that node's Patient and two `item` entries

#### Scenario: Node with no answers produces no QuestionnaireResponse
- **WHEN** exporting a pedigree where a node has no Questionnaire answers
- **THEN** no `QuestionnaireResponse` resource SHALL be generated for that node

#### Scenario: Exported QuestionnaireResponse is listed in its own section
- **WHEN** a pedigree with at least one answered node is exported
- **THEN** the Composition SHALL include a section with code `questionnaire-responses` listing all generated `QuestionnaireResponse` resources

---

### Requirement: GA4GH FHIR import resolves QuestionnaireResponse back to nodes
On import, contained `QuestionnaireResponse` resources SHALL be resolved to their owning node via the existing node-reference resolution used for `Condition`/`Observation`, and their answers SHALL populate that node's per-`linkId` answer store when the response's `questionnaire` matches the currently configured Questionnaire.

#### Scenario: Matching Questionnaire populates node answers
- **WHEN** importing a Composition containing a `QuestionnaireResponse` whose `questionnaire` matches the editor's currently configured Questionnaire canonical URL
- **THEN** the referenced node's Custom-tab fields SHALL be pre-populated with the imported answers

#### Scenario: Non-matching or unconfigured Questionnaire preserves raw answers without rendering
- **WHEN** importing a Composition containing a `QuestionnaireResponse` whose `questionnaire` does not match the editor's currently configured Questionnaire (or no Questionnaire is configured at all)
- **THEN** the editor SHALL preserve the raw answer data on the node (so a subsequent export does not lose it) and SHALL log a warning, without rendering those answers on the Custom tab

#### Scenario: QuestionnaireResponse with an unresolvable subject is skipped
- **WHEN** a contained `QuestionnaireResponse`'s `subject` reference does not resolve to any node in the imported pedigree
- **THEN** that resource SHALL be skipped without failing the rest of the import

---

### Requirement: Items can map to an existing scalar node property
An item may declare a `mapsToField` mapping, naming the target via the item's own `item.definition` (standard `<canonical-url>#<element-id>` fragment syntax). The parser resolves the *terminal* segment of that fragment against the supported converter-aware scalar targets: `gender`, `given` (first name), `family` (last name), `identifier` (external ID), `birthDate`, `deceasedDateTime` (death date), `lifeStatus`, `gestationAge`, `carrierStatus`, `comments`. A mapped item SHALL NOT render as a separate Custom-tab field; it SHALL instead read/write the named property directly through its existing setter/getter.

#### Scenario: Mapped item is excluded from the Custom tab
- **WHEN** a Questionnaire item declares `mapsToField: 'carrierStatus'`
- **THEN** the Custom tab SHALL NOT show a separate field for that item; the existing Clinical-tab carrier-status field remains the only UI for it

#### Scenario: Mapped item's export uses the existing FHIR shape unchanged
- **WHEN** a pedigree with a `mapsToField: 'gender'` item is exported
- **THEN** the node's `Patient.gender` SHALL be produced exactly as it is today, with no new resource introduced for the mapping

#### Scenario: Mapped item still produces a dual-written QuestionnaireResponse entry
- **WHEN** a node has a non-empty value for a `mapsToField`-mapped property and the pedigree is exported
- **THEN** the exported `QuestionnaireResponse` for that node SHALL include an `item` entry for that `linkId`, sourced from the current value of the mapped property

#### Scenario: Unknown mapsToField target degrades to unmapped
- **WHEN** an item declares `mapsToField` naming a property that isn't in the supported scalar list
- **THEN** the editor SHALL log a warning and treat the item as an ordinary (unmapped) Custom-tab field

---

### Requirement: Items can map to a coded Condition or Observation
An item with no existing hardcoded home may declare `mapsToCondition` or `mapsToObservation` with an implementer-supplied code. Such items SHALL still render on the Custom tab. On export, a `boolean` item mapped to `mapsToCondition` SHALL produce a `Condition` with that code when answered `true`, and produce none when `false` or unanswered; any item mapped to `mapsToObservation` SHALL produce an `Observation` with the answer as its value whenever answered. On import, a `Condition`/`Observation` whose code matches a configured mapping SHALL populate that item's answer instead of the generic disorders/phenotypes list.

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

---

### Requirement: Mapped FHIR location is authoritative over the dual-written QuestionnaireResponse
When both a mapped FHIR location (a scalar property, or a coded `Condition`/`Observation`) and its corresponding `QuestionnaireResponse` item are present on import, the mapped location SHALL determine the item's rendered value; the `QuestionnaireResponse` item SHALL NOT override it.

#### Scenario: Mapped location and QuestionnaireResponse disagree
- **WHEN** importing a pedigree where a node's `Patient.gender` and its `QuestionnaireResponse` item for a `mapsToField: 'gender'` mapping carry different values
- **THEN** the node's rendered gender SHALL come from `Patient.gender`, not from the `QuestionnaireResponse` item
