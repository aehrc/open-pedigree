## Why

`questionnaire-source-of-truth` made the node-edit form — and the data captured per person — driven entirely by an arbitrary FHIR Questionnaire, with any number of custom fields (`mapsToField`, `mapsToLegendCondition`/`mapsToLegendObservation`, or plain unmapped items). `AbstractPatientProvider.openClinicalImportModal`'s `onImported` callback still hardcodes the opposite assumption: that importing clinical data always means returning a disorders list (`{id, name}[]`). A planned REDCap-repeating-instrument-backed provider (`redcap_pedigree_editor`'s `pedigree-repeating-instrument-import` change) needs to import answers for *any* Questionnaire-mapped field from a REDCap record — gender, DOB, a custom legend field, a plain custom item — not only disorders. The contract needs to generalize before any provider beyond `FHIRPatientProvider`'s FHIR-`Condition`-shaped import can be built against it.

## What Changes

- **BREAKING**: `AbstractPatientProvider.openClinicalImportModal`'s `onImported` callback changes from `(disorders: {id: string, name: string}[]) => void` to `(answers: {linkId: string, value: any}[]) => void` — an array of Questionnaire-`linkId`-keyed answers instead of an always-disorders list.
- The built-in `importClinicalData` action (`pedigree.ts`) generalizes from a hardcoded disorders-merge to resolving each returned `{linkId, value}` through the same per-`linkId` setter-dispatch table `generateNodeMenu()` already builds — reserved legend targets (`disorders`/`candidate_genes`/`hpo_positive`) keep today's merge-by-id-without-duplicates behavior; `mapsToField` targets and plain/unmapped items dispatch through their real setter directly.
- `FHIRPatientProvider` updates to the new callback shape, returning `{linkId: 'disorders', value: [...]}` — no behavior change for existing FHIR-based deployments.
- Rename the `fhirRef` parameter (in `AbstractPatientProvider`, `FHIRPatientProvider`, `SmartPatientProvider`, `pedigree.ts`) to `patientRef` — naming-only cleanup so the contract doesn't read as FHIR-specific to a future non-FHIR implementer; no behavior change.
- Confirm and add a regression test for GA4GH export's existing behavior: a `linkedPatientRef` that doesn't start with `Patient/` is already excluded from being used as the exported Patient reference — documented here as intentional, preserved default behavior for non-FHIR-shaped refs, not changed by this proposal.
- `linkedPatientRef` (the persisted node property name) is **retained unchanged** — not renamed — to avoid a breaking change to the saved-pedigree JSON format; see design.md D4.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `patient-provider`: `openClinicalImportModal`'s `onImported` callback shape generalizes from disorders-only to an arbitrary `linkId`-keyed answer bag; the `fhirRef` parameter is renamed `patientRef`; GA4GH export's non-FHIR-ref exclusion is documented as an explicit, tested requirement

## Impact

- `src/script/patientProvider/AbstractPatientProvider.ts` — callback signature and parameter rename
- `src/script/patientProvider/FHIRPatientProvider.ts` — updated `onImported` call site, parameter rename
- `src/script/patientProvider/SmartPatientProvider.ts` — parameter rename (extends `FHIRPatientProvider`, no behavior change)
- `src/script/pedigree.ts` — `_questionnaireActions.importClinicalData` dispatch generalization
- `src/script/GA4GHFHIRConverter.ts` — no code change; regression test only, confirming existing non-`Patient/`-prefixed-ref exclusion
- Existing unit/e2e tests referencing the old disorders-only `onImported` shape
- Downstream: `redcap_pedigree_editor`'s planned `RedcapInstrumentPatientProvider` (tracked in the `pedigree-repeating-instrument-import` change at the workspace level) depends on this change landing first — it needs to import answers beyond disorders
