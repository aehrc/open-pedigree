## Why

Open Pedigree has a pluggable `PatientProvider` and GA4GH FHIR save/load engine but no way to authenticate against a FHIR server or operate within a SMART on FHIR context. This change adds the OAuth 2.0 / SMART launch flow so the editor can run as a first-class SMART app — loading and saving pedigrees as GA4GH FHIR Compositions from the EHR's FHIR server, with the in-context patient pre-populated as the proband.

## What Changes

- Add `SmartPatientProvider` — wraps `FHIRPatientProvider`; pre-populates the proband node from `client.patient.read()`; gracefully degrades family-member search and clinical import when user-level scopes are not granted
- Add `SmartFhirBackend` — SMART-aware save/load backend; loads the patient's GA4GH Composition on startup, saves via PUT/POST; tracks Composition ID in `sessionStorage` (survives OAuth redirect, cleared on tab close)
- Add `smartEditor.html` — single-page SMART app entry point using fhirclient v2; handles in-place OAuth redirect without a popup
- Add `launch.html` — minimal SMART launch redirect page that stores `iss` + `launch` and redirects to `smartEditor.html`
- Add `fhirclient` v2 npm dependency

## Capabilities

### New Capabilities

- `smart-patient-provider`: `SmartPatientProvider` class — wraps `FHIRPatientProvider`, pre-populates proband from SMART context, scope-based degradation
- `smart-fhir-backend`: `SmartFhirBackend` class — GA4GH Composition load/save via fhirclient, sessionStorage Composition ID tracking
- `smart-editor-pages`: `smartEditor.html` + `launch.html` static pages; fhirclient v2 initialisation and OAuth redirect handling; webpack entry point for SMART bundle
- `smart-testing`: Unit tests (Vitest) for `SmartFhirBackend`, `SmartPatientProvider`, and `FHIRPatientProvider` smartClient path; Playwright E2E tests using a stubbed SMART client; optional docker-compose environment using smart-launcher v2 for full-stack OAuth testing

### Modified Capabilities

- `patient-provider`: `FHIRPatientProvider` now accepts an optional pre-constructed `fhirclient` SMART client as an alternative to `fhirBaseUrl`, so `SmartPatientProvider` can delegate AJAX through the authenticated client

## Impact

- New npm dependency: `fhirclient` v2
- New webpack entry point: `src/smartEditor.ts` → `dist/smartEditor.min.js`
- New source files: `src/script/patientProvider/SmartPatientProvider.ts`, `src/script/SmartFhirBackend.ts`
- New HTML pages: `smartEditor.html`, `launch.html` (static assets, not bundled)
- `FHIRPatientProvider` updated to accept a SMART client alongside `fhirBaseUrl`
- No changes to existing `pedigree.ts` API; `SmartPatientProvider` and `SmartFhirBackend` are passed in via `initialiseEditor()` options
