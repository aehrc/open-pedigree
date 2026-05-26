# autosave Specification

## Purpose
Allow integrations with no explicit Save button to automatically persist the
pedigree after every mutating action.

## Requirements

### Requirement: autosave option accepted by initialiseEditor
`OpenPedigree.initialiseEditor(options)` SHALL accept an `autosave: true` boolean
option. When set, the editor SHALL call the save backend after every action that
fires `pedigree:graph:changed`.

#### Scenario: Save triggered after adding a node
- **WHEN** `autosave: true` is passed to `initialiseEditor`
- **AND** the user adds a new person node
- **THEN** the save backend is called automatically without the user pressing Save

#### Scenario: autosave disabled by default
- **WHEN** `autosave` is omitted from the options
- **THEN** no automatic save occurs on graph changes; save only happens when explicitly triggered

### Requirement: autosave fires after undo and redo
The autosave listener SHALL fire on all `pedigree:graph:changed` events including
those triggered by undo and redo operations.

#### Scenario: Save triggered after undo
- **WHEN** `autosave: true` is set
- **AND** the user presses Undo
- **THEN** the save backend is called with the post-undo graph state

### Requirement: autosave does not fire during load
The autosave listener SHALL NOT trigger a save during the initial data load sequence.

#### Scenario: No save on initial load
- **WHEN** the editor loads existing pedigree data on startup
- **THEN** the save backend is not called as part of the load sequence
