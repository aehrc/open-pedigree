## 1. AbstractPatientProvider Interface

- [x] 1.1 Create `src/script/patientProvider/AbstractPatientProvider.ts` — define abstract class with `openPatientPickerModal(nodeId, onSelected)`, `openClinicalImportModal(nodeId, fhirRef, onImported)`, `canImportClinicalData()`, `lookupPatient(fhirRef, onSuccess, onError)`, and `isConfigured()` (returns false for EmptyPatientProvider)
- [x] 1.2 Create `src/script/patientProvider/EmptyPatientProvider.ts` — extends AbstractPatientProvider; all methods no-op; `isConfigured()` returns false; `canImportClinicalData()` returns false

## 2. FHIRPatientProvider

- [x] 2.1 Create `src/script/patientProvider/FHIRPatientProvider.ts` — extends AbstractPatientProvider; constructor accepts `{ fhirBaseUrl }` options; `isConfigured()` returns true; `canImportClinicalData()` returns true
- [x] 2.2 Implement `FHIRPatientProvider.lookupPatient(fhirRef, onSuccess, onError)` — `GET [fhirBaseUrl]/[fhirRef]`; extract display name from Patient.name; call onSuccess(name) or onError(reason)
- [x] 2.3 Implement `FHIRPatientProvider.openPatientPickerModal(nodeId, onSelected)` — render a `NativeModal` with a search input; on input search `GET [fhirBaseUrl]/Patient?name=<query>&_count=20`; display results; on row click call `onSelected(fhirRef, displayName)` and close modal
- [x] 2.4 Implement `FHIRPatientProvider.openClinicalImportModal(nodeId, fhirRef, onImported)` — `GET [fhirBaseUrl]/Condition?patient=<id>&_count=100`; map each Condition.code to `{ id, name }`; show results in a NativeModal for user confirmation; on confirm call `onImported(disorders)`

## 3. linkedPatientRef Node Property

- [x] 3.1 Add `_linkedPatientRef` field to `person.ts`; add `getLinkedPatientRef()` and `setLinkedPatientRef(ref)` accessors; initialise to `''` in constructor
- [x] 3.2 Add `linkedPatientRef` to `getProperties()` in `person.ts` (serialise when non-empty)
- [x] 3.3 Add `linkedPatientRef` handling in `setProperties()` in `person.ts` — call `setLinkedPatientRef` when the property differs from current value

## 4. Wire Provider into Editor

- [x] 4.1 Add `_patientProvider` field to `PedigreeEditor` in `pedigree.ts`; accept `patientProvider` in `initialiseEditor()` options; default to `new EmptyPatientProvider()`; expose via `getPatientProvider()` accessor
- [x] 4.2 After pedigree load in `saveLoadEngine.ts`, iterate nodes with non-empty `linkedPatientRef` and call `editor.getPatientProvider().lookupPatient(ref, onSuccess, onError)` to resolve display names

## 5. Node Menu — Personal Tab

- [x] 5.1 Add a "Link to patient" button to the Personal tab in `nodeMenu.ts` — hidden when `editor.getPatientProvider().isConfigured()` is false; on click, call `editor.getPatientProvider().openPatientPickerModal(nodeId, onSelected)`; `onSelected` fires a `pedigree:person:set:linkedPatientRef` event and updates the node display name

## 6. Node Menu — Clinical Tab

- [x] 6.1 Add an "Import from record" button to the Clinical tab in `nodeMenu.ts` — hidden when `editor.getPatientProvider().canImportClinicalData()` is false or the node has no `linkedPatientRef`; on click, call `openClinicalImportModal(nodeId, linkedPatientRef, onImported)`; `onImported` additively merges returned disorders into the node's disorder list

## 7. GA4GH Export — Stable Patient IDs

- [x] 7.1 Update `GA4GHFHIRConverter.processTreeNode` to check the pedigree node's `linkedPatientRef` property first; if present, use it as the Patient resource `id` (stripping `Patient/` prefix and using the remainder as the UUID/id); fall back to `generateUUID()` when absent
- [x] 7.2 Update `GA4GHFHIRConverter.extractDataFromPatient` (import side) to populate `linkedPatientRef` from the `familymemberhistory-patient-record` extension if present, so that stable references round-trip through export/import

## 8. Export linkedPatientRef from App

- [x] 8.1 Export `OpenPedigree.FHIRPatientProvider` from `src/app.js` so host pages can instantiate it

## 9. Build and Smoke Test

- [x] 9.1 Run `npm run build` — resolve any TypeScript errors
- [x] 9.2 Smoke test with `EmptyPatientProvider` (default) — verify "Link to patient" button is hidden and editor works as before
- [x] 9.3 Smoke test with `FHIRPatientProvider` against a FHIR test server — verify patient search modal opens, patient selection sets `linkedPatientRef`, node name updates; verify GA4GH export uses stable Patient ID
