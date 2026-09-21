## Context

`AbstractPatientProvider` (`isConfigured`, `canImportClinicalData`, `canSearchFamilyMembers`, `canLinkProband`, `lookupPatient`, `openPatientPickerModal`, `openClinicalImportModal`) is invoked from exactly two places in `pedigree.ts`'s `_questionnaireActions` (`linkPatient`, `importClinicalData`), both one-shot button-triggered actions. `generalize-patient-provider-import` (archived) already generalized `openClinicalImportModal`'s `onImported` callback to `{linkId, value}[]`, specifically anticipating a REDCap-backed provider needing to import arbitrary mapped fields — but that change deliberately did not touch the modal-vs-window question, since at the time no consumer needed anything but a modal.

The Questionnaire subsystem already has a fully generic per-item `disabled` computation: `Person.getSummary()` (`src/script/view/person.ts`) sets `disabled` from `item.disabledWhen` (evaluated against current answers) or `item.disablingPredicate` (a named predicate function evaluated via `graphPredicateEvaluator.ts`). Neither today is driven by anything about where an item's data comes from — that's new ground this change adds. The parser (`questionnaireParser.ts`) currently recognizes exactly four non-standard extensions: `questionnaire-field-mapping`, `questionnaire-action`, `questionnaire-enable-predicate`, and the FHIR-standard item-control extension. It does **not** parse `redcap_pedigree_editor`'s `questionnaire-redcap-source` extension at all today — that extension is inert from open-pedigree's point of view; it's read only by `redcap_pedigree_editor`'s own PHP import-handling code.

## Goals / Non-Goals

**Goals:**
- Define a presentation-agnostic linked-record lifecycle contract that a REDCap-backed (or any other) provider can implement using a full browser window for editing, with open-pedigree never needing to know a window was involved.
- Make "this item is read-only because it's sourced from a linked external record" a generic, standalone Questionnaire capability — usable with no provider configured, and not named after REDCap.
- Preserve `AbstractPatientProvider` exactly as-is; this is additive, not a modification.

**Non-Goals:**
- Removing or deprecating `AbstractPatientProvider` — both subsystems can coexist; a project could in principle configure both a `patientProvider` and a `recordLinkProvider`.
- Implementing `RedcapInstrumentPatientProvider`/the concrete REDCap-backed record-link provider itself, or the window-opening/`.closed`-polling mechanics — those are `redcap_pedigree_editor`'s implementation, tracked in the workspace-level `pedigree-editor-redcap-extension-extraction` change.
- Defining exactly how `redcap_pedigree_editor` names/shapes its own `questionnaire-redcap-source` extension going forward — only the new, generic marker extension this change introduces is in scope here.

## Decisions

### D1 — New sibling `AbstractRecordLinkProvider`, not an extension of `AbstractPatientProvider`

A single interface trying to serve both "search a FHIR Patient and import a Condition-shaped answer" and "manage a persistent linked-record edit/refresh lifecycle that might open a whole browser window" would need enough conditional/optional surface that it stops being one coherent contract. `AbstractPatientProvider`'s own name and existing method names (`*Modal`) already commit it to the narrower shape. A new interface, structurally similar but independently named, keeps both simple.

*Alternative considered:* rename/generalize `AbstractPatientProvider` into this new shape, keeping `FHIRPatientProvider` as one implementation among several. Rejected — this would be a second breaking change to `AbstractPatientProvider` in quick succession (after `generalize-patient-provider-import`), for consumers (`FHIRPatientProvider`/`SmartPatientProvider`) that have no need for window-based editing or a create-new-record capability. No forcing function to justify the churn.

### D2 — `openEditor`/`createNew` are presentation-agnostic; open-pedigree has zero window-management code

`openEditor(nodeId, onDone)` and `createNew(nodeId, onCreated)` are pure callback contracts: the provider is invoked, and at some later point (synchronously or not) calls back with an answer bag. Whether the provider opens an in-page modal, a new `window.open()`'d tab, or does nothing visible at all is entirely its own business. Open-pedigree does not track a window handle, does not poll `.closed`, and does not know these methods might involve a second browser window.

*Alternative considered:* give open-pedigree an explicit "opened a window" concept — e.g. have `openEditor` return a window handle that open-pedigree itself polls. Rejected — this would make open-pedigree responsible for browser-window lifecycle management it has no other reason to know about, and would leak a REDCap-motivated concern (deep-linking to another page) into a generic library. The provider is already free to poll its own window's `.closed` internally and call `onDone` when appropriate — no host cooperation needed for that.

### D3 — Reuse the existing `{linkId, value}[]` answer-bag shape and dispatch path

`onDone`/`onCreated` use exactly the same shape `generalize-patient-provider-import` established for `onImported`, and dispatch through the same `_resolveQuestionnaireSetter` priority (reserved legend target → `mapsToField` target → generic `setQuestionnaireAnswer_<linkId>`) already used by `importClinicalData`. No second dispatch mechanism is introduced.

