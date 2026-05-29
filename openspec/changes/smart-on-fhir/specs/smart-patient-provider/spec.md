## ADDED Requirements

### Requirement: SmartPatientProvider wraps FHIRPatientProvider with SMART context
`SmartPatientProvider` SHALL accept a fhirclient v2 SMART client at construction time and internally construct a `FHIRPatientProvider` configured to route requests through that client.

#### Scenario: SmartPatientProvider uses authenticated FHIR requests
- **WHEN** `SmartPatientProvider` is constructed with a fhirclient v2 `client`
- **THEN** all FHIR Patient search and Condition fetch requests SHALL be made via `client.request()` rather than unauthenticated jQuery calls

#### Scenario: SmartPatientProvider falls back to empty provider on construction failure
- **WHEN** the fhirclient `client` passed to `SmartPatientProvider` is null or undefined
- **THEN** the provider SHALL behave identically to `EmptyPatientProvider` and log a warning

### Requirement: SmartPatientProvider exposes a prepopulateProband method
`SmartPatientProvider` SHALL expose an async `prepopulateProband(probandNodeId)` method that reads the SMART context patient and links it to the proband node if that node has no existing `linkedPatientRef`.

#### Scenario: Proband auto-linked on new pedigree
- **WHEN** `prepopulateProband(probandNodeId)` is called and the proband node has no `linkedPatientRef`
- **THEN** the provider SHALL call `client.patient.read()`, then link the resulting Patient ref and display name to the proband node using the editor's node-link mechanism

#### Scenario: Existing proband link is not overwritten
- **WHEN** `prepopulateProband(probandNodeId)` is called and the proband node already has a `linkedPatientRef`
- **THEN** the provider SHALL take no action and leave the existing link unchanged

#### Scenario: prepopulateProband handles FHIR read failure gracefully
- **WHEN** `client.patient.read()` rejects (e.g. network error or missing patient scope)
- **THEN** `prepopulateProband` SHALL resolve without linking and log a warning; the editor SHALL remain functional

### Requirement: SmartPatientProvider hides the proband patient-link button
`SmartPatientProvider` SHALL return `false` from `canLinkProband()`. In the SMART context the proband is always the EHR launch-context patient; allowing the user to re-link the proband to a different patient would break the pedigree's relationship to the EHR record.

#### Scenario: Link to patient button hidden for proband in SMART context
- **WHEN** `SmartPatientProvider` is the active provider and the proband node menu is opened
- **THEN** the "Link to patient" button SHALL NOT be visible in the Personal tab

#### Scenario: Link to patient button visible for proband with generic provider
- **WHEN** a generic provider (e.g. `FHIRPatientProvider`) is the active provider and the proband node menu is opened
- **THEN** the "Link to patient" button SHALL be visible, as the proband is not pre-determined by a launch context

### Requirement: SmartPatientProvider checks granted scopes for feature availability
`SmartPatientProvider` SHALL expose `canSearchFamilyMembers()` and `canImportClinicalData()` based on the scopes present in the SMART token response.

#### Scenario: Family member search enabled when user/Patient.read granted
- **WHEN** the SMART token response includes `user/Patient.read` in its granted scopes
- **THEN** `canSearchFamilyMembers()` SHALL return true

#### Scenario: Family member search disabled when user/Patient.read absent
- **WHEN** the SMART token response does not include `user/Patient.read`
- **THEN** `canSearchFamilyMembers()` SHALL return false and the patient picker SHALL not be shown for non-proband nodes

#### Scenario: Clinical import enabled when user/Condition.read granted
- **WHEN** the SMART token response includes `user/Condition.read`
- **THEN** `canImportClinicalData()` SHALL return true

#### Scenario: Clinical import disabled when user/Condition.read absent
- **WHEN** the SMART token response does not include `user/Condition.read`
- **THEN** `canImportClinicalData()` SHALL return false and the "Import from record" button SHALL not be shown

### Requirement: SmartPatientProvider is exported from the OpenPedigree bundle
`SmartPatientProvider` SHALL be accessible as `OpenPedigree.SmartPatientProvider` from the SMART editor bundle (`dist/smartEditor.min.js`).

#### Scenario: SmartPatientProvider available on OpenPedigree global
- **WHEN** `dist/smartEditor.min.js` is loaded
- **THEN** `window.OpenPedigree.SmartPatientProvider` SHALL be a constructable class
