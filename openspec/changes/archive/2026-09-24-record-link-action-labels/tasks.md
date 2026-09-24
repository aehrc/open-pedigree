## 1. Implementation

- [x] 1.1 Add optional `getActionLabel(action)` (and a `RecordLinkAction` type) to `AbstractRecordLinkProvider`, returning `undefined` by default
- [x] 1.2 Use it in `Pedigree._parseQuestionnaireConfig()` when present, falling back to the default for anything but a non-blank string

## 2. Testing

- [x] 2.1 e2e: a provider relabels one action, and the others keep their defaults
- [x] 2.2 e2e: a blank or non-string label keeps the default
- [x] 2.3 Mutation check: ignoring the override fails 2.1
- [x] 2.4 e2e: a provider without the method keeps all defaults; a throwing hook keeps defaults and the editor still loads

## 3. Release

- [x] 3.1 PR (`feat:`), merge, release-please minor release (aehrc/open-pedigree#27, released in 1.2.0)
- [x] 3.2 Return "Edit in REDCap" from `redcap_pedigree_editor`'s provider (done in its PR #14). Refreshing its bundled `open-pedigree/dist/` is tracked in that module, batched with the next open-pedigree release
