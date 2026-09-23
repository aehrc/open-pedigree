## Why

`redcap_pedigree_editor`'s linked-record edit action no longer imports inside the editor: it opens REDCap's own data-entry form for the row and re-imports when that window closes (its `pedigree-editor-repeating-instrument-sync` change). The button should say so, "Edit in REDCap", but the three record-link action labels ("Link to existing record", "Create new linked record", "Edit linked record") are hardcoded in `Pedigree._parseQuestionnaireConfig()`, with no way for a host to change them. Host-specific wording like "REDCap" doesn't belong in this generic library's defaults.

## What Changes

- `AbstractRecordLinkProvider` gains an optional, non-abstract `getActionLabel(action)` (`action`: `'linkRecord' | 'createNewRecord' | 'editRecord'`), returning a label or `undefined`. The base implementation returns `undefined`.
- `_parseQuestionnaireConfig()` uses a provider's non-blank string label for each action, else the existing generic default. It checks that the method exists before calling it, since hosts may pass a duck-typed provider object that doesn't extend the class, like `redcap_pedigree_editor`'s.
- Non-breaking: providers without the method, and `EmptyRecordLinkProvider`, keep today's labels.

## Capabilities

### Modified Capabilities
- `record-link-provider`: adds the optional action-label override.

## Impact

- `src/script/recordLinkProvider/AbstractRecordLinkProvider.ts`, `src/script/pedigree.ts`.
- e2e: `tests/e2e/record-link-provider.spec.js`.
- Released as a minor version (`feat:`). `redcap_pedigree_editor` picks it up by refreshing its bundled `dist/`.
