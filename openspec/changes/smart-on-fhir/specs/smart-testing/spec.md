## ADDED Requirements

### Requirement: Unit tests cover SmartFhirBackend load behaviour
Vitest unit tests SHALL cover the `load()` method of `SmartFhirBackend`, using a mocked fhirclient v2 `client` to verify FHIR search calls and return values without network I/O.

#### Scenario: load returns Composition content when one exists
- **WHEN** `load()` is called and `client.request()` returns a FHIR Bundle containing a matching Composition
- **THEN** the test SHALL assert that the Composition content is returned as the pedigree data

#### Scenario: load returns empty pedigree when no Composition exists
- **WHEN** `load()` is called and `client.request()` returns a Bundle with zero entries
- **THEN** the test SHALL assert that an empty pedigree representation is returned

#### Scenario: load propagates FHIR search errors
- **WHEN** `load()` is called and `client.request()` rejects with a network error
- **THEN** the test SHALL assert that the error is surfaced (via rejection or error callback)

### Requirement: Unit tests cover SmartFhirBackend save behaviour
Vitest unit tests SHALL cover the `save()` method, verifying POST vs PUT selection and sessionStorage key writing.

#### Scenario: First save POSTs and stores the Composition ID
- **WHEN** `save(data)` is called with no Composition ID in sessionStorage
- **THEN** the test SHALL assert that `client.request()` is called with method POST, and the returned Composition ID is stored in sessionStorage under `smart_composition_{patientId}`

#### Scenario: Subsequent save PUTs to the existing Composition URL
- **WHEN** `save(data)` is called with a Composition ID already in sessionStorage
- **THEN** the test SHALL assert that `client.request()` is called with method PUT targeting `Composition/{id}`

#### Scenario: Save surfaces a re-launch prompt on 401
- **WHEN** `save(data)` is called and `client.request()` rejects with a 401 status
- **THEN** the test SHALL assert that a user-visible error element is rendered in the DOM

### Requirement: Unit tests cover SmartPatientProvider scope-checking
Vitest unit tests SHALL cover `canSearchFamilyMembers()` and `canImportClinicalData()` for both granted and absent scope combinations.

#### Scenario: canSearchFamilyMembers returns true when user/Patient.read granted
- **WHEN** the mock SMART token response includes `user/Patient.read`
- **THEN** `canSearchFamilyMembers()` SHALL return true

#### Scenario: canSearchFamilyMembers returns false when user/Patient.read absent
- **WHEN** the mock SMART token response does not include `user/Patient.read`
- **THEN** `canSearchFamilyMembers()` SHALL return false

#### Scenario: canImportClinicalData returns true when user/Condition.read granted
- **WHEN** the mock SMART token response includes `user/Condition.read`
- **THEN** `canImportClinicalData()` SHALL return true

#### Scenario: canImportClinicalData returns false when user/Condition.read absent
- **WHEN** the mock SMART token response does not include `user/Condition.read`
- **THEN** `canImportClinicalData()` SHALL return false

### Requirement: Unit tests cover SmartPatientProvider prepopulateProband
Vitest unit tests SHALL cover the three cases for `prepopulateProband()`: unlinked proband, already-linked proband, and FHIR read failure.

#### Scenario: Unlinked proband is linked to context patient
- **WHEN** `prepopulateProband(nodeId)` is called for a node with no `linkedPatientRef` and `client.patient.read()` resolves with a Patient resource
- **THEN** the test SHALL assert that the node-link event is fired with the correct patient reference and display name

#### Scenario: Already-linked proband is left unchanged
- **WHEN** `prepopulateProband(nodeId)` is called for a node that already has a `linkedPatientRef`
- **THEN** the test SHALL assert that no node-link event is fired

#### Scenario: prepopulateProband resolves without error when patient.read fails
- **WHEN** `client.patient.read()` rejects
- **THEN** the test SHALL assert that `prepopulateProband` resolves (does not throw) and the node is not modified

### Requirement: Unit tests cover FHIRPatientProvider with smartClient
Vitest unit tests SHALL verify that when `FHIRPatientProvider` is constructed with `{ smartClient }`, FHIR requests route through `smartClient.request()` rather than jQuery.

