## MODIFIED Requirements

### Requirement: openEditor and createNew dispatch answers through the existing setter-resolution path
`onDone` (from `openEditor`) SHALL receive an array of `{linkId: string, value: any}` entries, and `onCreated` (from `createNew`) SHALL receive `(recordRef: string, answers: {linkId: string, value: any}[])`. Each entry SHALL be resolved to its target through the same per-`linkId` setter-resolution priority already used for `patient-provider`'s `openClinicalImportModal` (reserved legend target → `mapsToField` target → generic `setQuestionnaireAnswer_<linkId>`), but applied with the refresh semantics in "A linked-record refresh applies the record's changes" for `onDone`, and for `onCreated` as for linking a record ("Linking a record can bring its answers"), since the node is linked to the new record in the same event. `onCreated`'s `recordRef` argument SHALL be stored on the node the same way `openPicker`'s `onLinked` stores its `recordRef`. A newly-created record has its own ref the instant it exists, and without it the node could never satisfy the `canEditLinkedRecord` predicate (this capability's "Capability flags gate node-menu actions" requirement) afterward.

#### Scenario: openEditor's onDone updates node properties
- **WHEN** a provider calls `onDone([{ linkId: "gender", value: "F" }])` for an item mapped via `mapsToField` to `gender`
- **THEN** the node's gender SHALL be set through the same `setGender` target that `patient-provider`'s import resolves the same entry shape to

#### Scenario: createNew's onCreated stores the new record's ref and behaves identically to onDone for the rest
- **WHEN** a provider calls `onCreated("Record/99", [{ linkId: "custom_note", value: "some text" }])` after creating a brand-new linked record
- **THEN** the node's linked record ref SHALL be set to `"Record/99"` (making `canEditLinkedRecord` satisfiable for that node from then on)
- **AND** the `answers` SHALL be applied as for `onLinked` with the same entries: for a node with no previous record, every non-empty answer is set

### Requirement: A linked-record refresh applies the record's changes
An `onDone` dispatch, and an `onCreated` or `onLinked` dispatch for the record the node is already linked to, SHALL compare each answer with the node's snapshot (what the record sent last time), not with the node's current value (for a different record, see "Linking a record can bring its answers"):
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

Twin-group rules SHALL apply as for any edit. When any event (a refresh, an undo, an edit) sets both the birth and death dates, they SHALL be applied in an order both setters accept (death first if the new birth date is on or after the current death date, otherwise birth first). Undo SHALL restore every value the event changed, including ones a setter changed as a side effect. A refresh SHALL NOT be applied if the node's linked record ref has changed since the edit began. A refresh that changes values SHALL be one undo step. A refresh that changes no values SHALL add no undo step. Setter side effects and open-pedigree's consistency rules (e.g. a fetus has no birth date) apply as for any edit, and are not reversed by the refresh.

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
- **WHEN** a refresh moves birth and death from 1950–1960 to 1970–2020 (then undone), or to 1960–1970 (a birth on the old death day), or to 1900–1910
- **THEN** the node SHALL show exactly the record's dates each time, and undo SHALL restore the previous pair

### Requirement: The editor remembers what the linked record last sent
After each `onDone`/`onCreated` dispatch, and each `onLinked` call with answers, the node SHALL keep a snapshot of the linked record's non-empty values from that dispatch (legend lists as the record's entries). The answers are taken as the record's full state, so a linkId the dispatch leaves out drops from the snapshot (without clearing the node, except as "Linking a record can bring its answers" describes for a different record). The snapshot SHALL be saved and restored with the pedigree in both `internal` format (a `linkedRecordSnapshot` node property) and GA4GH format (a JSON `valueString` extension on the node's `Patient` resource, beside the linked-record ref and under the same privacy gate). A record-link action that changes the ref SHALL replace it in the same event as the new ref: with the new record's answers when it brings them, otherwise with an empty snapshot. So undoing a relink restores the previous snapshot, and re-picking the same record without answers keeps it.

#### Scenario: Snapshot survives a save and reload
- **WHEN** a refresh sends `note: "from the record"`, and the pedigree is saved as GA4GH and reloaded
- **THEN** the node's snapshot SHALL still be `{ note: "from the record" }`

#### Scenario: Relinking forgets what the old record sent, and undo brings it back
- **WHEN** a node's linked record ref changes from `record:1/instance:1` to `record:1/instance:2` without answers, and the user then undoes that
- **THEN** its snapshot SHALL be empty after the relink, and back to the old record's snapshot after the undo

#### Scenario: Re-picking the same record keeps the snapshot
- **WHEN** a node linked to `record:1/instance:1` is linked to `record:1/instance:1` again without answers
- **THEN** its snapshot SHALL be unchanged

## ADDED Requirements

### Requirement: Linking a record can bring its answers
`openPicker`'s `onLinked` callback SHALL accept an optional third argument, `answers`, an array of `{linkId: string, value: any}` entries, the same shape as `onCreated`'s. When it is an array, the editor SHALL store `recordRef` on the node and apply `answers` in one event, as it does for `onCreated`, with the ref ahead of the values in that event. A single undo SHALL remove the link and the values together. For the node's current record (a re-pick), `answers` SHALL be applied as an ordinary refresh ("A linked-record refresh applies the record's changes"). For a different record (including a first link), every non-empty value the record sends SHALL be applied. The previous record's values SHALL be cleared where the new record has none - including linkIds the new record leaves out - but only while the node still holds them, so values entered in the diagram stay. For a legend list, the previous record's entries the new record doesn't send are removed, the new record's entries are added, and entries that never came from a record stay. When `answers` is absent or not an array, `onLinked` SHALL store the ref only, as before.

#### Scenario: Linking brings the record's values in
- **WHEN** a provider calls `onLinked("Record/42", {}, [{ linkId: "ext_field_a", value: "from the record" }])`
- **THEN** the node's linked record ref SHALL be `"Record/42"`, and its `ext_field_a` answer SHALL be `"from the record"`

#### Scenario: Linking without answers only sets the ref
- **WHEN** a provider calls `onLinked("Record/42", {})`
- **THEN** the node's linked record ref SHALL be `"Record/42"`, and no answers SHALL be applied

#### Scenario: Relinking to another record replaces the old record's values
- **WHEN** a node linked to `Record/1`, whose answers set `ext_field_a` to `"one"`, is linked to `Record/2` with answers `[{ linkId: "ext_field_a", value: "two" }]`
- **THEN** `ext_field_a` SHALL be `"two"`, and the node's snapshot SHALL be `Record/2`'s answers only

#### Scenario: Relinking applies a value the new record shares with the old one
- **WHEN** a node linked to `record:1/instance:1`, whose answers set `note` to `"X"`, has `note` changed to `"Y"` in the diagram, and is then linked to `record:1/instance:2` with answers `note: "X"`
- **THEN** `note` SHALL be `"X"`

#### Scenario: Relinking to a record without a value clears the old record's value
- **WHEN** a node linked to `record:1/instance:1`, whose answers set `note` and `count`, has `count` changed in the diagram, and is then linked to `record:1/instance:2` with answers `note: null, count: null`
- **THEN** `note` SHALL be cleared, `count` SHALL keep the diagram's value, and the snapshot SHALL be empty

#### Scenario: One undo removes a link and its values
- **WHEN** a node is linked with answers and the user undoes once
- **THEN** the node SHALL be unlinked, and the values the link brought SHALL be gone
