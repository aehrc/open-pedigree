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
`onDone` (from `openEditor`) SHALL receive an array of `{linkId: string, value: any}` entries, and `onCreated` (from `createNew`) SHALL receive `(recordRef: string, answers: {linkId: string, value: any}[])` - the `answers` array in both cases dispatched through the same per-`linkId` setter-resolution priority already used for `patient-provider`'s `openClinicalImportModal` (reserved legend target → `mapsToField` target → generic `setQuestionnaireAnswer_<linkId>`). `onCreated`'s `recordRef` argument SHALL be stored on the node the same way `openPicker`'s `onLinked` stores its `recordRef` - a newly-created record has its own ref the instant it exists, and without it the node could never satisfy the `canEditLinkedRecord` predicate (this capability's "Capability flags gate node-menu actions" requirement) afterward.

#### Scenario: openEditor's onDone updates node properties
- **WHEN** a provider calls `onDone([{ linkId: "gender", value: "F" }])` for an item mapped via `mapsToField` to `gender`
- **THEN** the node's gender SHALL be set via the existing `setGender` dispatch, identically to how `patient-provider`'s import dispatches the same entry shape

#### Scenario: createNew's onCreated stores the new record's ref and behaves identically to onDone for the rest
- **WHEN** a provider calls `onCreated("Record/99", [{ linkId: "custom_note", value: "some text" }])` after creating a brand-new linked record
- **THEN** the node's linked record ref SHALL be set to `"Record/99"` (making `canEditLinkedRecord` satisfiable for that node from then on)
- **AND** the `answers` array's dispatch behavior SHALL be identical to an equivalent `onDone` call with the same entries

---

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

