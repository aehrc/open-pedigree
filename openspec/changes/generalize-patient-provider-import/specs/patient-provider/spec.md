## MODIFIED Requirements

### Requirement: Patient provider interface defines four entry points and three feature flags
`AbstractPatientProvider` SHALL define: `openPatientPickerModal(nodeId, onSelected)`, `openClinicalImportModal(nodeId, patientRef, onImported)`, `canImportClinicalData()`, and `lookupPatient(patientRef, onSuccess, onError)`. It SHALL also expose `canSearchFamilyMembers()` and `canLinkProband()`, both defaulting to `true`, which control visibility of the patient-link button for non-proband and proband nodes respectively.

#### Scenario: openPatientPickerModal receives callback with selected patient
- **WHEN** a provider implementation calls `onSelected(patientRef, displayName)` from within the picker modal
- **THEN** the editor SHALL store `patientRef` on the node as `linkedPatientRef` and update the node display name

#### Scenario: lookupPatient resolves a patient reference to a display name
- **WHEN** `lookupPatient("Patient/123", onSuccess, onError)` is called
- **THEN** the provider SHALL call `onSuccess(displayName)` if the patient is found, or `onError(reason)` if not

#### Scenario: canImportClinicalData controls visibility of import button
- **WHEN** `provider.canImportClinicalData()` returns false
- **THEN** the "Import from record" button SHALL NOT be shown on the Clinical tab

#### Scenario: canLinkProband controls visibility of patient-link button on proband
- **WHEN** `provider.canLinkProband()` returns false
- **THEN** the "Link to patient" button SHALL NOT be shown for the proband node

#### Scenario: canSearchFamilyMembers controls visibility of patient-link button on non-proband nodes
- **WHEN** `provider.canSearchFamilyMembers()` returns false
- **THEN** the "Link to patient" button SHALL NOT be shown for any non-proband node

---

### Requirement: Clinical tab shows an Import from record button
When `provider.canImportClinicalData()` returns true, the node menu's Clinical tab SHALL show an "Import from record" button. When clicked it SHALL call `provider.openClinicalImportModal(nodeId, linkedPatientRef, onImported)`, where `onImported` receives an array of `{linkId, value}` entries — one per imported Questionnaire item — rather than a disorders-only list. For each entry, the editor SHALL resolve the same per-`linkId` setter-dispatch priority `generateNodeMenu()` already uses when rendering the form: a reserved legend target (`disorders`/`candidate_genes`/`hpo_positive`), then a `mapsToField` target, then the item's generic `setQuestionnaireAnswer_<linkId>` setter.

#### Scenario: Importing a reserved legend target merges without removing existing entries
- **WHEN** the provider calls `onImported([{ linkId: "disorders", value: [{ id: "73211009", name: "Diabetes mellitus" }] }])`
- **THEN** the entry SHALL be added to the node's disorders without removing existing disorders, deduplicated by `id`

#### Scenario: Importing a mapsToField target dispatches through its real setter
- **WHEN** the provider calls `onImported([{ linkId: "gender", value: "F" }])` for an item mapped via `mapsToField` to `gender`
- **THEN** the node's gender SHALL be set via the existing `setGender` dispatch, overwriting any current value

#### Scenario: Importing a plain unmapped item dispatches through its generic setter
- **WHEN** the provider calls `onImported([{ linkId: "custom_note", value: "some text" }])` for a plain, unmapped Questionnaire item
- **THEN** the node's `custom_note` Questionnaire answer SHALL be set via `setQuestionnaireAnswer_custom_note`, overwriting any current value

#### Scenario: Importing multiple entries of different mapping kinds in one call
- **WHEN** the provider calls `onImported` with entries covering a reserved legend target, a `mapsToField` target, and a plain unmapped item in the same array
- **THEN** each entry SHALL be dispatched through its own resolved setter independently, with no entry's dispatch affecting another's

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
- **THEN** `FHIRPatientProvider` SHALL fetch Conditions for that patient and call `onImported` with a single `{ linkId: "disorders", value: [...] }` entry containing disorder entries derived from `Condition.code`

## ADDED Requirements

### Requirement: GA4GH export excludes non-FHIR-shaped linked references
GA4GH FHIR export SHALL only use a node's `linkedPatientRef` as the exported Patient reference when it begins with `Patient/`. A `linkedPatientRef` in any other format SHALL be excluded from that role, and export SHALL fall back to its default (non-linked) reference generation.

#### Scenario: FHIR-shaped linkedPatientRef is used as the exported reference
- **WHEN** a node has `linkedPatientRef` set to `"Patient/42"`
- **THEN** GA4GH export SHALL use `"Patient/42"` as the exported Patient reference

#### Scenario: Non-FHIR-shaped linkedPatientRef is excluded
- **WHEN** a node has `linkedPatientRef` set to a non-`Patient/`-prefixed value (e.g. a REDCap-shaped reference)
- **THEN** GA4GH export SHALL NOT use that value as the exported Patient reference
- **AND** SHALL instead use its default reference generation for that node
