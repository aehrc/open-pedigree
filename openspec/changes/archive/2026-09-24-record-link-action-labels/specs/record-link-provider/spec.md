## MODIFIED Requirements

### Requirement: Record-link provider interface is presentation-agnostic
`AbstractRecordLinkProvider` SHALL define `isConfigured()`, `canLink(nodeId)`, `canCreateNew(nodeId)`, `openPicker(nodeId, onLinked)`, `openEditor(nodeId, onDone)`, and `createNew(nodeId, onCreated)`, plus the optional `getActionLabel(action)` (see "A provider can relabel its node-menu actions"), which only supplies button text. None of these methods SHALL take or return any browser-window-specific type (e.g. a `Window` handle); the editor SHALL NOT track, poll, or otherwise manage the lifecycle of any window a provider implementation chooses to open.

#### Scenario: Provider opens a new window without editor involvement
- **WHEN** a concrete provider's `openEditor` implementation opens a new browser window internally and later calls `onDone(answers)` once that window closes
- **THEN** the editor SHALL treat this identically to a provider that never opened any window at all — it only reacts to the `onDone` callback

#### Scenario: openPicker links a node to an external record
- **WHEN** a provider implementation calls `onLinked(recordRef, details)` from within its own picker UI
- **THEN** the editor SHALL store `recordRef` on the node (`Person.setLinkedRecordRef`/`getLinkedRecordRef`), retrievable by any provider method via `window.editor.getView().getNode(nodeId).getLinkedRecordRef()` - the same pattern `SmartPatientProvider` already uses to read node state from inside a concrete provider. `openEditor`/`canLink`/`canCreateNew` deliberately stay nodeId-only (no separate `recordRef` parameter) so all three remain uniform; a provider that needs the current ref to know which record to edit looks it up itself rather than being handed it

## ADDED Requirements

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
