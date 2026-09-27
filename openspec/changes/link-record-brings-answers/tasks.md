## 1. Implementation

- [x] 1.1 Add the optional `answers` argument to `openPicker`'s `onLinked` type in `AbstractRecordLinkProvider`
- [x] 1.2 In `Pedigree`'s `linkRecord` action, apply `answers` when it's an array, through a new `_applyLinkedRecord()` that `createNewRecord` shares. It sends the ref, the changes (computed against the node's current snapshot, so a previous record's values are replaced or cleared) and the new snapshot as one event, so one undo removes both. `_dispatchLinkedRecordRefresh`'s change computation is split out as `_linkedRecordRefreshChanges()`
  - Review: the first version sent the ref (with a snapshot reset) and then the refresh as two events, as `createNewRecord` did. A relink then left the old record's values wherever the new record's were empty, and one undo removed the values but not the link

## 2. Testing

- [x] 2.1 e2e: linking with answers sets the ref and the answer; linking without answers only sets the ref (existing full-flow test)
- [x] 2.2 e2e: relinking to another record with answers replaces the old record's value and snapshot
- [x] 2.3 Mutation check: ignoring the argument fails 2.1 (both new tests fail; record-link-provider spec 31/31, unit 224/224)
- [x] 2.4 e2e: relinking to a record without a value clears the old record's value but keeps one typed in the diagram; one undo removes a link and its values. Mutation check: the two-event version fails both. Spec 33/33, unit 224/224

## 3. Release

- [ ] 3.1 PR (`feat:`), merge, release-please minor release
- [ ] 3.2 `redcap_pedigree_editor`: bundle the release and pass the picked row's answers from its picker
