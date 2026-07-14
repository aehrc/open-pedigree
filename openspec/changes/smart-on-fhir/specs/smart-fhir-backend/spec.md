## ADDED Requirements

### Requirement: SmartFhirBackend loads the GA4GH Composition for the context patient
`SmartFhirBackend` SHALL implement the `load` backend interface. On `load()`, it SHALL search for an existing GA4GH pedigree Composition for the in-context patient and return its content. If no Composition exists, `load` SHALL return an empty pedigree.

#### Scenario: Existing Composition is found and returned
- **WHEN** `backend.load()` is called and a `Composition` with the GA4GH pedigree profile exists for the context patient on the FHIR server
- **THEN** the Composition content SHALL be returned as the pedigree data for deserialisation

#### Scenario: No Composition found returns empty pedigree
- **WHEN** `backend.load()` is called and no matching Composition exists for the context patient
- **THEN** `load` SHALL return an empty pedigree representation (equivalent to a new blank pedigree)

#### Scenario: Load failure surfaces an error
- **WHEN** `client.request()` rejects during the Composition search
- **THEN** `load` SHALL invoke the error callback or reject its promise with a descriptive message; the editor SHALL display an error notice

### Requirement: SmartFhirBackend saves the pedigree as a GA4GH Composition
`SmartFhirBackend` SHALL implement the `save` backend interface. On first save it SHALL POST a new Composition; on subsequent saves it SHALL PUT to the existing Composition URL.

#### Scenario: First save creates a new Composition
- **WHEN** `backend.save(data)` is called and no Composition ID is stored in sessionStorage for the current patient
- **THEN** a POST request SHALL be sent to `[fhirBase]/Composition` with the GA4GH pedigree bundle as the request body and the resulting Composition ID SHALL be stored in sessionStorage

#### Scenario: Subsequent save updates the existing Composition
- **WHEN** `backend.save(data)` is called and a Composition ID is already stored in sessionStorage
- **THEN** a PUT request SHALL be sent to `[fhirBase]/Composition/{id}` to update the existing resource

#### Scenario: Save detects 401 and prompts re-launch
- **WHEN** `client.request()` returns a 401 Unauthorized during save
- **THEN** `SmartFhirBackend` SHALL display a user-visible message instructing the user to re-launch the application; it SHALL NOT silently discard the save

### Requirement: SmartFhirBackend tracks Composition ID in sessionStorage
The Composition resource ID SHALL be stored in `sessionStorage` under the key `smart_composition_{patientId}`, where `{patientId}` is the logical ID of the SMART context patient.

#### Scenario: Composition ID persists across OAuth redirect
- **WHEN** the browser performs the OAuth redirect and returns to `smartEditor.html`
- **THEN** the stored Composition ID SHALL still be present in sessionStorage and used for subsequent PUT saves

#### Scenario: Composition ID cleared when tab is closed
- **WHEN** the browser tab is closed
- **THEN** sessionStorage is cleared by the browser, and the next launch will re-search for the Composition

#### Scenario: Different patients use different sessionStorage keys
- **WHEN** two separate SMART launches occur in different tabs for different patients
- **THEN** each tab's Composition ID SHALL be stored under a distinct key and SHALL not interfere with the other

### Requirement: SmartFhirBackend is exported from the OpenPedigree SMART bundle
`SmartFhirBackend` SHALL be accessible as `OpenPedigree.SmartFhirBackend` from `dist/smartEditor.min.js`.

#### Scenario: SmartFhirBackend available on OpenPedigree global
- **WHEN** `dist/smartEditor.min.js` is loaded
- **THEN** `window.OpenPedigree.SmartFhirBackend` SHALL be a constructable class that accepts a fhirclient v2 client