*Alternative considered:* a distinct answer shape tailored to "a full record," e.g. keyed by REDCap field name. Rejected — `linkId`-keying is already generic and already resolves correctly regardless of mapping kind; inventing a second shape would only exist to be REDCap-specific, which contradicts keeping this contract generic.

### D4 — A new, generic (non-REDCap-named) extension marks an item as linked-record-sourced

Introduce `.../questionnaire-linked-record-source` (exact URL namespace to match this repo's existing extension convention, e.g. `https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source`) as a boolean-presence extension the parser recognizes directly (like `questionnaire-field-mapping`), producing `item.linkedRecordSource: boolean`. This is deliberately a *different* extension from `redcap_pedigree_editor`'s existing `questionnaire-redcap-source` (which carries `{instrument, field}` and is used only for REDCap's own import routing, never read by open-pedigree) — `redcap_pedigree_editor` will need to attach *both* extensions to the same item once this lands: its own for import routing, this new generic one for read-only rendering. Keeping them separate means a non-REDCap implementer of `AbstractRecordLinkProvider` can mark items read-only without adopting anything REDCap-shaped.

*Alternative considered:* have open-pedigree parse `questionnaire-redcap-source` directly and treat its mere presence as the read-only signal. Rejected — that would bake a REDCap-specific extension name into a generic library, exactly the coupling this whole redesign (moving REDCap-specific code out of open-pedigree) is trying to avoid.

### D5 — Read-only rendering is a static, parse-time property, not a runtime-evaluated predicate

`item.linkedRecordSource` is checked directly in `getSummary()` (`disabled = disabled || item.linkedRecordSource`), short-circuiting before/alongside the existing `disabledWhen`/`disablingPredicate` evaluation. It is not implemented as a synthesized `disabledWhen` condition or a built-in predicate name, because it isn't state-dependent — an item either was authored as linked-record-sourced or it wasn't; there's nothing to evaluate against current answers or graph state.

*Alternative considered:* a built-in `disablingPredicate: 'isLinkedRecordSource'` recognized by `graphPredicateEvaluator.ts`. Rejected — routes a simple static fact through the dynamic predicate-evaluation machinery for no benefit; a direct boolean check is simpler and cannot be accidentally overridden by an authored `disabledWhen` that evaluates to `false`.

**Implementation note added during apply (resolves an ambiguity between this spec and `linked-record-tab`'s "hidden when not configured" scenario):** the always-disabled rendering (this decision) is applied unconditionally in `Person.getSummary()`, regardless of whether a `recordLinkProvider` is configured — matching `linked-record-questionnaire-rendering`'s own "works standalone, no recordLinkProvider configured at all" scenario. The *regrouping* onto the reserved tab (D6 below) is a separate mechanism, gated on `recordLinkProvider.isConfigured()`: when not configured, a `linkedRecordSource: true` item still renders disabled, but stays on its originally-authored tab (not moved), and the reserved "Linked Record" tab itself is entirely absent — satisfying `linked-record-tab`'s "tab SHALL NOT be shown" scenario literally. Only when a provider *is* configured do such items get moved onto the reserved tab alongside the Link/Create-new/Edit actions.

### D6 — Regrouping into one reserved tab happens at tab-assembly time, independent of authored placement

Wherever `generateNodeMenu()`/`_buildFieldDescriptors()` currently place each item on the tab its authored `group` puts it on, any item with `linkedRecordSource: true` is instead placed on a single reserved tab (the same tab the `linked-record-tab` capability's Link/Create/Edit buttons live on), in this case preserving the item's *original* immediate parent group as a sub-heading within that reserved tab (so an instrument's own `section_header` structure isn't lost — it just moves location). Exact internal implementation (a post-pass over the parsed tab structure vs. a parse-time redirect) is left to tasks.md/implementation.

## Risks / Trade-offs

- **[Risk] Two similarly-named extensions (`questionnaire-redcap-source` and the new generic `questionnaire-linked-record-source`) on the same item could drift out of sync** if `redcap_pedigree_editor`'s Questionnaire-generation code only ever attaches one of them. Mitigation: this is called out explicitly in the workspace-level `pedigree-editor-redcap-extension-extraction` change's tasks, and is a one-line addition to that code's item-emission logic — both extensions are attached together, never independently.
- **[Trade-off] A provider can only ever return static field values via the answer-bag shape** — there's no way for `openEditor`'s `onDone` to signal "nothing changed, don't bother re-rendering" versus "here are (possibly identical) fresh values." Accepted: re-dispatching identical values through existing setters is a harmless no-op (same as any other redundant `pedigree:node:setproperty` dispatch today).
- **[Risk] `EmptyRecordLinkProvider`/no provider configured, but a Questionnaire still marks items `linkedRecordSource: true`** — those items render read-only with no way to ever edit them (no Link/Edit buttons, since `canLink`/`isConfigured` would be false). Accepted as correct behavior: an implementer who authors a Questionnaire referencing linked-record items without configuring a provider has made an authoring error, not something the runtime needs to guard against beyond rendering consistently disabled.
