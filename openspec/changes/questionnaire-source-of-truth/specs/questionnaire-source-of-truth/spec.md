## ADDED Requirements

### Requirement: Node-menu tabs are derived from top-level Questionnaire groups
The node menu's tabs SHALL be derived from the effective Questionnaire's top-level `item[]` entries: each top-level `group` item SHALL become one tab, keyed internally by that item's `linkId` and labelled by its `text`. A top-level item that is not a `group` SHALL be placed into an implicit tab labelled `"General"`, and the editor SHALL log a warning that the item was not wrapped in a group.

#### Scenario: Top-level groups become tabs
- **WHEN** the effective Questionnaire has three top-level `group` items with `text` values `"Personal"`, `"Clinical"`, and `"Genetics"`
- **THEN** the node menu SHALL render three tabs labelled `"Personal"`, `"Clinical"`, and `"Genetics"`, in that order, each containing that group's child items as fields

#### Scenario: Two tabs share a display label
- **WHEN** two top-level groups both have `text: "Details"` but different `linkId`s
- **THEN** both SHALL render as distinct tabs (keyed by `linkId`), each showing its own fields, without one overwriting the other

#### Scenario: A top-level item is not wrapped in a group
- **WHEN** the effective Questionnaire has a top-level `string` item alongside its top-level `group` items
- **THEN** that item SHALL render as a field on an implicit `"General"` tab, and the editor SHALL log a warning

---

### Requirement: A built-in default Questionnaire is used when none is configured
The editor SHALL ship a built-in default Questionnaire (exposed as `OpenPedigree.defaultQuestionnaire`) that is functionally equivalent to the node-edit form as it existed before any Questionnaire configuration existed: the same tabs, fields, field order, and visibility/availability behaviour. An implementer-supplied Questionnaire (`questionnaireUrl` or `questionnaireLocal`) SHALL fully replace the built-in default; the editor SHALL NOT merge the two.

#### Scenario: No Questionnaire configured reproduces the legacy form
- **WHEN** `initialiseEditor()` is called without `questionnaireUrl` or `questionnaireLocal`
- **THEN** the node menu SHALL show the same tabs, fields, and field behaviour (including all graph-dependent visibility/availability rules) as the pre-Questionnaire hardcoded form

#### Scenario: Implementer Questionnaire replaces, not merges with, the default
- **WHEN** `initialiseEditor({ questionnaireLocal: myQuestionnaire })` is called and `myQuestionnaire` does not include a `comments` item
- **THEN** the node menu SHALL NOT show a comments field, even though the built-in default Questionnaire has one

#### Scenario: Default Questionnaire is available for extension
- **WHEN** an implementer reads `OpenPedigree.defaultQuestionnaire` and constructs `{ ...OpenPedigree.defaultQuestionnaire, item: [...OpenPedigree.defaultQuestionnaire.item, myExtraItem] }`
- **THEN** passing that object as `questionnaireLocal` SHALL render every field of the default Questionnaire plus `myExtraItem`

---

### Requirement: Legend-backed repeating items track per-value colour and case count
An item may declare a `mapsToLegendCondition` or `mapsToLegendObservation` mapping (via the same mapping extension used by `mapsToField`/`mapsToCondition`/`mapsToObservation`). Such an item SHALL be `repeats: true`, `type` `choice` or `open-choice`, with `answerValueSet` set. It SHALL render as a multi-select terminology-backed picker associated with a dedicated `Legend` instance keyed by the item's `linkId`, which SHALL assign and persist a colour per distinct selected value across the whole pedigree and track, for each value, the set of nodes carrying it.

#### Scenario: Selecting a term assigns it a colour visible on the canvas
- **WHEN** a user selects a term on a `mapsToLegendCondition` item for a node
- **THEN** that term SHALL be assigned a colour (or reuse its existing colour if already selected on another node) and that colour SHALL appear as a swatch both in the node menu and on the pedigree canvas for that node

#### Scenario: Removing the last occurrence of a value frees its colour
- **WHEN** the only node carrying a given term has that term removed from its `mapsToLegendCondition` item
- **THEN** the term SHALL be removed from that item's Legend, and a subsequently newly-selected term MAY reuse a freed colour

#### Scenario: Export produces one resource per selected term
- **WHEN** a node has two terms selected on a `mapsToLegendCondition` item and the pedigree is exported
- **THEN** two `Condition` resources SHALL be produced for that node, one per selected term, each coded from that term's `{system, code, display}`

#### Scenario: A Questionnaire without a legend item disables generic extraction for that category
- **WHEN** importing a pedigree using an effective Questionnaire that has no `mapsToLegendCondition` item
- **THEN** the node's generic `disorders` list SHALL NOT be populated from imported `Condition` resources for that category

