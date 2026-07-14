## 1. Questionnaire configuration and parsing

- [x] 1.1 Add `questionnaireUrl` and `questionnaireLocal` options to `initialiseEditor()` (`src/script/pedigree.ts`)
- [x] 1.2 When `questionnaireUrl` is given, `fetch()` it at construction time; on success store the parsed `Questionnaire`, on failure/invalid resource log a warning and continue with no Custom tab
- [x] 1.3 When `questionnaireLocal` is given, use it synchronously with no network call
- [x] 1.4 Create `src/script/questionnaire/questionnaireParser.ts`: walk `Questionnaire.item[]` recursively, flatten `group` items into a `heading` pseudo-field followed by children, and produce a flat list of `NodeMenu`-compatible field descriptors (`name`, `label`, `type`, `tab: 'Custom'`, `function`, plus item metadata needed for D4/D6)
- [x] 1.5 Map supported item types to field descriptor `type` per the D3 table (`string`/`text` → `text`/`textarea`, `boolean` → `checkbox`, `date` → `date-picker`, `integer`/`decimal` → `number`, `choice`/`open-choice` with `answerValueSet` → `questionnaire-choice-picker`, `choice` with `answerOption` only → `select`, `group` → `heading`)
- [x] 1.6 Skip and log a warning for unsupported item types without failing the rest of the parse
- [x] 1.7 Expose the parsed config via `editor.getQuestionnaireConfig()` (parsed items + canonical Questionnaire URL/version + parsed mappings from task group 8), following the `getPatientProvider()`/`getFhirTerminologyHelper()` accessor pattern

## 2. New NodeMenu field types

