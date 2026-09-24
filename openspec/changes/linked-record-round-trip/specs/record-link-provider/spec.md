## MODIFIED Requirements

### Requirement: openEditor and createNew dispatch answers through the existing setter-resolution path
`onDone` (from `openEditor`) SHALL receive an array of `{linkId: string, value: any}` entries, and `onCreated` (from `createNew`) SHALL receive `(recordRef: string, answers: {linkId: string, value: any}[])`. Each entry SHALL be resolved to its target through the same per-`linkId` setter-resolution priority already used for `patient-provider`'s `openClinicalImportModal` (reserved legend target → `mapsToField` target → generic `setQuestionnaireAnswer_<linkId>`), but applied with the refresh semantics in "A linked-record refresh applies the record's changes". `onCreated`'s `recordRef` argument SHALL be stored on the node the same way `openPicker`'s `onLinked` stores its `recordRef`. A newly-created record has its own ref the instant it exists, and without it the node could never satisfy the `canEditLinkedRecord` predicate (this capability's "Capability flags gate node-menu actions" requirement) afterward.

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

### Requirement: The editor remembers what the linked record last sent
After each `onDone`/`onCreated` dispatch, the node SHALL keep a snapshot of the linked record's non-empty values from that dispatch (legend lists as the record's entries). The answers are taken as the record's full state, so a linkId the dispatch leaves out drops from the snapshot (without clearing the node). The snapshot SHALL be saved and restored with the pedigree in both `internal` format (a `linkedRecordSnapshot` node property) and GA4GH format (a JSON `valueString` extension on the node's `Patient` resource, beside the linked-record ref and under the same privacy gate). The record-link actions SHALL reset it, in the same event as the new ref, only when the ref actually changes, so undoing a relink restores the previous snapshot and re-picking the same record keeps it.

#### Scenario: Snapshot survives a save and reload
- **WHEN** a refresh sends `note: "from the record"`, and the pedigree is saved as GA4GH and reloaded
- **THEN** the node's snapshot SHALL still be `{ note: "from the record" }`

#### Scenario: Relinking forgets what the old record sent, and undo brings it back
- **WHEN** a node's linked record ref changes from `record:1/instance:1` to `record:1/instance:2`, and the user then undoes that
- **THEN** its snapshot SHALL be empty after the relink, and back to the old record's snapshot after the undo

#### Scenario: Re-picking the same record keeps the snapshot
- **WHEN** a node linked to `record:1/instance:1` is linked to `record:1/instance:1` again
- **THEN** its snapshot SHALL be unchanged

### Requirement: A linked-record refresh applies the record's changes
An `onDone`/`onCreated` dispatch SHALL compare each answer with the node's snapshot (what the record sent last time), not with the node's current value:
- An answer equal to the snapshot SHALL change nothing, even if the node reads back differently (open-pedigree may normalise or reject values).
- A changed non-empty answer SHALL be set.
- A `null` (empty) answer SHALL clear the target only if the node still holds the snapshot's value. If it holds anything else (a diagram edit, or a value open-pedigree rejected), it SHALL be left alone. A value the record never sent is never cleared.

Clearing SHALL use a defined per-target clear:
- generic answers are removed
- names, comments, dates and carrier status become empty
- gender becomes `U`
- boolean targets return to their model default
- gestation age is unset
- childless status becomes `null`
- life status becomes `alive`

Twin-group rules SHALL apply as for any edit. When a refresh moves both the birth and death dates, they SHALL be applied in an order both setters accept (death first if the new birth date is after the current death date, otherwise birth first). A refresh that changes values SHALL be one undo step. A refresh that changes no values SHALL add no undo step. Setter side effects and open-pedigree's consistency rules (e.g. a fetus has no birth date) apply as for any edit, and are not reversed by the refresh.

#### Scenario: A value cleared in the record clears on the node
- **WHEN** the snapshot has `notes: "old"`, the node still shows `"old"`, and a refresh sends `notes: null`
- **THEN** the node's `notes` answer SHALL be removed

#### Scenario: A diagram-entered value survives
- **WHEN** a node has a birth date entered in the diagram, which the record never sent, and a refresh sends `null` for it
- **THEN** the node's birth date SHALL be unchanged

#### Scenario: A rejected value, later emptied, doesn't wipe the diagram's value
- **WHEN** a male partnered with a female is refreshed with gender `F` (rejected by partnership rules), and later with gender `null`
- **THEN** the node's gender SHALL stay `M`

#### Scenario: An unchanged value that open-pedigree stores differently settles
- **WHEN** a live-born person is refreshed repeatedly with the same gestation age
- **THEN** only the first refresh SHALL add an undo step

#### Scenario: Clearing gender and zero values works
- **WHEN** the snapshot has gender `F` and an integer `0` that the node still holds, and a refresh sends `null` for both
- **THEN** gender SHALL become `U`, and the integer answer SHALL be removed

#### Scenario: Monozygotic twins stay the same gender
- **WHEN** a refresh sets gender on a monozygotic twin
- **THEN** the other twin's gender SHALL follow

#### Scenario: Moving both dates applies both
- **WHEN** a refresh moves birth and death from 1950–1960 to 1970–2020, and later to 1900–1910
- **THEN** the node SHALL show exactly the record's dates each time

### Requirement: Legend lists are reconciled, not merged, on refresh
For a legend list (the reserved disorders/genes/phenotypes targets, or a custom legend item), whose entries may arrive as `{id, name}`, `{system, code, display}` or plain codes, a refresh SHALL remove entries the record sent last time and no longer does, add entries it newly sends, and keep entries the record never sent. Reserved legend entries SHALL be matched through the same ID sanitising the legend uses (e.g. `HP:0001250` is stored as `HP_C_0001250`), so re-sending an entry doesn't duplicate it. `patient-provider`'s one-off import SHALL keep merging as today.

#### Scenario: A dropped disorder is removed; a diagram-entered one is kept
- **WHEN** the snapshot's `disorders` are `D1`, the node also has diagram-entered `D9`, and a refresh sends no disorders
- **THEN** the node's disorders SHALL be `D9`

#### Scenario: A changed disorder replaces the old one
- **WHEN** the snapshot's `disorders` are `D1`, and a refresh sends `[{id: "D2", name: "…"}]`
- **THEN** the node's disorders SHALL contain `D2` and not `D1` (plus any diagram-entered entries)

#### Scenario: Sanitised phenotype IDs don't duplicate and can be removed
- **WHEN** a refresh sends phenotype `HP:0001250` twice, and later sends none
- **THEN** the node SHALL have one `HP_C_0001250` after the first two refreshes (the second adding no undo step), and none after the third
