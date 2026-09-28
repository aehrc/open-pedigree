## Why

Linking a node to a record with the Linked Record tab's *Link to existing record* sets only the node's linked-record ref. The record's values don't reach the node until the first `openEditor` refresh. In `redcap_pedigree_editor` that means opening "Edit in REDCap" and closing the window. So a freshly linked person shows an empty Linked Record tab, which users read as "the link didn't work". `createNew`'s `onCreated(recordRef, answers)` already brings the new record's values in the same step, and linking should behave the same way.

## What Changes

- `openPicker`'s `onLinked` callback takes an optional third argument, `answers` (`{linkId, value}[]`), the same shape as `onCreated`'s.
- When `answers` is an array, `linkRecord` stores the ref and applies the answers in **one event** (one undo step), through `_applyLinkedRecord()`, which `createNewRecord` now shares. For a different record, every value it has is applied, and the previous record's values are cleared where it has none, while the node still holds them (`relinkRefreshInput()`). A re-pick of the same record is an ordinary refresh. The snapshot requirement is modified to match: a ref change now replaces the snapshot with the new record's answers, not only resets it.
- Non-breaking: a provider that calls `onLinked(recordRef)` or `onLinked(recordRef, details)` behaves as today.

## Capabilities

### Modified Capabilities
- `record-link-provider`: `onLinked` can bring the record's answers.

## Impact

- `src/script/recordLinkProvider/AbstractRecordLinkProvider.ts` (callback type), `src/script/pedigree.ts` (`linkRecord`, `createNewRecord`, `_applyLinkedRecord`), `src/script/recordLinkProvider/linkedRecordRefresh.ts` (`relinkRefreshInput`).
- unit: `tests/unit/recordLinkProvider/linkedRecordRefresh.test.js`.
- e2e: `tests/e2e/record-link-provider.spec.js`.
- Released as a minor version (`feat:`). `redcap_pedigree_editor` picks it up by refreshing its bundled `dist/` and passing the row's answers from its picker.
