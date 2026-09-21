## 1. AbstractRecordLinkProvider contract (D1, D2, D3)

- [ ] 1.1 Create `src/script/recordLinkProvider/AbstractRecordLinkProvider.ts` with `isConfigured()`, `canLink(nodeId)`, `canCreateNew(nodeId)`, `openPicker(nodeId, onLinked)`, `openEditor(nodeId, onDone)`, `createNew(nodeId, onCreated)`, where `onDone`/`onCreated` are typed `(answers: {linkId: string, value: any}[]) => void`
- [ ] 1.2 Create `src/script/recordLinkProvider/EmptyRecordLinkProvider.ts`: `isConfigured()`/`canLink()`/`canCreateNew()` all return `false`; other methods no-op
- [ ] 1.3 `pedigree.ts`: add `_recordLinkProvider`, read `options.recordLinkProvider || new EmptyRecordLinkProvider()`, add `getRecordLinkProvider()` accessor (mirror `_patientProvider`/`getPatientProvider()` exactly)

## 2. Questionnaire parsing for linked-record-source (D4)

- [ ] 2.1 Define the `questionnaire-linked-record-source` extension URL constant in `questionnaireParser.ts`, matching the existing namespace convention (`https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source`)
- [ ] 2.2 Parse the extension's presence into `item.linkedRecordSource: boolean` on the parsed item descriptor, independent of `questionnaire-field-mapping` parsing
- [ ] 2.3 Unit test: item with the extension parses to `linkedRecordSource: true`; item without it parses to falsy

## 3. Always-disabled rendering (D5)

- [ ] 3.1 `view/person.ts`'s `getSummary()`: short-circuit `disabled = true` when `item.linkedRecordSource` is true, before/alongside the existing `disabledWhen`/`disablingPredicate` evaluation
- [ ] 3.2 Unit test: item with `linkedRecordSource: true` and a `disabledWhen` that would otherwise evaluate false is still reported disabled
- [ ] 3.3 Unit test: existing `disabledWhen`/`disablingPredicate` behavior is unchanged for items without `linkedRecordSource`

## 4. Regrouping into the reserved tab (D6)

- [ ] 4.1 In tab assembly (`generateNodeMenu()`/`_buildFieldDescriptors()` or `questionnaireParser.ts`'s tab-building pass — whichever is the better seam, decide during implementation), extract every `linkedRecordSource: true` item from its authored tab/group and place it on the reserved Linked Record tab instead
- [ ] 4.2 Preserve each extracted item's original immediate parent group as a sub-heading within the reserved tab
- [ ] 4.3 Unit/e2e test: items authored under two different groups both land on the reserved tab, correctly sub-headed
- [ ] 4.4 Unit/e2e test: editable (non-linked) items remain on their originally-authored tabs, unaffected

## 5. Linked Record tab and node-menu actions

- [ ] 5.1 Add the reserved "Linked Record" tab to the node menu, shown only when `recordLinkProvider.isConfigured()` is true
- [ ] 5.2 Add `_questionnaireActions` entries invoking `openPicker`/`openEditor`/`createNew`, gated by `canLink`/`canCreateNew`/whether the node currently has a linked record
- [ ] 5.3 Wire `onLinked`/`onDone`/`onCreated` callbacks to dispatch through the existing `_resolveQuestionnaireSetter` path (same as `importClinicalData`'s dispatch) and trigger a re-render of the Linked Record tab's displayed values
- [ ] 5.4 e2e test: full flow — configure a stub `recordLinkProvider`, link a node, invoke edit, confirm dispatched answers update the read-only-rendered items on the tab

## 6. Regression and merge

- [ ] 6.1 Run full unit + e2e suite; confirm no regressions to `patient-provider`/existing Questionnaire scenarios
- [ ] 6.2 Add/update `openspec/specs/` entries for the three new capabilities (sync on archive)
- [ ] 6.3 Merge into `main` (per the trunk-based model established in `trunk-based-workflow-migration` — this change should be sequenced after that one lands)
