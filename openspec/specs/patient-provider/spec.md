# patient-provider Specification

## Purpose
Pluggable patient-provider subsystem that allows the pedigree editor to link nodes to FHIR Patient resources and import clinical data. The host application supplies a concrete provider; the editor defaults to a no-op EmptyPatientProvider when none is given.

## Requirements

### Requirement: Editor accepts a pluggable patient provider
The editor SHALL accept a `patientProvider` option in `initialiseEditor()`. When no provider is supplied, the editor SHALL default to an `EmptyPatientProvider` that silently no-ops all operations.

#### Scenario: Editor initialises without a patient provider
- **WHEN** `initialiseEditor()` is called without a `patientProvider` option
- **THEN** the editor SHALL load normally with all pedigree features functional

#### Scenario: Editor initialises with a patient provider
- **WHEN** `initialiseEditor({ patientProvider: myProvider })` is called
- **THEN** the editor SHALL make `myProvider` available to node menu interactions

---

### Requirement: Patient provider interface defines four entry points
`AbstractPatientProvider` SHALL define: `openPatientPickerModal(nodeId, onSelected)`, `openClinicalImportModal(nodeId, fhirRef, onImported)`, `canImportClinicalData()`, and `lookupPatient(fhirRef, onSuccess, onError)`.

#### Scenario: openPatientPickerModal receives callback with selected patient
- **WHEN** a provider implementation calls `onSelected(fhirRef, displayName)` from within the picker modal
- **THEN** the editor SHALL store `fhirRef` on the node as `linkedPatientRef` and update the node display name

#### Scenario: lookupPatient resolves a patient reference to a display name
- **WHEN** `lookupPatient("Patient/123", onSuccess, onError)` is called
- **THEN** the provider SHALL call `onSuccess(displayName)` if the patient is found, or `onError(reason)` if not

#### Scenario: canImportClinicalData controls visibility of import button
- **WHEN** `provider.canImportClinicalData()` returns false
- **THEN** the "Import from record" button SHALL NOT be shown on the Clinical tab

---

### Requirement: Nodes store a linkedPatientRef property
Each pedigree node SHALL support a `linkedPatientRef` string property (e.g. `"Patient/123"`) that associates it with a FHIR Patient resource.

#### Scenario: linkedPatientRef is serialised and deserialised in internal JSON
- **WHEN** a pedigree containing nodes with `linkedPatientRef` is saved and reloaded
- **THEN** every node's `linkedPatientRef` SHALL be preserved exactly

#### Scenario: Node display name is resolved on load for linked nodes
- **WHEN** a pedigree is loaded and a node has a non-empty `linkedPatientRef`
- **THEN** the editor SHALL call `provider.lookupPatient()` and update the node's display name on success

---

### Requirement: Personal tab shows a Link to patient button
The node menu's Personal tab SHALL include a "Link to patient" button. When clicked it SHALL call `provider.openPatientPickerModal(nodeId, onSelected)`.

#### Scenario: Button is hidden when no meaningful provider is configured
- **WHEN** the active provider is `EmptyPatientProvider`
- **THEN** the "Link to patient" button SHALL NOT be visible

#### Scenario: Selecting a patient updates the node
- **WHEN** the user selects a patient in the picker and the provider calls `onSelected("Patient/42", "Jane Smith")`
- **THEN** the node SHALL have `linkedPatientRef` set to `"Patient/42"` and the display name updated to `"Jane Smith"`

---

### Requirement: Clinical tab shows an Import from record button
When `provider.canImportClinicalData()` returns true, the node menu's Clinical tab SHALL show an "Import from record" button. When clicked it SHALL call `provider.openClinicalImportModal(nodeId, linkedPatientRef, onImported)`.

#### Scenario: Importing conditions adds disorders to the node
- **WHEN** the provider calls `onImported([{ id: "73211009", name: "Diabetes mellitus" }])`
- **THEN** each entry SHALL be added to the node's disorders without removing existing disorders

#### Scenario: Import is blocked when node has no linked patient
- **WHEN** the node has no `linkedPatientRef` set
- **THEN** the "Import from record" button SHALL be disabled or hidden

---

### Requirement: FHIRPatientProvider implements the interface against a FHIR R4 server
`FHIRPatientProvider` SHALL accept a `fhirBaseUrl` option and implement patient search using `GET [base]/Patient?name=<query>` and clinical import using `GET [base]/Condition?patient=<id>`.

#### Scenario: Patient search returns matching patients
- **WHEN** the user types a search term in the FHIRPatientProvider modal
- **THEN** the modal SHALL display patients matching the name query from the FHIR server

#### Scenario: Condition import maps to disorders
- **WHEN** the user triggers clinical import for a linked node
- **THEN** `FHIRPatientProvider` SHALL fetch Conditions for that patient and call `onImported` with disorder entries derived from Condition.code