- [x] 2.1 Add `number` to `NodeMenu._generateField` (numeric input, rejects non-numeric entry, `_getValue` parses to `Number`) and `NodeMenu._setFieldInactive` (reuse `_toggleFieldVisibility`) in `src/script/view/nodeMenu.ts` (also added `_setFieldValue`/`_setFieldDisabled` entries, required by `_setCrtData`'s unconditional dispatch across all four dicts)
- [x] 2.2 Add `heading` to `NodeMenu._generateField` (renders a label only, no input, no `_getValue`) and ensure it's excluded from value-collection/summary logic
- [x] 2.3 Add `questionnaire-choice-picker` to `NodeMenu._generateField`: a searchable input wired to a terminology instance's `searchForTerms()`, storing `{system?, code, display}` (or an array when the item `repeats`) via `_getValue`; add matching `_setFieldInactive` entry
- [x] 2.4 Add `NodeMenu.addFields(fields)`: appends field descriptors to the existing menu after construction and re-renders the Custom tab, for the `questionnaireUrl` async-resolve case (also added `_addTab()` for on-demand Custom tab creation, and extracted `_initializeSuggestPickers()` from the constructor so it can be re-run after `addFields`)

## 3. Terminology integration for answerValueSet

- [x] 3.1 For each `choice`/`open-choice` item with `answerValueSet`, call `PedigreeEditor._initialiseTerminology(item.linkId, syntheticOptions)` per D4, using a configured terminology base URL for questionnaire fields (new option, or fallback to an already-configured FHIR base URL when available)
- [x] 3.2 When no terminology base URL is available for an `answerValueSet` item, log a warning and fall back to `select`/free-text rendering instead of failing
- [x] 3.3 For `choice` items with inline `answerOption` (no `answerValueSet`), render via the existing `select` field type with literal option values, bypassing terminology entirely

## 4. Answer storage and setter dispatch (Person)

- [x] 4.1 Add `_questionnaireAnswers: { [linkId]: any }` to `Person` (`src/script/view/person.ts`), defaulted to `{}` in `_setDefault()`
- [x] 4.2 Add `getQuestionnaireAnswer(linkId)` / `setQuestionnaireAnswer(linkId, value)` on `Person`; `setQuestionnaireAnswer` updates the answer and triggers the same recompute/re-render hook other setters use (confirmed no explicit re-render call is needed - `controller.ts:handleSetProperty` already calls `editor.getNodeMenu().update()` unconditionally after every property set)
- [x] 4.3 In `Person`'s constructor/`_setDefault`, synthesize one bound instance-level setter per configured *unmapped and `mapsToCondition`/`mapsToObservation`-mapped* Questionnaire item — per D5 (own-instance property, not prototype). Skip this for `mapsToField`-mapped items. **Also synthesizes a matching `getQuestionnaireAnswer_<linkId>` getter** - required because `controller.ts`'s dispatch derives the getter name via `propertySetFunction.replace('set','get')` and calls it to capture the undo value
- [x] 4.4 Wire each Custom-tab field descriptor's `function` to its synthesized setter name when building the field list in task 1.4/1.7
- [x] 4.5 Include `questionnaireAnswers` in `Person.getProperties()` when non-empty, and restore it in `assignProperties()`/property-setting logic (mirroring how `unknownParent`/`linkedPatientRef` were added)
- [x] 4.6 Verify undo/redo works for a Custom-tab field edit (uses the existing `controller.ts` undo memo path unmodified — no controller.ts changes needed; confirmed by reading `handleSetProperty`'s get/set-pair-based undo memo mechanism, which now has the matching getter from 4.3)

## 5. enableWhen evaluation

- [x] 5.1 In `Person.getSummary()` (or equivalent), for each Custom-tab field with `enableWhen`, evaluate each condition against `this._questionnaireAnswers[condition.question]` using `condition.operator` (`=`, `!=`, `exists`, `>`, `<`, `>=`, `<=`) — implemented in `src/script/questionnaire/enableWhenEvaluator.ts`
- [x] 5.2 Combine multiple conditions per `item.enableBehavior` (`all` default, `any`) to compute the field's `inactive` flag
- [x] 5.3 Confirm visibility recomputes live when a referencing field's value changes (via the existing `NodeMenu.update()` → `getSummary()` refresh cycle), without needing to close/reopen the node menu

## 6. GA4GH FHIR export

- [x] 6.1 Add `GA4GHFHIRConverter.buildQuestionnaireResponse(ref, nodeProperties)` following the `addConditions`/`addObservations` pattern — one `QuestionnaireResponse` per node with non-empty answers, `subject` via the same reference convention, `questionnaire` set to the configured canonical URL(+version), `item[]` built from answered `linkId`s (for `mapsToField` items, source the answer from the mapped property's current value, per D9). Reads `editor.getQuestionnaireConfig()` directly rather than taking it as a parameter, matching the file's existing `editor.getFhirTerminologyHelper()`/`editor.getDisorderLegend()` convention
- [x] 6.2 Call `buildQuestionnaireResponse` (via new `addQuestionnaireResponse` wrapper matching the `addConditions`/`addObservations` calling convention) from `processTreeNode` alongside the existing condition/observation calls; skip nodes with no answers
- [x] 6.3 Add a `questionnaire-responses` `Composition.section` (code `questionnaire-responses`) in `exportAsFHIR`, mirroring `otherSection`'s construction, listing all generated `QuestionnaireResponse` resources; section is omitted entirely when no node has any answers

## 7. GA4GH FHIR import

- [x] 7.1 Add `GA4GHFHIRConverter.extractDataFromQuestionnaireResponse(qrResource, nodeDataLookup)`, resolving `subject` via the existing `resolveNodeRef` helper
- [x] 7.2 When `qr.questionnaire` matches the configured Questionnaire's canonical URL (+version), map `item[].answer` into the resolved node's `properties.questionnaireAnswers` keyed by `linkId` (for `mapsToField` items, the QR item is not additionally stored — D9's authority rule means it would never be read for rendering anyway, since the mapped property's own getter is authoritative)
- [x] 7.3 When it doesn't match (or no Questionnaire is configured), preserve the raw `item[].answer` on the node's `properties.questionnaireAnswers` unmodified and log a warning, without rendering on the Custom tab
- [x] 7.4 Skip (without throwing) any `QuestionnaireResponse` whose `subject` doesn't resolve to a known node
- [x] 7.5 Wire `extractDataFromQuestionnaireResponse` into `initFromFHIR`'s resource-processing loop alongside condition/observation extraction

## 8. Field mapping (mapsToField / mapsToCondition / mapsToObservation)

- [x] 8.1 Parse the `https://github.com/aehrc/open-pedigree/questionnaire-field-mapping` extension (a single `valueCode` naming the kind) on each item during questionnaire-parsing (task 1.4). For `mapsToField`, resolve the target from `item.definition`'s terminal fragment segment against `MAPS_TO_FIELD_TARGETS` (real `Patient.*` elements for 6 targets, a self-hosted `PedigreeIndividual.*` logical model for the other 4 — see D9). For `mapsToCondition`/`mapsToObservation`, read the code from `item.code` (wrapped `{coding: item.code}`) — see D10. On any invalid mapping (missing/unresolvable definition, missing code, mapping on a `group`), log a warning and treat the item as unmapped (D11)
- [x] 8.2 For `mapsToField` items: excluded from the Custom-tab field list entirely (no descriptor is generated at all, so no `function`/setter wiring is needed) - D9
- [x] 8.3 In `buildQuestionnaireResponse` (task 6.1), source a `mapsToField` item's answer from `nodeProperties[MAPS_TO_FIELD_TARGETS[field].propertyBagKey]` rather than from the stored answers map — `processTreeNode` only ever has the plain graph-model properties bag, not a live `Person` instance, so this reads the bag key directly (`fName`/`lName`/`dob`/etc.) rather than calling a getter method
- [x] 8.4 ~~Extend `addConditions`/`addObservations` to also iterate mapped items directly~~ — superseded by task 12.1: derivation now happens from the constructed `QuestionnaireResponse` instead, per D12
- [x] 8.5 Before generic disorder/phenotype extraction runs on import (`extractDataFromCondition`/`extractDataFromObservation`), check the resource's `.code` against configured `mapsToCondition`/`mapsToObservation` items via `codeableConceptMatches`/`findMappedQuestionnaireItem`; on a match, route the resource to populate that mapped item's answer and return early, skipping the generic extraction entirely (D10)
- [x] 8.6 Verified: `extractDataFromQuestionnaireResponse`'s `mapsToField` branch never writes to `nodeData.properties.questionnaireAnswers` for that linkId (task 7.2) — the Patient/Observation-derived property value (already populated by the existing, unmodified `extractDataFromPatient`/observation extraction) stays the only source of truth (D9's conflict rule)

## 12. Align export with SDC $extract's shape (D12) — post-completion refinement

- [x] 12.1 Remove the `mapsToCondition`/`mapsToObservation` scanning blocks from `addConditions`/`addObservations`; add `GA4GHFHIRConverter.deriveResourcesFromQuestionnaireResponse(qr, ref, condtions, observations)`, which walks an already-built `QuestionnaireResponse`'s `item[]`, resolves each `linkId` back to its config entry, and derives `Condition`/`Observation` resources for `mapsToCondition`/`mapsToObservation` items — mirroring how `extractDataFromQuestionnaireResponse` already derives properties from an incoming QR
- [x] 12.2 `addQuestionnaireResponse` now returns the built QR (previously void); `processTreeNode` calls it before `deriveResourcesFromQuestionnaireResponse`, after the existing `addConditions`/`addObservations` calls (which still handle the generic, non-mapping disorders/phenotypes/etc. path unchanged)
- [x] 12.3 Fix `answerToFhirValue`'s `choice`/`open-choice` branch to emit `valueCoding` (the only type `QuestionnaireResponse.item.answer.value[x]` permits), not `valueCodeableConcept` — a latent bug surfaced by 12.1, since export now reads answers back through the constructed QR via `fhirValueToAnswer` (previously only exercised on import)
- [x] 12.4 Add `answerToObservationValue` (choice → `valueCodeableConcept`, matching the existing generic phenotype/gene Observations and `Observation.value[x]`'s allowed types) for use when building the *derived Observation resource* specifically, since that value-shape differs from a QR answer's
- [x] 12.5 Update `MAPS_TO_FIELD_TARGETS` parser tests, the `current-forms-questionnaire.json` and SMART demo `questionnaire.json` fixtures, and `GA4GHFHIRConverter.questionnaire.test.js`'s mapping tests to the new extension/`item.definition`/`item.code` shape and the build-QR-then-derive call pattern

## 9. Unit tests (Vitest)

- [x] 9.1 `questionnaireParser`: item-type mapping, group flattening, unsupported-type skip-with-warning, mapping-extension parsing and validation (task 8.1) — `tests/unit/questionnaire/questionnaireParser.test.js`
- [x] 9.2 `enableWhen` evaluator: single condition, `all`/`any` combination, each operator — `tests/unit/questionnaire/enableWhenEvaluator.test.js`
- [x] 9.3 `Person` answer storage: get/set, `getProperties()`/`assignProperties()` round-trip, synthesized setter dispatch — `tests/unit/view/person.questionnaire.test.js`. Constructs a real `Person` instance (not a mock) via a Proxy-based "chain stub" standing in for `editor`/Raphael, so any `editor.getPaper().rect(...).attr(...).clone()...` call chain (whatever exact methods `Person`/`PersonVisuals`/`PersonHoverbox` happen to call) silently no-ops instead of requiring a real browser canvas; the stub is coercible to `0` via `valueOf`/`Symbol.toPrimitive` so bounding-box arithmetic in hoverbox button layout doesn't throw. Uses a new reference fixture, `tests/unit/fixtures/current-forms-questionnaire.json` (all 10 `mapsToField`-eligible items, mirroring the current Personal/Clinical tab fields), combined with a `mapsToCondition` item and a plain unmapped item, to exercise every branch of `_synthesizeQuestionnaireSetters()` in one harness
- [x] 9.4 `GA4GHFHIRConverter.buildQuestionnaireResponse`: node with answers produces one QR with correct `subject`/`questionnaire`/`item[]`; node with no answers produces none; `mapsToField` item sources its answer from the mapped property — `tests/unit/model/GA4GHFHIRConverter.questionnaire.test.js`
- [x] 9.5 `GA4GHFHIRConverter.extractDataFromQuestionnaireResponse`: matching-Questionnaire import populates answers; non-matching/unconfigured preserves raw + warns; unresolvable subject is skipped — same file
- [x] 9.6 Field mapping: `mapsToCondition` boolean item true/false export; `mapsToObservation` item export; mapped-code exclusion from generic disorders/phenotypes on import; `mapsToField` authority-over-QR on import — same file
- [x] 9.7 Full export → import round-trip test: answers (including mapped items) on a multi-node pedigree survive a GA4GH export/import cycle unchanged — same file (all unit tests pass, no regressions; 109 total as of the D12 refactor, up from the original 95 as `person.questionnaire.test.js` and further mapping tests were added)

## 10. Playwright E2E tests

- [x] 10.1 Editor initialised with `questionnaireLocal` shows the Custom tab with expected fields on node menu open — `tests/e2e/questionnaire-fields.spec.js`
- [x] 10.2 Editing a Custom-tab field persists across save/reload (internal JSON)
- [x] 10.3 `enableWhen`-gated field toggles visibility live as its referenced field's value changes
- [x] 10.4 `answerValueSet` choice field search issues the expected FHIR `$expand` request (stubbed) and selecting a result stores the coding
- [x] 10.5 GA4GH FHIR export download contains the expected `QuestionnaireResponse` section for a pedigree with answered nodes
- [x] 10.6 A `mapsToField`-mapped item does not appear on the Custom tab (e2e). Export-reflection of the mapped property's value into the QuestionnaireResponse is covered at the unit level instead (`GA4GHFHIRConverter.questionnaire.test.js`, "sources a mapsToField item from the property bag key") rather than duplicated as an e2e download-content assertion

## 11. Documentation

- [x] 11.1 Document `questionnaireUrl`/`questionnaireLocal` options and the supported SDC item-type subset in `README.md`
- [x] 11.2 Document the field-mapping extension (`mapsToField`/`mapsToCondition`/`mapsToObservation`), its dual-write behaviour, and the mapped-location-is-authoritative rule
- [x] 11.3 Note the per-node-only scope (no relationship-level questionnaire fields), the `enableWhen`-within-same-Questionnaire-only constraint, and the mapped-code-collision sharp edge (D10's risk) as known limitations
