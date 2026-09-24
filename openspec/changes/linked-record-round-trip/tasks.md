## 1. Persistence

- [x] 1.1 `Person`: add the record snapshot beside `_linkedRecordRef` (D3; the link actions reset it, only when the ref changes); round-trip it in `getProperties`/`assignProperties` (`internal` format)
- [x] 1.2 GA4GH export: write the `linked-record-ref` Patient extension (D1), and the `linked-record-snapshot` Patient extension (D2, revised from QR markers)
- [x] 1.3 GA4GH import: restore the ref and snapshot from their Patient extensions
- [x] 1.4 Unit tests: GA4GH export → import round trip keeps the ref and snapshot; unlinked nodes carry no extension; de-identified exports carry neither; old documents load with no snapshot

## 2. Refresh dispatch

- [x] 2.1 Per-target clear table (D5) with unit tests per target
- [x] 2.2 `_dispatchLinkedRecordRefresh` (D4): compare with the snapshot (revised D4): set changes, clear only while the node still holds the record's value, reconcile legends; skip unparseable dates; one flagged event with only real changes plus the new snapshot; nothing when unchanged; skip if the node was relinked since editing began
- [x] 2.3 Legend reconciliation: remove entries the record dropped, add new ones, keep ones it never sent, matching through `sanitizeID`; unit tests incl. replacement and sanitised IDs
- [x] 2.4 `Controller.handleSetProperty`: strict comparison for refresh events (D6); birth/death ordering for every event incl. undo (`_orderDatePair`, D7); record each property's pre-event value once so undo restores it; a snapshot-only change isn't a visible change
- [x] 2.5 Route `editRecord` and `createNewRecord` through the refresh dispatch; `importClinicalData` unchanged

## 3. Verification

- [x] 3.1 e2e (`tests/e2e/record-link-provider.spec.js`): link, save as GA4GH, reload, and the link and Edit action are still there
- [x] 3.2 e2e: a refresh with `null` clears the record's value but not a diagram-entered or rejected one; gender and an integer `0` clear; an unchanged or normalised value adds no undo step; monozygotic twins keep the same gender; dates move both ways; relink undo and same-ref relink keep the right snapshot; `{system, code}` legend entries work
- [x] 3.3 e2e: legend reconciliation (removed, replaced, diagram-entered kept)
- [x] 3.4 Run the full unit and e2e suites; tsc output unchanged (final: unit 224/224, full e2e 61/61, tsc 440 lines before and after; mutation checks: link export, clear-only-while-the-record's, skip-if-unchanged each fail their tests when removed)

## 4. Wrap-up

- [x] 4.1 Adversarial `/code-review` of the whole PR before opening it
  - Round 1 (2026-09-24) found the node-comparison design couldn't settle (setters normalise, reject and recompute values); reworked to compare with a record snapshot (D2/D4 revised, David chose the trade-off). Also found and fixed: legend ID sanitising, adopted-only twin exception, relink undo, custom legend items, and the dead `Array#without` in `removePhenotype`/`removeGene` (broken on `main`). Its date-order finding didn't reproduce live (covered by e2e both ways). 
  - Round 2 (2026-09-24) found the e2e harness double-initialised the editor, so two Controllers handled every event. That hid a real date-order bug (round 1's "didn't reproduce" was wrong) and made undo counts unreliable. Fixed the harness, ordered birth/death dates, moved the snapshot reset into the link actions (relink undo, same-ref relink), removed the adopted-only twin exception and the side-effect restore pass (both created states open-pedigree doesn't allow), made the snapshot exactly each refresh's answers, and accepted any legend entry shape. 
  - Round 3 (2026-09-24): most round-2 fixes confirmed (relink undo, same-ref relink, snapshot, single-Controller harness, including other listeners). Fixed: custom legend `{id, name}` entries; birth/death ordering moved into the controller, so undo and edits get it too (and `>=` for same-day); a stale Edit window (node relinked meanwhile) is skipped; undo memo recorded once per property (the life-status undo loss predates this change); snapshot-only changes add no undo step; unparseable dates skipped; link actions guard a deleted node; one `legendKey` callback and a module-level getter map. Also found (not fixed here): a custom legend item without terminology falls back to plain rendering, but its setter still expects a legend and throws - on `main`, for any way of setting it.
- [ ] 4.2 Open the PR (`feat:`); hold the release PR until the host side is ready, so this ships as one minor version
- [ ] 4.3 Host (`redcap_pedigree_editor`): send `null` for empty fields, reword the "no values to import" message, refresh `dist/` from the release, and add e2e for save/reload keeping links and for clears via REDCap
- [ ] 4.4 `/opsx:verify`, then archive
