## 1. Dependencies and Build Config

- [x] 1.1 Add `fhirclient` v2 to `package.json` dependencies and run `npm install`
- [x] 1.2 Add `smartEditor` webpack entry point (`src/smartEditor.ts` → `dist/smartEditor.min.js`) in `webpack.config.js`
- [x] 1.3 Verify `npm run build` produces both `dist/pedigree.min.js` and `dist/smartEditor.min.js`
- [x] 1.4 Verify `dist/pedigree.min.js` does not contain fhirclient code (check bundle size is unchanged)

## 2. FHIRPatientProvider — smartClient option

- [x] 2.1 Update `FHIRPatientProvider` constructor to accept `{ smartClient }` alongside `{ fhirBaseUrl }`
- [x] 2.2 When `smartClient` is provided, derive `fhirBaseUrl` from `smartClient.getState('serverUrl')`
- [x] 2.3 Extract a private `request(url): Promise<any>` method that routes through `smartClient.request()` when available, falling back to jQuery `$.ajax()`
- [x] 2.4 Update all internal FHIR calls (Patient search, Condition fetch) to use the extracted `request()` method
- [x] 2.5 Confirm existing callers passing only `fhirBaseUrl` continue to work (no regressions)

## 3. SmartFhirBackend

- [x] 3.1 Create `src/script/SmartFhirBackend.ts` implementing the `{ load, save }` backend interface
- [x] 3.2 Implement `load()`: search `Composition?subject=Patient/{id}&_profile=<GA4GH profile URL>` via `client.request()`; return Composition content or empty pedigree if none found
- [x] 3.3 Implement `save(data)`: POST on first save (no sessionStorage key), PUT on subsequent saves; store resulting Composition ID as `smart_composition_{patientId}` in sessionStorage
- [x] 3.4 Handle 401 response on save: display a user-visible message prompting re-launch
- [x] 3.5 Export `SmartFhirBackend` as `OpenPedigree.SmartFhirBackend` from `src/smartEditor.ts`

## 4. SmartPatientProvider

- [x] 4.1 Create `src/script/patientProvider/SmartPatientProvider.ts`
- [x] 4.2 Constructor accepts a fhirclient v2 `client`; internally constructs `FHIRPatientProvider` with `{ smartClient: client }`; falls back to `EmptyPatientProvider` if `client` is null/undefined
- [x] 4.3 Implement `canSearchFamilyMembers()`: check granted scopes for `user/Patient.read`
- [x] 4.4 Override `canImportClinicalData()`: check granted scopes for `user/Condition.read`
- [x] 4.5 Implement `prepopulateProband(probandNodeId)`: call `client.patient.read()`, skip if node already has `linkedPatientRef`, otherwise fire the editor node-link event
- [x] 4.6 Disable patient picker for non-proband nodes when `canSearchFamilyMembers()` returns false
- [x] 4.7 Export `SmartPatientProvider` as `OpenPedigree.SmartPatientProvider` from `src/smartEditor.ts`

## 5. src/smartEditor.ts Entry Point

- [x] 5.1 Create `src/smartEditor.ts`; import fhirclient, `SmartFhirBackend`, `SmartPatientProvider`, and re-export the full `OpenPedigree` API
- [x] 5.2 On `DOMContentLoaded`, call `FHIR.oauth2.ready()` and on success construct backend + provider, then call `OpenPedigree.initialiseEditor()`
- [x] 5.3 On `FHIR.oauth2.ready()` rejection, render a user-visible error message in the page body
- [x] 5.4 After `initialiseEditor()` returns, call `provider.prepopulateProband(probandNodeId)` where `probandNodeId` is the proband's node ID

## 6. HTML Launch Pages

- [x] 6.1 Create `launch.html`: call `FHIR.oauth2.authorize()` with the full scope string (`launch openid fhirUser user/Patient.read user/Condition.read patient/Composition.read patient/Composition.write`) and `redirectUri: 'smartEditor.html'`
- [x] 6.2 Add error handling in `launch.html` for missing `iss` parameter
- [x] 6.3 Create `smartEditor.html`: load `dist/smartEditor.min.js`; the script tag is the only external script; no inline SMART logic (all in `src/smartEditor.ts`)
- [x] 6.4 Support standalone launch in `launch.html` (omit `launch` token; fhirclient handles `iss`-only mode natively)

