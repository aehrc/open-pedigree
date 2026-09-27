## Why

Linking a node to a record with the Linked Record tab's *Link to existing record* sets only the node's linked-record ref. The record's values don't reach the node until the first `openEditor` refresh. In `redcap_pedigree_editor` that means opening "Edit in REDCap" and closing the window. So a freshly linked person shows an empty Linked Record tab, which users read as "the link didn't work". `createNew`'s `onCreated(recordRef, answers)` already brings the new record's values in the same step, and linking should behave the same way.

## What Changes

- `openPicker`'s `onLinked` callback takes an optional third argument, `answers` (`{linkId, value}[]`), the same shape as `onCreated`'s.
- When `answers` is an array, `linkRecord` applies it after storing the ref, exactly as `createNewRecord` does: the ref (and the snapshot reset, when the ref changes) in one event, then the answers with the linked-record refresh semantics.
- Non-breaking: a provider that calls `onLinked(recordRef)` or `onLinked(recordRef, details)` behaves as today.

## Capabilities

### Modified Capabilities
- `record-link-provider`: `onLinked` can bring the record's answers.

## Impact

- `src/script/recordLinkProvider/AbstractRecordLinkProvider.ts` (callback type), `src/script/pedigree.ts` (`linkRecord`).
- e2e: `tests/e2e/record-link-provider.spec.js`.
- Released as a minor version (`feat:`). `redcap_pedigree_editor` picks it up by refreshing its bundled `dist/` and passing the row's answers from its picker.
