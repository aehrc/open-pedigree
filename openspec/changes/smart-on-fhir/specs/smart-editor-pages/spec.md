## ADDED Requirements

### Requirement: launch.html initiates the SMART OAuth flow
`launch.html` SHALL be a minimal static page that calls `FHIR.oauth2.authorize()` with the required SMART scopes and redirects the browser to the EHR's authorisation server.

#### Scenario: EHR launch with iss and launch parameters
- **WHEN** the EHR opens `launch.html?iss=https://ehr.example.com/fhir&launch=abc123`
- **THEN** `launch.html` SHALL call `FHIR.oauth2.authorize()` using the `iss` and `launch` parameters, triggering a redirect to the EHR authorisation server

#### Scenario: Standalone launch with iss only
- **WHEN** `launch.html?iss=https://ehr.example.com/fhir` is opened without a `launch` token
- **THEN** `launch.html` SHALL initiate a standalone SMART launch using the `iss` parameter

#### Scenario: Missing iss parameter shows an error
- **WHEN** `launch.html` is opened with no `iss` parameter
- **THEN** the page SHALL display a human-readable error message and SHALL NOT attempt an OAuth redirect

### Requirement: launch.html requests the correct SMART scopes
The scopes requested in `FHIR.oauth2.authorize()` SHALL include: `launch`, `openid`, `fhirUser`, `user/Patient.read`, `user/Condition.read`, `patient/Composition.read`, `patient/Composition.write`.

#### Scenario: Scopes present in authorization request
- **WHEN** the OAuth authorisation request is constructed by `launch.html`
- **THEN** the `scope` parameter SHALL contain all seven required scopes

### Requirement: smartEditor.html completes the OAuth handshake and initialises the editor
`smartEditor.html` SHALL call `FHIR.oauth2.ready()` to obtain an authenticated fhirclient v2 `client`, then construct `SmartPatientProvider` and `SmartFhirBackend`, and call `OpenPedigree.initialiseEditor()`.

#### Scenario: OAuth handshake completes and editor initialises
- **WHEN** the EHR redirects back to `smartEditor.html` with the OAuth `code` parameter
- **THEN** `FHIR.oauth2.ready()` SHALL resolve with a SMART client and `OpenPedigree.initialiseEditor()` SHALL be called with `SmartFhirBackend` and `SmartPatientProvider`

#### Scenario: OAuth handshake failure shows error
- **WHEN** `FHIR.oauth2.ready()` rejects (e.g. invalid state, expired code)
- **THEN** `smartEditor.html` SHALL display a user-visible error message and SHALL NOT attempt to initialise the editor

### Requirement: smartEditor.html auto-links the proband after editor initialisation
After calling `initialiseEditor()`, `smartEditor.html` SHALL call `provider.prepopulateProband(probandNodeId)` so that the SMART context patient is linked to the proband on new pedigrees.

#### Scenario: Proband linked on first launch
- **WHEN** `smartEditor.html` loads for a patient with no existing pedigree Composition
- **THEN** the proband node SHALL be automatically linked to the SMART context patient after the editor finishes loading

#### Scenario: Existing proband link preserved on reload
- **WHEN** `smartEditor.html` loads for a patient with an existing pedigree Composition where the proband is already linked
- **THEN** the existing `linkedPatientRef` on the proband SHALL remain unchanged

### Requirement: smartEditor.html loads the SMART bundle, not the base bundle
`smartEditor.html` SHALL reference `dist/smartEditor.min.js` (not `dist/pedigree.min.js`) and SHALL NOT load fhirclient from a CDN — it is included in the SMART bundle.

#### Scenario: SMART bundle is the only script tag
- **WHEN** `smartEditor.html` is inspected
- **THEN** there SHALL be exactly one `<script>` tag referencing `dist/smartEditor.min.js` and no reference to `dist/pedigree.min.js` or a CDN fhirclient script

### Requirement: A dedicated webpack entry produces the SMART bundle
The webpack configuration SHALL include a `smartEditor` entry point at `src/smartEditor.ts` that produces `dist/smartEditor.min.js`. The SMART bundle SHALL include `fhirclient`, `SmartPatientProvider`, `SmartFhirBackend`, and all core editor code.

#### Scenario: SMART bundle produced by npm run build
- **WHEN** `npm run build` is executed
- **THEN** `dist/smartEditor.min.js` SHALL be produced alongside `dist/pedigree.min.js`

#### Scenario: Base bundle does not include fhirclient
- **WHEN** `dist/pedigree.min.js` is inspected
- **THEN** it SHALL NOT contain fhirclient code, keeping the base bundle free of the SMART dependency