## 7. Unit Tests (Vitest)

- [x] 7.1 Write unit tests for `SmartFhirBackend.load()`: existing Composition found, no Composition found, FHIR request error
- [x] 7.2 Write unit tests for `SmartFhirBackend.save()`: first save POSTs and writes sessionStorage key, subsequent save PUTs to existing Composition, 401 renders re-launch message
- [x] 7.3 Write unit tests for `SmartPatientProvider` scope-checking: `canSearchFamilyMembers()` and `canImportClinicalData()` for each scope present/absent combination
- [x] 7.4 Write unit tests for `SmartPatientProvider.prepopulateProband()`: unlinked proband gets linked, already-linked proband is unchanged, `client.patient.read()` rejection resolves cleanly
- [x] 7.5 Write unit tests for `FHIRPatientProvider` with `{ smartClient }`: Patient search and Condition fetch route through `smartClient.request()`, not jQuery; confirm `fhirBaseUrl`-only mode is unaffected
- [x] 7.6 Run `npm test` and confirm all unit tests pass

## 8. Playwright E2E Tests (Stub Mode)

- [x] 8.1 Create `tests/e2e/helpers/smartStub.ts`: `stubSmartClient(page, options)` that injects a mock `FHIR.oauth2.ready()` via `page.addInitScript()` and routes FHIR API calls to fixture responses via `page.route()`
- [x] 8.2 Write Playwright test: editor loads and renders when `FHIR.oauth2.ready()` resolves; error message shown when it rejects
- [x] 8.3 Write Playwright test: proband auto-linked to context patient on new pedigree; existing proband link preserved on reload
- [x] 8.4 Write Playwright test: save/load round-trip — save issues POST, reload with stub Composition restores pedigree structure
- [x] 8.5 Write Playwright test: `user/Patient.read` absent → "Link to patient" button hidden on non-proband node
- [x] 8.6 Write Playwright test: `user/Condition.read` absent → "Import from record" button hidden on node
- [x] 8.7 Run `npx playwright test` and confirm all E2E tests pass against `npm start` dev server

## 9. Docker Compose SMART Environment

- [x] 9.1 Create `docker-compose.smart.yml` with three services: `smart-launcher` (`ghcr.io/smart-on-fhir/smart-launcher-v2`, port 8080), `fhir-seeder` (init container that POSTs fixture bundles and exits), and `dev-server` (`npm start`, port 9000); `smart-launcher` and `dev-server` depend on `fhir-seeder` completing successfully
- [x] 9.2 Create `tests/fixtures/smart/patient-a.json`: FHIR transaction Bundle creating Patient `test-patient-a` with at least two heritable Condition resources (one SNOMED CT code, one OMIM code)
- [x] 9.3 Create `tests/fixtures/smart/patient-b.json`: FHIR transaction Bundle creating Patient `test-patient-b`, associated Condition resources, and a GA4GH pedigree Composition encoding a three-generation pedigree (proband + two parents + one sibling, with conditions on at least two nodes)
- [x] 9.4 Create `tests/fixtures/smart/seed.sh` (or equivalent): script used by `fhir-seeder` to POST each bundle to the FHIR server; waits for the server to be ready before posting
- [x] 9.5 Confirm `docker compose -f docker-compose.smart.yml up` starts all services, `fhir-seeder` exits cleanly, and both test patients are visible in the smart-launcher UI at `http://localhost:8080`
- [x] 9.6 Manually launch against `test-patient-a`: confirm OAuth completes, editor loads with proband auto-linked, clinical import shows the seeded Conditions
- [x] 9.7 Manually launch against `test-patient-b`: confirm the existing three-generation pedigree loads correctly from the seeded Composition; save a change and reload to confirm round-trip
- [x] 9.8 Add SMART testing instructions to `README.md`: commands for `npm test`, `npx playwright test`, and `docker compose -f docker-compose.smart.yml up`; document the two test patient IDs and what each is for
