## Why

Open Pedigree has no mechanism for linking pedigree nodes to real FHIR Patient resources, so identity resolution, stable FHIR IDs, and clinical data import are impossible without custom host-page hacks. Adding an `AbstractPatientProvider` interface gives implementers (REDCap EM, SMART on FHIR) a clean, standard seam to plug in patient search and clinical data import without forking the editor.

## What Changes

- Add `AbstractPatientProvider` interface with `openPatientPickerModal()`, `openClinicalImportModal()`, `canImportClinicalData()`, and `lookupPatient()` entry points
- Add `EmptyPatientProvider` — no-op default when no provider is configured
- Add `FHIRPatientProvider` — standard FHIR R4 Patient search modal; Condition fetch for clinical data import (disorders initially)
- Add `linkedPatientRef` node property (e.g. `"Patient/123"`) serialised in pedigree JSON; displayed on the Personal tab
- Add "Link to patient" button on the Personal tab that calls `provider.openPatientPickerModal()`
- Add "Import from record" button on the Clinical tab that calls `provider.openClinicalImportModal()` (hidden when `canImportClinicalData()` returns false)
- Update GA4GH export to use `linkedPatientRef` for stable Patient IDs where available, instead of generated UUIDs
- Update `initialiseEditor()` to accept a `patientProvider` option
- Clinical data import is always **additive** — never removes existing pedigree data

## Capabilities

### New Capabilities

- `patient-provider`: Abstract patient provider interface and implementations — `AbstractPatientProvider`, `EmptyPatientProvider`, `FHIRPatientProvider`; `linkedPatientRef` node property; patient picker and clinical import modals

### Modified Capabilities

- `ga4gh-fhir-format`: GA4GH export now uses `linkedPatientRef` when available to produce stable Patient resource IDs, and serialises `linkedPatientRef` in the pedigree JSON format

## Impact

- `src/script/patientProvider/` — new directory with `AbstractPatientProvider.ts`, `EmptyPatientProvider.ts`, `FHIRPatientProvider.ts`
- `src/script/model/person.ts` — add `linkedPatientRef` property (get/set)
- `src/script/view/nodeMenu.ts` — add "Link to patient" button on Personal tab, "Import from record" on Clinical tab
- `src/script/pedigree.ts` (`initialiseEditor`) — accept and wire `patientProvider` option
- `src/script/GA4GHFHIRConverter.ts` — use `linkedPatientRef` for Patient ID generation
- `src/script/model/export.js` / `import.js` — serialise/deserialise `linkedPatientRef` in internal JSON
- No new npm dependencies (FHIR Patient search uses fetch + existing AJAX patterns)
