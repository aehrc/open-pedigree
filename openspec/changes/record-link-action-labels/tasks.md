## 1. Implementation

- [x] 1.1 Add optional `getActionLabel(action)` (and a `RecordLinkAction` type) to `AbstractRecordLinkProvider`, returning `undefined` by default
- [x] 1.2 Use it in `Pedigree._parseQuestionnaireConfig()` when present, falling back to the default for anything but a non-blank string

## 2. Testing

- [x] 2.1 e2e: a provider relabels one action, and the others keep their defaults
- [x] 2.2 e2e: a blank or non-string label keeps the default
- [x] 2.3 Mutation check: ignoring the override fails 2.1
- [x] 2.4 e2e: a provider without the method keeps all defaults; a throwing hook keeps defaults and the editor still loads

## 3. Release

- [ ] 3.1 PR (`feat:`), merge, release-please minor release
- [ ] 3.2 Refresh `redcap_pedigree_editor`'s bundled `open-pedigree/dist/` from the release and return "Edit in REDCap" from its provider
