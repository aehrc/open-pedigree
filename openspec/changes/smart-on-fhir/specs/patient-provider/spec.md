## MODIFIED Requirements

### Requirement: FHIRPatientProvider implements the interface against a FHIR R4 server
`FHIRPatientProvider` SHALL accept either `{ fhirBaseUrl }` or `{ smartClient }` (a fhirclient v2 SMART client) at construction time. When `smartClient` is provided, `fhirBaseUrl` SHALL default to `smartClient.getState('serverUrl')` and all FHIR requests SHALL be made via `smartClient.request(url)` rather than jQuery `$.ajax()`. Existing callers passing only `fhirBaseUrl` SHALL be unaffected.

#### Scenario: Patient search returns matching patients (fhirBaseUrl mode)
- **WHEN** the user types a search term in the FHIRPatientProvider modal and the provider was constructed with `fhirBaseUrl`
- **THEN** the modal SHALL display patients matching the name query from the FHIR server using jQuery `$.ajax()`

#### Scenario: Patient search uses authenticated client when smartClient provided
- **WHEN** the user types a search term and the provider was constructed with `{ smartClient }`
- **THEN** the modal SHALL display patients matching the name query using `smartClient.request()` for all HTTP calls

#### Scenario: Condition import maps to disorders (fhirBaseUrl mode)
- **WHEN** the user triggers clinical import for a linked node and the provider was constructed with `fhirBaseUrl`
- **THEN** `FHIRPatientProvider` SHALL fetch Conditions for that patient via jQuery and call `onImported` with disorder entries derived from Condition.code

#### Scenario: Condition import uses authenticated client when smartClient provided
- **WHEN** the user triggers clinical import and the provider was constructed with `{ smartClient }`
- **THEN** `FHIRPatientProvider` SHALL fetch Conditions via `smartClient.request()` and call `onImported` with disorder entries derived from Condition.code