---

### Requirement: Graph and app-state predicates extend enableWhen
An `enableWhen` condition MAY reference a named graph/app-state predicate (via the extension `https://github.com/aehrc/open-pedigree/questionnaire-enable-predicate`) instead of another item's answer. The supported predicate names are exactly: `isFetus`, `hasRelationships`, `isProband`, `isRelatedToProband`, `hasToBeAdopted`, `isTwin`, `isTwinWithConsistentGender`, `canLinkPatient`, `canImportClinicalData`. Each resolves to a boolean evaluated against the current node and pedigree graph, independent of any other item's answer. An unrecognised predicate name SHALL cause the editor to log a warning and treat the condition as unsatisfied.

#### Scenario: A predicate-driven condition hides a field
- **WHEN** an item's `enableWhen` references the `isFetus` predicate and the current node is not a fetus
- **THEN** the item SHALL be hidden

#### Scenario: A predicate-driven condition updates when the graph changes
- **WHEN** a node's life-status is changed such that `isFetus` becomes true
- **THEN** any item enabled by the `isFetus` predicate SHALL become visible without closing and reopening the node menu

#### Scenario: Predicate and item-answer conditions combine via enableBehavior
- **WHEN** an item has one `enableWhen` condition referencing the `isRelatedToProband` predicate and one referencing a sibling item's answer, with `enableBehavior: 'all'`
- **THEN** the item SHALL only be visible when both conditions hold

#### Scenario: Unrecognised predicate name is skipped safely
- **WHEN** an `enableWhen` condition references a predicate name outside the supported set
- **THEN** the editor SHALL log a warning and treat that condition as unsatisfied, without failing to render the rest of the form

---

### Requirement: Predicates can disable specific option values within a visible field
A `radio` or `select`-rendered item MAY declare a predicate reference (via the same predicate extension) directly on the item, naming a predicate that resolves to the subset of its own answer options that should be unavailable, rather than a whole-item boolean. The supported per-option predicates are `possibleGenders`, `carrierAvailability`, and `lifeStatusAvailability`. The item SHALL remain visible with its other options selectable; the affected options SHALL be rendered disabled, not hidden.

#### Scenario: Gender options are constrained without hiding the field
- **WHEN** an item mapped to `gender` declares the `possibleGenders` per-option predicate, and the current node's relationships rule out `unknown` as a valid gender
- **THEN** the gender field SHALL remain visible with `male` and `female` selectable and `unknown` rendered disabled

#### Scenario: Carrier-status options are constrained by current disorders
- **WHEN** an item mapped to `carrierStatus` declares the `carrierAvailability` per-option predicate, and the node currently has no disorders recorded
- **THEN** carrier-status options that require an existing disorder SHALL render disabled while the rest remain selectable

#### Scenario: Life-status options are constrained once a node has ever had relationships
- **WHEN** an item mapped to `lifeStatus` declares the `lifeStatusAvailability` per-option predicate, and the node has previously had a relationship recorded
- **THEN** the `unborn`, `aborted`, `miscarriage`, and `stillborn` options SHALL render disabled while `alive` and `deceased` remain selectable

#### Scenario: An item can combine two whole-item predicates targeting different states
- **WHEN** an item mapped to `monozygotic` declares the `isTwin` whole-item predicate controlling visibility (`inactive`) and, separately, the `isTwinWithConsistentGender` whole-item predicate controlling its enabled/disabled state
- **THEN** the item SHALL be hidden entirely for a non-twin node, and visible-but-disabled for a twin node whose co-twins have a different gender

---

### Requirement: Action items invoke a built-in named action
An item may declare `invokesAction` (via the mapping extension) paired with a named action (via the extension `https://github.com/aehrc/open-pedigree/questionnaire-action`). The supported action names are exactly `linkPatient` and `importClinicalData`. Such an item SHALL render as a button using the item's `text` as its label, and SHALL invoke the corresponding built-in patient-provider action when clicked, without reading or writing any answer value.

#### Scenario: A linkPatient action item opens the patient picker
- **WHEN** a user clicks a button rendered from an item declaring `invokesAction: 'linkPatient'`
- **THEN** the editor SHALL open the patient-picker modal via the configured patient provider

#### Scenario: An action item's visibility follows the same predicate mechanism as any other item
- **WHEN** an item declaring `invokesAction: 'importClinicalData'` also declares an `enableWhen` condition referencing the `canImportClinicalData` predicate, and that predicate is currently false
- **THEN** the button SHALL be hidden

#### Scenario: Unrecognised action name is skipped safely
- **WHEN** an item declares `invokesAction` paired with an action name outside the supported set
- **THEN** the editor SHALL log a warning and SHALL NOT render that item
