## 1. Persistence

- [x] 1.1 `Person`: add the supplied set beside `_linkedRecordRef` (D3); clear it when the ref changes; round-trip it in `getProperties`/`assignProperties` (`internal` format)
- [x] 1.2 GA4GH export: write the `linked-record-ref` Patient extension (D1), and supplied markers on QR items and legend answers (D2)
- [x] 1.3 GA4GH import: restore the ref from the Patient extension and the supplied set from the QR markers
- [x] 1.4 Unit tests: GA4GH export → import round trip keeps the ref and supplied set; unlinked nodes carry no extension; old documents load with an empty supplied set

## 2. Refresh dispatch

- [x] 2.1 Per-target clear table (D5) with unit tests per target
- [x] 2.2 `_dispatchLinkedRecordRefresh` (D4): resolve, compute set/clear-if-supplied/reconcile, strict compare, and one flagged event with only real changes plus the new supplied set; nothing when unchanged
- [x] 2.3 Legend reconciliation: remove supplied entries that are gone, add new ones, keep never-supplied entries; unit tests incl. the D1→D2 replacement
- [x] 2.4 `Controller.handleSetProperty`: for `linkedRecordRefresh` events, strict comparison and no twin propagation (D6); clears before sets, birth date before death date (D7)
- [x] 2.5 Route `editRecord` and `createNewRecord` through the refresh dispatch; `importClinicalData` unchanged

## 3. Verification

- [x] 3.1 e2e (`tests/e2e/record-link-provider.spec.js`): link, save as GA4GH, reload, and the link and Edit action are still there
- [x] 3.2 e2e: a refresh with `null` clears a supplied value but not a diagram-entered one; gender and an integer `0` clear; a no-op refresh adds no undo step; a twin is untouched
- [x] 3.3 e2e: legend reconciliation (removed, replaced, diagram-entered kept)
- [x] 3.4 Run the full unit and e2e suites; tsc output unchanged (unit 223/223, e2e 49/49, tsc 440 lines before and after; mutation checks: link export, twin skip, supplied-only clearing each fail their tests when removed)

## 4. Wrap-up

- [ ] 4.1 Adversarial `/code-review` of the whole PR before opening it
- [ ] 4.2 Open the PR (`feat:`); hold the release PR until the host side is ready, so this ships as one minor version
- [ ] 4.3 Host (`redcap_pedigree_editor`): send `null` for empty fields, reword the "no values to import" message, refresh `dist/` from the release, and add e2e for save/reload keeping links and for clears via REDCap
- [ ] 4.4 `/opsx:verify`, then archive
