## Context

Open Pedigree now has a pluggable `PatientProvider` interface (Change 1) and a GA4GH FHIR save/load engine. The missing piece is SMART on FHIR authentication — an OAuth 2.0 launch flow that grants the editor an authenticated FHIR client it can use for both pedigree persistence and patient data access.

The `fhirclient` v2 library (the canonical JS SMART client) manages the OAuth redirect, token storage, and provides a `client.request()` method for authenticated FHIR calls. This change wires `fhirclient` into the editor as a thin integration layer without coupling the core editor to SMART concepts.

`FHIRPatientProvider` currently calls FHIR via jQuery `$.ajax()` with a raw `fhirBaseUrl`. In the SMART context, requests must go through the authenticated client (`client.request()`) rather than unauthenticated jQuery calls. The integration point is: allow `FHIRPatientProvider` to accept a SMART client alongside `fhirBaseUrl`.

## Goals / Non-Goals

**Goals:**
- SMART EHR launch and standalone launch flows via `launch.html` + `smartEditor.html`
- Authenticated FHIR access through fhirclient v2
- Proband auto-linked to SMART in-context patient on new pedigree load
- GA4GH Composition load/save via `SmartFhirBackend`; Composition ID tracked in sessionStorage
- Graceful degradation when `user/Patient.read` or `user/Condition.read` scopes are absent
- `SmartPatientProvider` delegates to `FHIRPatientProvider` for family member search and clinical import

**Non-Goals:**
- REDCap EM SMART integration — that is a separate change in the REDCap EM module
- Multi-patient pedigree SMART context (single patient-in-context only)
- Refresh token handling beyond what fhirclient v2 provides automatically
- Offline / service-worker caching

## Decisions

### D1: Single-window OAuth redirect (no popup)

fhirclient v2 performs the OAuth redirect in the same browser tab. After the EHR redirects back, `FHIR.oauth2.ready()` restores the SMART context and returns an authenticated client. The editor then initialises normally.

**Rationale:** Popup-based OAuth is blocked by most modern browsers without a direct user gesture. Single-window redirect is the SMART on FHIR recommended approach and is handled transparently by fhirclient v2.

**Alternative considered:** `FHIR.oauth2.authorize()` in a popup via `window.open`. Rejected — popup blockers and mobile UX.

### D2: Composition ID stored in sessionStorage keyed by patient ID

`SmartFhirBackend` stores the Composition resource ID as `smart_composition_{patientId}` in `sessionStorage`. A new SMART launch always searches for an existing Composition first (GET `Composition?subject=Patient/{id}&_profile=...`); the sessionStorage key only speeds up subsequent saves by avoiding a re-search.

**Rationale:** sessionStorage survives the OAuth redirect (same tab) but clears on tab close — preventing stale Composition IDs across sessions. Keying by patient ID handles the case where a user switches patient context without a full page reload.

**Alternative considered:** Storing Composition ID in URL params. Rejected — pollutes the URL; EHR may strip query params on redirect.

**Alternative considered:** Always re-searching on save. Viable but adds a round-trip on every save. SessionStorage avoids this at the cost of minimal complexity.

### D3: SmartPatientProvider wraps FHIRPatientProvider

`SmartPatientProvider` constructs a `FHIRPatientProvider` internally, passing `{ smartClient: client }` so requests flow through `client.request()`. It adds SMART-specific behaviour on top: proband pre-population from `client.patient.read()`, and scope-based feature flags.

**Rationale:** Avoids duplicating patient search and clinical import logic. `FHIRPatientProvider` already handles the FHIR search modal and Condition import; `SmartPatientProvider` only adds the SMART lifecycle layer.

**Alternative considered:** `SmartPatientProvider` extends `FHIRPatientProvider` via inheritance. Rejected — the SMART client is an init-time dependency (not available at class definition time), making the constructor awkward. Composition is cleaner.

### D4: FHIRPatientProvider accepts an optional `smartClient`

`FHIRPatientProvider` is updated to accept `{ smartClient }` as an alternative to `{ fhirBaseUrl }`. When `smartClient` is provided:
- `fhirBaseUrl` defaults to `smartClient.getState('serverUrl')`
- FHIR requests use `smartClient.request(url)` instead of `$.ajax()`

