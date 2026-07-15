## 1. Contract generalization (D1, D3)

- [x] 1.1 `AbstractPatientProvider.ts`: rename `fhirRef` parameter to `patientRef` in `lookupPatient`, `openPatientPickerModal`'s `onSelected`, and `openClinicalImportModal`
- [x] 1.2 `AbstractPatientProvider.ts`: change `openClinicalImportModal`'s `onImported` type from `(disorders: {id: string, name: string}[]) => void` to `(answers: {linkId: string, value: any}[]) => void`

## 2. Generalized import dispatch (D2)

- [x] 2.1 `pedigree.ts`: rewrite `_questionnaireActions.importClinicalData` to loop over the returned `{linkId, value}[]` and resolve each entry's target setter using the same priority `generateNodeMenu()` already computes (reserved legend target → `mapsToField` target → generic `setQuestionnaireAnswer_<linkId>`)
- [x] 2.2 Preserve merge-by-`id`-without-duplicates semantics for the three reserved legend targets (`disorders`/`candidate_genes`/`hpo_positive`)
- [x] 2.3 Dispatch `mapsToField` targets and plain/unmapped items as a direct overwrite through their resolved setter
- [x] 2.4 Rename the local `fhirRef` variable in this action to `patientRef`

## 3. FHIRPatientProvider / SmartPatientProvider updates

- [x] 3.1 `FHIRPatientProvider.ts`: rename `fhirRef` parameters/variables to `patientRef`
- [x] 3.2 `FHIRPatientProvider.ts`: update `openClinicalImportModal` to call `onImported([{ linkId: 'disorders', value: disorders }])` instead of `onImported(disorders)`
- [x] 3.3 `SmartPatientProvider.ts`: rename any `fhirRef` parameters/variables to `patientRef` (no behavioral change expected — verify)

## 4. GA4GH export regression test (D5)

- [x] 4.1 Add a unit test in `GA4GHFHIRConverter`'s test suite confirming a non-`Patient/`-prefixed `linkedPatientRef` is excluded from the exported Patient reference and export falls back to default reference generation

## 5. Test updates

- [x] 5.1 Update existing unit/e2e tests that call `onImported` with the old disorders-only shape to use `{ linkId: 'disorders', value: [...] }` (no existing test exercised the old shape directly — nothing to update; verified via repo-wide search)
- [x] 5.2 Add unit tests for the generalized dispatch: a `mapsToField` target entry, a plain unmapped item entry, and a mixed-kind `onImported` array in one call (added as e2e tests in `tests/e2e/patient-provider-import.spec.js`, since the dispatch logic depends on a live PedigreeEditor/View/Controller)
- [x] 5.3 Run full unit + e2e suite; confirm no regressions in existing `patient-provider`/`smart-editor` scenarios (190/190 unit, 32/32 e2e; one unrelated flaky visual-regression test in add-node.spec.js confirmed pre-existing/non-deterministic, not caused by this change)

## 6. Merge

- [ ] 6.1 Merge into `develop`
- [ ] 6.2 Merge into `develop_redcap_em` (per branch model — no REDCap-specific logic in this change, applies to both)