#### Scenario: Patient search uses smartClient.request when smartClient provided
- **WHEN** the patient search is triggered on a `FHIRPatientProvider` constructed with `{ smartClient }`
- **THEN** the test SHALL assert that `smartClient.request()` is called with the expected Patient search URL and jQuery `$.ajax` is NOT called

#### Scenario: fhirBaseUrl-only construction still uses jQuery
- **WHEN** the patient search is triggered on a `FHIRPatientProvider` constructed with `{ fhirBaseUrl }`
- **THEN** the test SHALL assert that jQuery `$.ajax` is called (no regression)

### Requirement: A Playwright helper stubs the SMART client for E2E tests
A reusable Playwright helper (`tests/e2e/helpers/smartStub.ts`) SHALL provide a `stubSmartClient(page, options)` function. It SHALL inject a pre-configured mock SMART client via `page.addInitScript()` so that `FHIR.oauth2.ready()` resolves immediately without an OAuth redirect. `page.route()` SHALL intercept FHIR API calls and return fixture responses.

#### Scenario: stubSmartClient intercepts FHIR.oauth2.ready
- **WHEN** `stubSmartClient(page, { patientId: 'p1', scopes: 'user/Patient.read ...' })` is called before page navigation
- **THEN** any call to `FHIR.oauth2.ready()` on that page SHALL resolve with the stub client without triggering an OAuth redirect

#### Scenario: stubSmartClient routes FHIR calls to fixture responses
- **WHEN** the stub client's `request(url)` is called for a configured route (e.g. `Patient/p1`)
- **THEN** the stub SHALL return the corresponding fixture object without hitting a real FHIR server

### Requirement: Playwright E2E tests cover SMART editor initialisation
E2E tests using `stubSmartClient` SHALL verify that `smartEditor.html` initialises correctly and handles auth failures.

#### Scenario: Editor loads and renders when FHIR.oauth2.ready resolves
- **WHEN** `smartEditor.html` is opened with `stubSmartClient` active
- **THEN** the pedigree editor canvas SHALL be visible and the proband node SHALL be present

#### Scenario: Error message shown when FHIR.oauth2.ready rejects
- **WHEN** `smartEditor.html` is opened with `stubSmartClient` configured to reject `ready()`
- **THEN** a user-visible error message SHALL appear and the editor canvas SHALL NOT be rendered

### Requirement: Playwright E2E tests cover proband auto-linking
E2E tests SHALL verify proband population behaviour for both new and existing pedigrees.

#### Scenario: Proband linked to context patient on new pedigree
- **WHEN** `smartEditor.html` loads with a stub returning no existing Composition and a stub Patient `{ id: 'p1', name: 'Jane Smith' }`
- **THEN** the proband node SHALL display "Jane Smith" as its label

#### Scenario: Existing proband link preserved on reload
- **WHEN** `smartEditor.html` loads with a stub returning a Composition where the proband has `linkedPatientRef: 'Patient/p99'`
- **THEN** the proband node SHALL retain `Patient/p99` and SHALL NOT be overwritten with the context patient

### Requirement: Playwright E2E tests cover save/load round-trip
E2E tests SHALL verify that the editor saves a Composition and restores it on reload using the `stubSmartClient` FHIR route stubs.

#### Scenario: Save issues a POST and load restores the pedigree
- **WHEN** the user triggers save on a new pedigree and then the page is reloaded with the stub returning the saved Composition
- **THEN** the pedigree structure SHALL be identical before and after reload

### Requirement: Playwright E2E tests cover scope-based degradation
E2E tests SHALL verify that missing scopes hide the appropriate UI controls.

#### Scenario: Family picker hidden for non-proband when user/Patient.read absent
- **WHEN** `smartEditor.html` loads with a stub whose granted scopes do not include `user/Patient.read` and a non-proband node menu is opened
- **THEN** the "Link to patient" button SHALL NOT be visible in the Personal tab