This is a backwards-compatible addition — existing callers passing only `fhirBaseUrl` are unaffected.

**Rationale:** Authenticated requests must go through the SMART client. Swapping the transport at the `FHIRPatientProvider` level (rather than wrapping it in SmartPatientProvider) keeps request handling in one place.

### D5: Proband auto-link after pedigree load

`SmartPatientProvider` exposes a `prepopulateProband()` async method. `smartEditor.html` calls this after `initialiseEditor()` returns. It reads `client.patient.read()` and, if the proband node has no `linkedPatientRef`, links it using the editor's node-link event.

**Rationale:** Auto-linking the proband is a SMART-specific concern that does not belong in the core editor or `SaveLoadEngine`. Doing it as a post-init step in the host page keeps the editor layer-agnostic.

### D6: SMART scopes requested

```
launch openid fhirUser
user/Patient.read
user/Condition.read
patient/Composition.read patient/Composition.write
```

User-level scopes for Patient and Condition allow searching across patients (family member search, clinical import for any node). Patient-level scopes restrict Composition writes to the in-context patient.

**Graceful degradation:** If `user/Patient.read` is absent from the granted scopes, `SmartPatientProvider.canSearchFamilyMembers()` returns false and the family member picker is disabled for non-proband nodes. If `user/Condition.read` is absent, `canImportClinicalData()` returns false.

### D7: Separate webpack entry for SMART bundle

A new `src/smartEditor.ts` webpack entry produces `dist/smartEditor.min.js`. This script imports fhirclient, completes OAuth setup, and calls `OpenPedigree.initialiseEditor()`. It is referenced only by `smartEditor.html` — the main `pedigree.min.js` bundle does not include fhirclient.

**Rationale:** Keeps the base bundle (used by REDCap EM and other non-SMART hosts) free of the fhirclient dependency (~80 KB). SMART hosts load the SMART bundle instead.

## Risks / Trade-offs

- **Token expiry during long editing sessions** — fhirclient v2 does not auto-refresh tokens (no refresh token grant in EHR SMART). If the access token expires mid-session, subsequent FHIR calls will 401. → Mitigation: detect 401 in `SmartFhirBackend.save()` and prompt the user to re-launch. Tolerable for initial implementation; background refresh is a future enhancement.

- **EHR SMART conformance variability** — Not all EHRs support all requested scopes. `user/Patient.read` may be unavailable on some platforms. → Mitigation: scope-checking logic (D6) ensures the editor degrades gracefully rather than erroring.

- **fhirclient sessionStorage and redirect loops** — If the EHR redirect back to `smartEditor.html` drops the `code` parameter, fhirclient may enter a redirect loop. → Mitigation: fhirclient v2 handles this case with a stored state check; document as a known EHR conformance issue if encountered.

- **Composition search performance** — `GET Composition?subject=...` may be slow on servers with large Composition histories. → Mitigation: sessionStorage caching (D2) means the search runs at most once per session.

- **GA4GH export/import round-trip with `linkedPatientRef`** — Discovered during testing: the GA4GH exporter generates FMH `patient.reference` values in `Patient/id` format when nodes have a `linkedPatientRef`. The importer's `nodeDataLookup` is keyed by `#id` format, so the lookup silently fails and all relationships are dropped on reload. Fixed by adding `GA4GHFHIRConverter.resolveNodeRef()` which falls back from `Patient/id` to `#id` lookup; applied to `extractDataFromFMH`, `extractDataFromCondition`, and `extractDataFromObservation`. Also fixed `bundleToContainedComposition` to map `ResourceType/id` references to `#id` form in section entries so HAPI FHIR retains all contained Patient resources rather than treating them as dangling external references. These fixes are in `src/script/GA4GHFHIRConverter.ts`.

## Open Questions

- Should `SmartFhirBackend` create a new Composition if none is found (new patient), or prompt the user? Initial decision: silently create (pedigree starts empty; first save creates the resource).
- Should `launch.html` support standalone launch (`iss` in query params without `launch` token)? In standalone mode, the EHR does not pass a `launch` token — fhirclient v2 supports this natively. Include for completeness but document that EHR-launched mode is the primary target.
