## 1. Implementation

- [x] 1.1 Add the optional `answers` argument to `openPicker`'s `onLinked` type in `AbstractRecordLinkProvider`
- [x] 1.2 In `Pedigree`'s `linkRecord` action, apply `answers` when it's an array, through a new `_applyLinkedRecord()` that `createNewRecord` shares. It sends the ref, the changes (computed against the node's current snapshot, so a previous record's values are replaced or cleared) and the new snapshot as one event, so one undo removes both. `_dispatchLinkedRecordRefresh`'s change computation is split out as `_linkedRecordRefreshChanges()`
  - Review: the first version sent the ref (with a snapshot reset) and then the refresh as two events, as `createNewRecord` did. A relink then left the old record's values wherever the new record's were empty, and one undo removed the values but not the link

## 2. Testing

- [x] 2.1 e2e: linking with answers sets the ref and the answer; linking without answers only sets the ref (existing full-flow test)
- [x] 2.2 e2e: relinking to another record with answers replaces the old record's value and snapshot
- [x] 2.3 Mutation check: ignoring the argument fails 2.1 (both new tests fail; record-link-provider spec 31/31, unit 224/224)
- [x] 2.5 Second review round (final diff): a relink compared the new record's values with the old record's snapshot, so a value the two shared wasn't applied over a diagram edit. Now `relinkRefreshInput()` builds the baseline: the old snapshot minus what the new record sends, plus empties for linkIds it leaves out. It has unit tests (5 new). The ref goes ahead of the values in the event. The snapshot requirement is MODIFIED, not contradicted. One dispatch helper is shared. e2e: a value shared with the old record is applied over a diagram edit (mutation-checked: relink wiring off fails it). Spec 34/34, full e2e 68/68, unit 229/229
- [x] 2.6 Third review round: on a relink, a value the new record can't use (an unparseable date) counts as empty, so the old record's value is cleared instead of lingering untracked (`isUnusableAnswer`, unit-tested). `linkRecord`/`createNewRecord` pass the click-time node, and `_applyLinkedRecord` ignores a late callback for a node that's no longer at that ID; e2e-tested and mutation-checked. The two requirements that still described `onCreated` as an ordinary refresh are MODIFIED too. The dispatch helper takes an explicit `recordRef`. Unit 230/230, e2e 69/69
- [x] 2.7 Fourth review round: on an ordinary refresh, an unparseable date now keeps the record's last usable date in the snapshot, so a later empty still clears it. This behaviour dates from 1.3.0, fixed here because it's the same defect. `relinkRefreshInput` skips null entries. `onCreated` without answers stores only the ref, as before. All three are unit- or e2e-tested; the answerless-create test is mutation-checked. Accepted: a late `onLinked` that `_applyLinkedRecord` drops (the node at that ID was replaced) only warns in the console, because open-pedigree has no message surface of its own. It only happens if the pedigree is rebuilt while the picker is open. Unit 232/232, e2e 70/70
- [x] 2.4 e2e: relinking to a record without a value clears the old record's value but keeps one typed in the diagram; one undo removes a link and its values. Mutation check: the two-event version fails both. Spec 33/33, unit 224/224

## 3. Release

- [x] 3.1 PR (`feat:`), merge, release-please minor release (aehrc/open-pedigree#34, released via #35 as 1.4.0; this archive ships in the same release)
- [x] 3.2 `redcap_pedigree_editor`: bundle the release and pass the picked row's answers from its picker. The picker side is done on its branch `feature/link-brings-values`, e2e 46/46 against this change's build. The bundle refresh from the 1.4.0 tag is tracked in that module

## 4. Verify

- [x] 4.1 Every scenario has a named test. "Linking a record can bring its answers": linking with/without answers, relinking replaces, relinking clears but keeps diagram values, a shared value applied over a diagram edit, one undo, a late callback ignored, answerless onCreated (`record-link-provider.spec.js`), plus `relinkRefreshInput` unit tests. The MODIFIED snapshot, refresh and createNew requirements are covered by the existing round-trip tests, which still pass. Four `/code-review` rounds on the full diff; their findings are fixed or recorded in 2.5-2.7. Unit 232/232, e2e 70/70
