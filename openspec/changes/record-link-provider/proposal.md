## Why

`redcap_pedigree_editor` needs to link a pedigree node to a row on a REDCap repeating instrument, let the user edit that row via REDCap's own native data-entry form (opened in a new browser window, so REDCap's validation/branching-logic/audit-trail apply — not reimplemented inside the pedigree editor), and refresh the node's data when that window closes. `AbstractPatientProvider` (`src/script/patientProvider/`) cannot express this: its own architecture doc describes it as scoped to "FHIR Patient sourcing," its two entry points (`openPatientPickerModal`, `openClinicalImportModal`) are named and shaped around a one-shot search-then-import flow, and nothing about it anticipates a provider opening a separate window and needing the host to know when to re-render. Stretching `AbstractPatientProvider` further would misname and overload an interface that's already been generalized once (`generalize-patient-provider-import`) for a narrower purpose (any Questionnaire-mapped field, still FHIR-Patient-shaped). A new, sibling extension point is needed instead.

Separately: once linked data is editable only through this new provider (and, per `redcap_pedigree_editor`'s design, only through REDCap's own form — never directly in the pedigree editor), any Questionnaire item sourced from a linked external record needs to render read-only and grouped together, so users aren't confused about why some fields in a tab are editable and others aren't. This is independent of whether any record-link provider is even configured, so it belongs in the Questionnaire subsystem, not the new provider interface itself.

## What Changes

- **New capability**: `record-link-provider` — a new `AbstractRecordLinkProvider` (in `src/script/recordLinkProvider/`), a sibling to `AbstractPatientProvider`, not a modification of it:
  - `isConfigured()`, `canLink(nodeId)`, `canCreateNew(nodeId)` — presentation-agnostic capability flags, mirroring `AbstractPatientProvider`'s `canImportClinicalData()`/`canLinkProband()` pattern.
  - `openPicker(nodeId, onLinked)` — search/attach an existing external record; analogous to `openPatientPickerModal`.
  - `openEditor(nodeId, onDone)` — the provider fully owns *how* editing happens (a window, a modal, whatever); it just calls `onDone(answers)` when the host should re-pull current values. Open-pedigree has no concept of "windows" anywhere in this contract.
  - `createNew(nodeId, onCreated)` — create a brand-new linked record when none exists yet.
  - `onDone`/`onCreated` reuse the exact `{linkId: string, value: any}[]` answer-bag shape `generalize-patient-provider-import` already established for `onImported`, and dispatch through the same existing `_resolveQuestionnaireSetter` priority — no second dispatch mechanism.
  - `EmptyRecordLinkProvider` default no-op, and a new `recordLinkProvider` option in `initialiseEditor()`, matching `patientProvider`'s wiring exactly.
- **New capability**: `linked-record-questionnaire-rendering` — a new, generic (non-REDCap-named) Questionnaire item extension that marks an item as sourced from a linked external record. Any item carrying it is automatically rendered disabled/read-only (no per-item `disabledWhen` authoring required) and grouped together in one place in the node-edit form, regardless of which tab/group it was declared under, rather than interspersed with editable items. Works standalone, with no `recordLinkProvider` configured at all.
- **New capability**: `linked-record-tab` — the node menu gains a reserved tab (parallel to how the Personal/Clinical tabs work for `patient-provider`) showing: the "Link"/"Create new"/"Edit" actions driven by `recordLinkProvider`, and every item marked per the `linked-record-questionnaire-rendering` capability, sub-grouped by whatever section structure they were originally authored under.

## Capabilities

### New Capabilities
- `record-link-provider`: pluggable, presentation-agnostic linked-external-record lifecycle (link/edit/refresh/create), sibling to `patient-provider`
- `linked-record-questionnaire-rendering`: generic extension marking a Questionnaire item as externally-sourced, driving automatic read-only rendering
- `linked-record-tab`: reserved node-menu tab combining the provider's actions with the rendered read-only linked items

### Modified Capabilities
- none — `patient-provider` is untouched by this change

## Impact

- New files: `src/script/recordLinkProvider/AbstractRecordLinkProvider.ts`, `src/script/recordLinkProvider/EmptyRecordLinkProvider.ts`
- `src/script/pedigree.ts`: wire `recordLinkProvider` option (mirroring `_patientProvider`), add `getRecordLinkProvider()`, add `_questionnaireActions` entries for the new tab's Link/Create/Edit buttons, dispatching `onDone`/`onCreated` answer bags through the existing `_resolveQuestionnaireSetter` path
- `src/script/questionnaire/questionnaireParser.ts`: recognize the new generic linked-record-source extension, expose it per item
- `src/script/view/person.ts`: `getSummary()` treats a linked-record-sourced item as always disabled, independent of `disabledWhen`/`disablingPredicate` evaluation
- Node-menu tab assembly (wherever tabs are built from `_questionnaireConfig.tabs` today — see `generateNodeMenu()`/`_buildFieldDescriptors()`): regroup linked-record-sourced items into the reserved tab regardless of authored placement
- Downstream: `redcap_pedigree_editor`'s planned `RedcapInstrumentPatientProvider`/record-link implementation (tracked in the workspace-level `pedigree-editor-redcap-extension-extraction` change) depends on this change landing first
