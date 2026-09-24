# record-link-provider Specification

## Purpose
Pluggable, presentation-agnostic record-link-provider subsystem that lets the pedigree editor link a node to an external record (e.g. a REDCap repeating-instrument row), edit it via the host's own native editing surface (a window, a modal, or anything else), and refresh the node's data once editing completes. A sibling to `patient-provider`, not a modification of it - both can be configured together. The host application supplies a concrete provider; the editor defaults to a no-op `EmptyRecordLinkProvider` when none is given.
## Requirements
### Requirement: Editor accepts a pluggable record-link provider
The editor SHALL accept a `recordLinkProvider` option in `initialiseEditor()`, independent of and coexisting with `patientProvider`. When no provider is supplied, the editor SHALL default to an `EmptyRecordLinkProvider` that silently no-ops all operations and reports itself as not configured.

#### Scenario: Editor initialises without a record-link provider
- **WHEN** `initialiseEditor()` is called without a `recordLinkProvider` option
- **THEN** the editor SHALL load normally with all other pedigree features functional
- **AND** `EmptyRecordLinkProvider.isConfigured()` SHALL return `false`

#### Scenario: Editor initialises with both a patient provider and a record-link provider
- **WHEN** `initialiseEditor({ patientProvider: myPatientProvider, recordLinkProvider: myRecordLinkProvider })` is called
- **THEN** both providers SHALL be independently available to node menu interactions with no interference between them

---

### Requirement: Record-link provider interface is presentation-agnostic
`AbstractRecordLinkProvider` SHALL define `isConfigured()`, `canLink(nodeId)`, `canCreateNew(nodeId)`, `openPicker(nodeId, onLinked)`, `openEditor(nodeId, onDone)`, and `createNew(nodeId, onCreated)`, plus the optional `getActionLabel(action)` (see "A provider can relabel its node-menu actions"), which only supplies button text. None of these methods SHALL take or return any browser-window-specific type (e.g. a `Window` handle); the editor SHALL NOT track, poll, or otherwise manage the lifecycle of any window a provider implementation chooses to open.

#### Scenario: Provider opens a new window without editor involvement
- **WHEN** a concrete provider's `openEditor` implementation opens a new browser window internally and later calls `onDone(answers)` once that window closes
- **THEN** the editor SHALL treat this identically to a provider that never opened any window at all — it only reacts to the `onDone` callback

#### Scenario: openPicker links a node to an external record
- **WHEN** a provider implementation calls `onLinked(recordRef, details)` from within its own picker UI
- **THEN** the editor SHALL store `recordRef` on the node (`Person.setLinkedRecordRef`/`getLinkedRecordRef`), retrievable by any provider method via `window.editor.getView().getNode(nodeId).getLinkedRecordRef()` - the same pattern `SmartPatientProvider` already uses to read node state from inside a concrete provider. `openEditor`/`canLink`/`canCreateNew` deliberately stay nodeId-only (no separate `recordRef` parameter) so all three remain uniform; a provider that needs the current ref to know which record to edit looks it up itself rather than being handed it

### Requirement: openEditor and createNew dispatch answers through the existing setter-resolution path
`onDone` (from `openEditor`) SHALL receive an array of `{linkId: string, value: any}` entries, and `onCreated` (from `createNew`) SHALL receive `(recordRef: string, answers: {linkId: string, value: any}[])`. Each entry SHALL be resolved to its target through the same per-`linkId` setter-resolution priority already used for `patient-provider`'s `openClinicalImportModal` (reserved legend target → `mapsToField` target → generic `setQuestionnaireAnswer_<linkId>`), but applied with the refresh semantics in "A linked-record refresh applies the record's changes". `onCreated`'s `recordRef` argument SHALL be stored on the node the same way `openPicker`'s `onLinked` stores its `recordRef`. A newly-created record has its own ref the instant it exists, and without it the node could never satisfy the `canEditLinkedRecord` predicate (this capability's "Capability flags gate node-menu actions" requirement) afterward.

#### Scenario: openEditor's onDone updates node properties
- **WHEN** a provider calls `onDone([{ linkId: "gender", value: "F" }])` for an item mapped via `mapsToField` to `gender`
- **THEN** the node's gender SHALL be set through the same `setGender` target that `patient-provider`'s import resolves the same entry shape to

#### Scenario: createNew's onCreated stores the new record's ref and behaves identically to onDone for the rest
- **WHEN** a provider calls `onCreated("Record/99", [{ linkId: "custom_note", value: "some text" }])` after creating a brand-new linked record
- **THEN** the node's linked record ref SHALL be set to `"Record/99"` (making `canEditLinkedRecord` satisfiable for that node from then on)
- **AND** the `answers` array's dispatch behavior SHALL be identical to an equivalent `onDone` call with the same entries

### Requirement: Capability flags gate node-menu actions
`canLink(nodeId)` and `canCreateNew(nodeId)` SHALL independently control whether linking-to-existing-record and creating-a-new-record actions are available for a given node.

#### Scenario: canCreateNew false hides the create-new action
- **WHEN** `provider.canCreateNew(nodeId)` returns `false` for a given node
- **THEN** the node menu SHALL NOT offer a create-new-linked-record action for that node

#### Scenario: canLink false hides the link-to-existing action
- **WHEN** `provider.canLink(nodeId)` returns `false` for a given node
- **THEN** the node menu SHALL NOT offer a link-to-existing-record action for that node

### Requirement: A provider can relabel its node-menu actions
`AbstractRecordLinkProvider` SHALL offer an optional `getActionLabel(action)` method, where `action` is one of `linkRecord`, `createNewRecord` or `editRecord`. The editor SHALL use a non-blank string it returns as that action's button label, and SHALL otherwise use the generic default ("Link to existing record", "Create new linked record", "Edit linked record"). The editor SHALL only call the method if the provider has it, since hosts outside this repo supply a provider object that does not extend `AbstractRecordLinkProvider` (the class is not exported from the bundle). Labels SHALL be resolved when the Questionnaire is parsed, not per node; if the method throws, the editor SHALL keep the default label and continue loading.

#### Scenario: A provider relabels one action
- **WHEN** a provider's `getActionLabel('editRecord')` returns "Edit in REDCap" and it returns `undefined` for the other actions
- **THEN** the Edit action's button reads "Edit in REDCap", and Link/Create-new keep their default labels

#### Scenario: A blank or non-string label is ignored
- **WHEN** `getActionLabel` returns a blank string or a non-string value for an action
- **THEN** that action keeps its default label

#### Scenario: A throwing label hook doesn't break the editor
- **WHEN** `getActionLabel` throws
- **THEN** the editor still loads, and the affected actions keep their default labels

#### Scenario: A provider without the method keeps the defaults
- **WHEN** the configured provider has no `getActionLabel` method, or the editor uses `EmptyRecordLinkProvider`
- **THEN** all three actions keep their default labels

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