#### Scenario: Import button hidden when user/Condition.read absent
- **WHEN** `smartEditor.html` loads with a stub whose granted scopes do not include `user/Condition.read` and a node menu is opened
- **THEN** the "Import from record" button SHALL NOT be visible in the Clinical tab

### Requirement: A docker-compose file provides a local SMART on FHIR test environment
A `docker-compose.smart.yml` SHALL define a `smart-launcher` service (`ghcr.io/smart-on-fhir/smart-launcher-v2`, port 8080), a `fhir-seeder` init service that POSTs fixture bundles to the FHIR server on startup, and a `dev-server` service running `npm start` (port 9000).

#### Scenario: docker-compose up starts all services
- **WHEN** `docker compose -f docker-compose.smart.yml up` is run
- **THEN** the smart-launcher SHALL be reachable at `http://localhost:8080`, the FHIR server at `http://localhost:8080/v/r4/fhir`, and the webpack dev server at `http://localhost:9000`

#### Scenario: EHR launch flow completes against local smart-launcher
- **WHEN** a browser navigates to the smart-launcher's EHR simulation URL for a pre-seeded patient pointing to `launch.html`
- **THEN** the OAuth flow SHALL complete and `smartEditor.html` SHALL load with the editor initialised for that patient

#### Scenario: fhir-seeder runs once and exits before tests begin
- **WHEN** `docker compose -f docker-compose.smart.yml up` is run
- **THEN** the `fhir-seeder` service SHALL POST all fixture bundles and exit with code 0 before the smart-launcher accepts test traffic; `smart-launcher` and `dev-server` SHALL depend on `fhir-seeder` completing successfully

### Requirement: The SMART environment is pre-seeded with defined test patients
The `fhir-seeder` service SHALL load FHIR fixture bundles from `tests/fixtures/smart/` that create a defined set of test patients and clinical data on the FHIR server.

#### Scenario: Patient A (no prior pedigree) is present with clinical conditions
- **WHEN** the FHIR server is seeded
- **THEN** a Patient resource with id `test-patient-a` SHALL exist with at least two associated Condition resources (one with a SNOMED CT code, one with an OMIM code) representing heritable conditions

#### Scenario: Patient B (saved pedigree) is present with an existing Composition
- **WHEN** the FHIR server is seeded
- **THEN** a Patient resource with id `test-patient-b` SHALL exist along with a GA4GH pedigree Composition resource that encodes a three-generation pedigree (proband, two parents, one sibling), with the proband and at least one family member having Condition resources

#### Scenario: Both test patients are selectable in the smart-launcher EHR simulation
- **WHEN** a developer opens the smart-launcher UI at `http://localhost:8080`
- **THEN** `test-patient-a` and `test-patient-b` SHALL appear as selectable patients in the launch simulation

### Requirement: Test fixture bundles are stored as versioned FHIR JSON files
FHIR transaction bundles for the test patients and their associated resources (Patient, Condition, Composition) SHALL be stored under `tests/fixtures/smart/` as JSON files checked into the repository.

#### Scenario: Fixture directory contains Patient A bundle
- **WHEN** `tests/fixtures/smart/` is inspected
- **THEN** a file `patient-a.json` SHALL exist containing a FHIR transaction Bundle that creates the Patient and Condition resources for test-patient-a

#### Scenario: Fixture directory contains Patient B bundle with Composition
- **WHEN** `tests/fixtures/smart/` is inspected
- **THEN** a file `patient-b.json` SHALL exist containing a FHIR transaction Bundle that creates the Patient, Condition, and GA4GH Composition resources for test-patient-b; the Composition SHALL be a valid GA4GH pedigree bundle with at least four nodes

### Requirement: README documents the SMART test environments
The project `README.md` SHALL include a section describing how to run unit tests, Playwright stub tests, and the docker-compose SMART environment, including the smart-launcher EHR simulation URL pattern.

#### Scenario: README contains SMART testing instructions
- **WHEN** a developer reads the README
- **THEN** they SHALL find commands for `npm test`, `npx playwright test`, and `docker compose -f docker-compose.smart.yml up` with a brief explanation of each
