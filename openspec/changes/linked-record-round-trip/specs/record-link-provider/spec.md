## MODIFIED Requirements

### Requirement: openEditor and createNew dispatch answers through the existing setter-resolution path
`onDone` (from `openEditor`) SHALL receive an array of `{linkId: string, value: any}` entries, and `onCreated` (from `createNew`) SHALL receive `(recordRef: string, answers: {linkId: string, value: any}[])`. Each entry SHALL be resolved to its target through the same per-`linkId` setter-resolution priority already used for `patient-provider`'s `openClinicalImportModal` (reserved legend target → `mapsToField` target → generic `setQuestionnaireAnswer_<linkId>`), but applied with the refresh semantics in "A linked-record refresh mirrors the record's values". `onCreated`'s `recordRef` argument SHALL be stored on the node the same way `openPicker`'s `onLinked` stores its `recordRef`. A newly-created record has its own ref the instant it exists, and without it the node could never satisfy the `canEditLinkedRecord` predicate (this capability's "Capability flags gate node-menu actions" requirement) afterward.

#### Scenario: openEditor's onDone updates node properties
- **WHEN** a provider calls `onDone([{ linkId: "gender", value: "F" }])` for an item mapped via `mapsToField` to `gender`
- **THEN** the node's gender SHALL be set through the same `setGender` target that `patient-provider`'s import resolves the same entry shape to

#### Scenario: createNew's onCreated stores the new record's ref and behaves identically to onDone for the rest
- **WHEN** a provider calls `onCreated("Record/99", [{ linkId: "custom_note", value: "some text" }])` after creating a brand-new linked record
- **THEN** the node's linked record ref SHALL be set to `"Record/99"` (making `canEditLinkedRecord` satisfiable for that node from then on)
- **AND** the `answers` array's dispatch behavior SHALL be identical to an equivalent `onDone` call with the same entries

## ADDED Requirements

### Requirement: A node's linked record survives saving and loading in GA4GH format
When a pedigree is exported as GA4GH FHIR, each node's linked record ref SHALL be written as an extension on that node's `Patient` resource. When a GA4GH document is imported, such an extension SHALL restore the node's linked record ref. The `internal` format SHALL keep persisting it as today.

#### Scenario: Save and reload keeps the link
- **WHEN** a node linked to `record:1/instance:1` is exported as GA4GH and the result is imported again
- **THEN** the reloaded node's linked record ref SHALL be `record:1/instance:1`, and `canEditLinkedRecord` SHALL be satisfiable for it

#### Scenario: Unlinked nodes carry no extension
- **WHEN** a node with no linked record is exported as GA4GH
- **THEN** its `Patient` resource SHALL carry no linked-record extension

### Requirement: The editor remembers which values the linked record supplied
After each `onDone`/`onCreated` dispatch, the node SHALL record which linkIds received a non-empty value from the linked record, and for reserved legend targets which entry IDs. This supplied set SHALL be saved and restored with the pedigree in both `internal` and GA4GH formats (GA4GH: as extensions on the corresponding QuestionnaireResponse items and answers). It SHALL be cleared when the node's linked record ref changes (relinked or unlinked).

#### Scenario: Supplied set survives a save and reload
- **WHEN** a refresh supplies `first_name` and the legend entry `D1`, and the pedigree is saved as GA4GH and reloaded
- **THEN** the node's supplied set SHALL still contain `first_name` and legend entry `D1`

#### Scenario: Relinking forgets what the old record supplied
- **WHEN** a node's linked record ref changes from `record:1/instance:1` to `record:1/instance:2`
- **THEN** its supplied set SHALL be empty until the next refresh

### Requirement: A linked-record refresh mirrors the record's values
An `onDone`/`onCreated` dispatch SHALL treat its answers as the linked record's current state:
- A non-empty value SHALL be set.
- A `null` value for a linkId in the node's supplied set SHALL clear that target.
- A `null` value for a linkId not in the supplied set SHALL leave the node's value unchanged, so values entered in the diagram are never wiped by a record that never supplied them.

Clearing SHALL use a defined per-target clear rather than the generic setter with `''`:
- generic answers are removed
- names, comments and dates become empty
- gender becomes `U`
- carrier status becomes empty
- boolean targets return to their model default
- gestation age is unset
- life status becomes `alive`, clearing any death date

Comparisons SHALL be strict, a refresh SHALL NOT propagate values to twins, and one refresh that changes anything SHALL be exactly one undo step. A refresh that changes nothing SHALL add no undo step.

#### Scenario: A value cleared in the record clears on the node
- **WHEN** the node's supplied set contains `notes`, and a refresh sends `{ linkId: "notes", value: null }`
- **THEN** the node's `notes` answer SHALL be removed

#### Scenario: A diagram-entered value survives a sparse record
- **WHEN** a node has a birth date entered in the diagram, its supplied set doesn't contain the birth-date item, and a refresh sends `null` for it
- **THEN** the node's birth date SHALL be unchanged

#### Scenario: Clearing gender and zero values works
- **WHEN** the supplied set contains the gender item and an integer item currently `0`, and a refresh sends `null` for both
- **THEN** gender SHALL become `U`, and the integer answer SHALL be removed

#### Scenario: No-op refresh leaves undo untouched
- **WHEN** a refresh sends exactly the node's current values
- **THEN** no undo step SHALL be added

#### Scenario: Refresh doesn't touch twins
- **WHEN** a refresh changes the adopted flag on a node that is a twin
- **THEN** the twin's adopted flag SHALL be unchanged

### Requirement: Legend lists are reconciled, not merged, on refresh
For a reserved legend target, a refresh SHALL remove previously-supplied entries the record no longer contains, add entries it newly contains, and keep entries that were never supplied by the record (entered in the diagram). `patient-provider`'s one-off import SHALL keep merging as today.

#### Scenario: A disorder removed in the record is removed from the node
- **WHEN** the supplied set's `disorders` entries are `D1`, and a refresh sends `disorders` with no `D1` entry (or `null`)
- **THEN** `D1` SHALL be removed from the node's disorders

#### Scenario: A diagram-entered disorder is kept
- **WHEN** the node also has disorder `D9`, entered in the diagram and never supplied by the record
- **THEN** `D9` SHALL remain after the refresh

#### Scenario: A changed disorder replaces the old one
- **WHEN** the supplied `disorders` entries are `D1`, and a refresh sends `[{id: "D2", name: "…"}]`
- **THEN** the node's disorders SHALL contain `D2` and not `D1` (plus any diagram-entered entries)
