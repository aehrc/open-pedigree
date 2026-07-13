## Context

The node editor panel (`NodeMenu`, `src/script/view/nodeMenu.ts`) is driven by a flat, statically-built array of field descriptors (`{name, label, type, tab, function, ...}`), assembled once in `PedigreeEditor.generateNodeMenu()` (`src/script/pedigree.ts`) at construction time. Each descriptor's `type` looks up a renderer in `NodeMenu._generateField[type]` and a visibility toggler in `NodeMenu._setFieldInactive[type]`; each descriptor's `function` must be the literal name of a setter method that exists on the target `Person` node — `nodeMenu.ts` packages `{[method]: value}` into a `pedigree:node:setproperty` DOM event, and `controller.ts` (`handleSetProperty`) is what actually invokes `node[method](value)`, records the old value for undo, and triggers re-render. This event-based indirection (rather than direct callbacks) is how undo/redo and re-render get hooked up for every existing field, so it needs to keep working for questionnaire-driven fields too.

Per-field visibility (`inactive`) is computed fresh every time the menu opens or updates, inside `Person.getSummary()` (referred to in the proposal; the actual method returns a `{fieldName: {value, inactive}}` map consumed by `NodeMenu.update()`/`_setCrtData()`). This is the natural hook for `enableWhen` evaluation.

The terminology subsystem (`src/script/terminology/`) already supports building a terminology instance for an arbitrary `termType` string via `PedigreeEditor._initialiseTerminology(termType, options)` — it is not hardcoded to `disorder`/`phenotype`/`gene`; those are just the three call sites that exist today. Every terminology implementation exposes `searchForTerms(searchTerm, onSuccess, onError, onComplete)` directly (on `AbstractTerminology`), independent of the `AbstractTerm`/`DisorderTerm`/`PhenotypeTerm` wrapper classes, which exist only to support the disorder/phenotype legend's colour-swatch/id-cache behaviour and are not needed here.

`GA4GHFHIRConverter.ts` already has a proven, repeated pattern for node-scoped FHIR resources: `Condition` and `Observation` are built one-per-node-per-item, `subject` references the node's Patient, pushed to `containedResources`, and listed under a `Composition.section`. `resolveNodeRef()` (backported to `develop` this session) resolves a `subject` reference in either `#id` or `Patient/{id}` form back to the internal node lookup on import.

## Goals / Non-Goals

**Goals:**
- Let an implementer declare extra per-node fields via a standard FHIR `Questionnaire`, rendered in a new "Custom" node-menu tab, without editing editor source.
- Support the item types needed for realistic clinical/research forms: `string`, `text`, `boolean`, `date`, `integer`, `decimal`, `choice`/`open-choice` (terminology-backed), and `group` for visual organisation.
- Support `enableWhen` (including `enableBehavior: any/all` for multi-condition items) so fields can be conditionally shown.
- Round-trip answers through GA4GH FHIR export/import as a contained `QuestionnaireResponse`, using the same node-linkage convention as `Condition`/`Observation`.
- Preserve full undo/redo and existing save/load behaviour for questionnaire answers, matching every other node property.
- Let an item optionally map onto an *existing* FHIR representation (a converter-aware scalar property, or a coded `Condition`/`Observation`) instead of being visible only inside a `QuestionnaireResponse`, so generic FHIR consumers see the fact in its normal place.

**Non-Goals:**
- `enableWhen` referencing built-in hardcoded pedigree fields (e.g. gender, disorders) — v1 only evaluates `enableWhen` against other items *within the same configured Questionnaire*. This matches standard SDC semantics (`enableWhen.question` is a sibling item `linkId`) and avoids inventing a non-standard extension. If an implementer needs a field gated on gender, they mirror it as a Questionnaire item populated by a future bridging mechanism — out of scope now.
- `enableWhenExpression` (FHIRPath) — not implemented; only literal `enableWhen.answer[x]` comparisons.
- Repeating groups / repeating items (`item.repeats` producing multiple answer instances of a group) — v1 supports `repeats` only on `choice`/`open-choice` (multi-select), not on groups.
- Per-relationship (partnership/childhub) questionnaire fields — proposal explicitly scoped this to per-node (Patient) only; relationships have no analogous FHIR resource to hang a QuestionnaireResponse off today.
- Editing/authoring Questionnaires in the editor UI — the Questionnaire is supplied by the implementer, read-only from the editor's perspective.
- PED/BOADICEA/GEDCOM/DADA2 round-trip — no extension point in those formats; answers simply aren't carried.
- Field mapping to hardcoded *array-valued* properties (`disorders`, `hpoTerms`, `candidateGenes`) — `mapsToField` only covers scalar properties with a single existing setter/getter pair (see D9); adding a disorder/phenotype via a mapped item isn't supported (an implementer wanting that uses the existing Disorders/Clinical tab, or a `mapsToCondition`/`mapsToObservation` item for a single specific fact).
- Conflict resolution between a mapped FHIR location and its dual-written `QuestionnaireResponse` record when they disagree (e.g. edited independently by a non-Questionnaire-aware system) — the mapped location always wins on import; the QR record is provenance-only and is never used to override it (see D9/D10).

## Decisions

### D1 — Questionnaire is resolved before the node menu needs it, not lazily mid-session

`initialiseEditor()` remains synchronous and returns the editor immediately, matching current behavior. Two config options:
- `questionnaireLocal: <Questionnaire resource>` — used synchronously, zero latency, available before `generateNodeMenu()` runs.
- `questionnaireUrl: <string>` — the editor issues a `fetch()` at construction time and calls `NodeMenu.addFields(customFields)` (new method) when it resolves, appending the "Custom" tab's fields to the already-constructed menu.

*Trade-off accepted:* if a user opens the node menu before the `questionnaireUrl` fetch resolves, the Custom tab is briefly absent (it appears next time the menu opens or updates). Implementers who need zero-latency correctness use `questionnaireLocal` (pre-fetch it themselves — `smartEditor.ts` already does comparable async orchestration before calling `initialiseEditor()`).

*Alternative considered:* making `initialiseEditor()` return a `Promise<PedigreeEditor>` when `questionnaireUrl` is given. Rejected — changes the return contract conditionally on options, which is worse than a short-lived UI gap, and breaks every existing caller's synchronous usage.

### D2 — Questionnaire items are parsed into a flat internal field-descriptor list; groups become non-interactive heading pseudo-fields

A new parser (`src/script/questionnaire/questionnaireParser.ts` or similar) walks `Questionnaire.item[]` recursively and produces a flat list of `NodeMenu`-compatible field descriptors, all tagged `'tab': 'Custom'`, preserving document order. A `group` item contributes one non-interactive `type: 'heading'` pseudo-field (new minimal `NodeMenu` field type — renders a label, no input, no `_getValue`, never included in `getProperties()`/summary) followed immediately by its children's descriptors. Nesting depth beyond one level is flattened (no indentation/collapsing) — acceptable for the SDC subset in scope.

*Alternative considered:* native nested/collapsible group rendering. Rejected as unnecessary complexity for v1; `NodeMenu`'s field list is flat by design and no other field type nests today.

### D3 — Item-type → NodeMenu field-type mapping

| Questionnaire `item.type` | NodeMenu field type | Notes |
|---|---|---|
| `string`, `text` | `text` (existing) / `textarea` (existing, for `text`) | reused as-is |
| `boolean` | `checkbox` (existing) | reused as-is |
| `date` | `date-picker` (existing) | reused as-is |
| `integer`, `decimal` | `number` (**new**) | thin wrapper around `text` with numeric input mode + parse-on-read in `_getValue` |
| `choice`, `open-choice` (has `answerValueSet`) | `questionnaire-choice-picker` (**new**) | terminology-backed, see D4 |
| `choice` (has inline `answerOption`, no `answerValueSet`) | `select` (existing) | static option list, no terminology needed |
| `group` | `heading` (**new**, non-interactive) | see D2 |

Two new `NodeMenu._generateField` / `_setFieldInactive` entries are added (`number`, `questionnaire-choice-picker`), following the exact shape of existing entries (`_toggleFieldVisibility` for the inactive-toggle side). `heading` needs a `_generateField` entry (renders a label, returns a container with no `_getValue`) but is excluded from the summary/value-collection path.

### D4 — `answerValueSet` reuses the terminology subsystem via a synthetic per-item terminology instance

For each `choice`/`open-choice` item with `answerValueSet`, at Questionnaire-parse time the editor calls `this._initialiseTerminology(item.linkId, syntheticOptions)` where `syntheticOptions = { [item.linkId + 'Options']: { type: 'FHIR', fhirBaseUrl: <configured questionnaire terminology base URL>, valueSet: item.answerValueSet, codeSystem: undefined } }` — reusing the exact factory already used for `disorderOptions`/`phenotypeOptions`/`geneOptions`, just keyed by the item's `linkId` instead of a fixed type string. `codeSystem` is left unset because the picker only ever calls `searchForTerms()` (backed by `ValueSet/$expand`, which needs no `codeSystem`) — it never needs `lookupTerm()`/`$lookup`, because a `choice` answer stores the full `{system, code, display}` triple returned by search directly on the node (see D5), unlike disorders/phenotypes which store only an id and resolve display text later via lookup for the legend.

A new `questionnaireTerminologyOptions` (or reuse of an existing FHIR base URL, e.g. the SMART client's `serverUrl`, when available) provides `fhirBaseUrl`; if absent and an item declares `answerValueSet`, that item logs a console warning and falls back to a plain `select`/free-text `text` rendering (degrades rather than crashes).

*Alternative considered:* a fully separate terminology client for questionnaire fields. Rejected — `_initialiseTerminology` is already generic over `termType`; introducing a parallel mechanism would duplicate `CTSS`/`FHIR`/`Bioportal`/`Delegating`/`Static`/`Empty` backend support for no benefit.

### D5 — Answer storage and setter dispatch

Each node gets a `_questionnaireAnswers: { [linkId]: answerValue }` property (mirrors the `unknownParent`/`linkedPatientRef` precedent — plain object on `Person`, included in `getProperties()`/`assignProperties()` when non-empty). `answerValue` shape depends on item type: primitive (string/boolean/number/ISO date string) for simple types; `{system?, code, display}` (or an array of these when `item.repeats`) for `choice`/`open-choice`.

To satisfy `NodeMenu`'s requirement that a field descriptor's `function` be a real method name on the target node (so `controller.ts`'s existing `node[method](value)` dispatch, undo recording, and re-render all keep working unmodified), each `Person` instance gets one bound setter **as an own instance property** (not on the prototype) per configured Questionnaire item, created in `Person._setDefault()`/constructor from the shared Questionnaire config the editor holds (analogous to how the node already reads `editor.getPatientProvider()`/`editor.getFhirTerminologyHelper()`):

```ts
for (const item of editor.getQuestionnaireConfig().items) {
  (this as any)['setQuestionnaireAnswer_' + item.linkId] = ((linkId: string) => (value: any) => {
    this.setQuestionnaireAnswer(linkId, value);
  })(item.linkId);
}
```

`setQuestionnaireAnswer(linkId, value)` mutates `_questionnaireAnswers[linkId]` and calls `this.getGraphics().updateSummary()`-equivalent (whatever the existing "recompute + re-render" hook is for other setters). The corresponding field descriptor's `function` is set to the synthesized name (`'setQuestionnaireAnswer_' + item.linkId`) when building the Custom-tab field list in D2.

*Alternative considered:* modifying `nodeMenu.ts`'s dispatch to accept a bound function reference instead of a string method name (avoids per-instance method synthesis). Rejected — the actual `node[method](value)` invocation, undo/redo snapshotting, and event routing happen in `controller.ts:handleSetProperty`, not in `nodeMenu.ts`; switching to raw function references would require `properties` (a plain serialisable object dispatched as a `CustomEvent` detail) to carry function values, which breaks the existing undo/redo memo pattern (`undoEvent.memo.properties[...] = oldValue`) that assumes string-keyed setter names throughout. Per-instance synthesized methods keep every downstream consumer unchanged.

*Alternative considered:* prototype-level synthesis (`Person.prototype['setQuestionnaireAnswer_' + linkId] = ...`). Rejected — mutates a shared prototype based on runtime configuration, which is fragile if multiple editor instances with different Questionnaires ever coexist on one page (e.g. two iframes) and leaves stale methods behind after reconfiguration. Instance-level synthesis is marginally more per-node setup cost, which is negligible.

### D6 — `enableWhen` evaluation

Computed inside `Person.getSummary()` (or wherever the existing `inactive: this.isProband()`-style logic lives) for every Custom-tab field: for each `item.enableWhen` entry, look up `this._questionnaireAnswers[condition.question]`, compare against `condition.answer[x]` using `condition.operator` (`=`, `!=`, `exists`, and the ordering operators `>`, `<`, `>=`, `<=` for `integer`/`decimal`/`date` answers), then combine multiple conditions per `item.enableBehavior` (`all` default, or `any`). Result feeds the same `inactive` flag every other field already uses — no changes needed to `NodeMenu`'s visibility-toggling mechanism itself, only to what populates `inactive` for Custom-tab fields.

### D7 — GA4GH FHIR export: `buildQuestionnaireResponse()`

New function in `GA4GHFHIRConverter.ts`, called from `processTreeNode` alongside the existing `addConditions`/`addObservations` calls, for any node with a non-empty `_questionnaireAnswers`:

```ts
{
  resourceType: 'QuestionnaireResponse',
  id: <generated>,
  status: 'completed',
  questionnaire: <configured Questionnaire canonical url>|<version>,
  subject: { reference: <node's Patient reference, via getReference()/patRefAsRef() same as Condition/Observation> },
  item: [ { linkId, answer: [ { value[x]: ... } ] }, ... ]  // one entry per answered linkId
}
```
Pushed into `containedResources`; referenced from a new `Composition.section` (`code: 'questionnaire-responses'`), mirroring `otherSection`'s structure exactly.

### D8 — GA4GH FHIR import: `extractDataFromQuestionnaireResponse()`

New function, called alongside `extractDataFromCondition`/`extractDataFromObservation` in `initFromFHIR`. Resolves `subject` via `this.resolveNodeRef(qr.subject.reference, nodeDataLookup)`. If `qr.questionnaire` matches the currently configured Questionnaire's canonical URL (+ version, if present), maps `item[].answer` back into `node.properties.questionnaireAnswers` keyed by `linkId`, ready for the Custom tab to render. If it doesn't match (or no Questionnaire is configured on this editor instance at all), the raw `item[]` array is preserved verbatim on the node under `properties.questionnaireAnswers` (not validated/typed against any schema) so a subsequent export doesn't silently drop it, but the Custom tab does not attempt to render it until a matching Questionnaire is configured — logged as a console warning, not a user-facing error (this is expected in multi-deployment scenarios where a pedigree created under one Questionnaire version is opened under another).

### D9 — Field mapping, kind 1: `mapsToField` aliases an existing scalar property, target given via `item.definition`

An item can carry the `https://github.com/aehrc/open-pedigree/questionnaire-field-mapping` extension with `valueCode: 'mapsToField'`. The *target* property comes from the item's own `item.definition` (a core `Questionnaire.item` field, not SDC-specific — see [hl7.org/fhir/R4/questionnaire-definitions.html#Questionnaire.item.definition](https://hl7.org/fhir/R4/questionnaire-definitions.html#Questionnaire.item.definition)), using the standard `<canonical-url>#<ElementDefinition-id>` fragment syntax, e.g. `http://hl7.org/fhir/StructureDefinition/Patient#Patient.gender`. The parser matches on the *terminal* (last `.`) segment of the fragment against `MAPS_TO_FIELD_TARGETS`, so it doesn't matter whether the base canonical URL is the real Patient SD or our own `PedigreeIndividual` logical model (see below) — only the element name matters.

Six targets are genuine Patient elements and use the real `http://hl7.org/fhir/StructureDefinition/Patient` canonical: `gender`, `given` (first name), `family` (last name), `identifier` (external ID), `birthDate`, `deceasedDateTime` (death date). Four don't correspond to any single real Patient element — `lifeStatus` (drives several Patient fields/extensions at once), `gestationAge`, `carrierStatus`, and `comments` (all become fixed-code Observations, not Patient elements, in the existing unrelated export code) — these use a self-hosted `https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual` canonical instead. The spec explicitly permits `item.definition` to point at a non-published logical model, so this isn't a misuse — it's honest about which targets are real FHIR elements and which are this library's own model. `MAPS_TO_FIELD_DEFINITIONS` in `questionnaireParser.ts` gives the exact reference value for each target.

For a mapped item:

- **Setter dispatch**: no synthesized `setQuestionnaireAnswer_<linkId>` (D5) is created — no new Person state is introduced, the item just writes straight through to the property that's already there via the existing setter, when edited on its normal tab.
- **Rendering**: the item is **excluded** from the Custom tab entirely. The editor already shows this field on its normal tab (Personal/Clinical); rendering it a second time under Custom would just duplicate the same input. `mapsToField` is an export/import bridge, not a UI relocation mechanism (relocating/relabeling existing tabs' fields is out of scope — see Non-Goals).
- **Export**: no new code for the mapped property's own FHIR representation — `buildPedigreeIndividual`/`addObservations` already serialise `properties.gender`/`properties.carrierStatus`/etc. into `Patient.gender`/the fixed-code carrier `Observation`/etc. today. `buildQuestionnaireResponse` additionally reads the *current value* of the mapped property (via `MAPS_TO_FIELD_TARGETS[field].propertyBagKey` against the plain properties bag — `processTreeNode` never has a live `Person` instance, only the graph model's properties bag) to populate that `linkId`'s answer in the dual-written `QuestionnaireResponse`.
- **Import**: no new code — `extractDataFromPatient` etc. already populate `properties.gender`/etc. from the Patient resource today, unchanged. `extractDataFromQuestionnaireResponse` does not additionally record this `linkId` in `properties.questionnaireAnswers` — the mapped property is the only source of truth, per the dual-write rule (D9 conflict rule), and nothing ever reads `questionnaireAnswers` for a `mapsToField` linkId anyway (Custom-tab rendering excludes it).

*Alternative considered:* rendering the mapped item on the Custom tab too, pre-populated from the existing property, letting implementers reposition/relabel a field via the Questionnaire. Rejected for v1 — it raises "what if the label/tab differs from the original, do we hide the original?" questions that expand scope well beyond field mapping's core purpose (FHIR interoperability, not UI reorganisation). Revisit only if a concrete implementer need shows up.

*Alternative considered:* a custom sub-extension carrying the target property name as a plain string (the original v1 design). Rejected on reflection — `item.definition` is the standard FHIR field for "this item corresponds to this specific element," used by real SDC "definition-based extraction" for exactly this purpose; reinventing it with a bespoke extension needlessly reduces portability to other SDC-aware tooling for no benefit.

### D10 — Field mapping, kind 2: `mapsToCondition` / `mapsToObservation`, code given via `item.code`

An item can instead carry the mapping extension with `valueCode: 'mapsToCondition'` or `'mapsToObservation'`, for a fact with **no existing hardcoded home** — e.g. a "Diabetes status" `boolean` item, or a "Smoking status" `choice` item. The *code* to stamp on the generated resource comes from the item's own `item.code` (a core `Questionnaire.item` field, `0..*` `Coding` — see [hl7.org/fhir/R4/questionnaire-definitions.html#Questionnaire.item.code](https://hl7.org/fhir/R4/questionnaire-definitions.html#Questionnaire.item.code)), which the parser wraps as `{ coding: item.code }` (already a valid `CodeableConcept` shape, since `item.code` is itself an array of `Coding`) rather than requiring a custom nested `valueCodeableConcept` extension. This is also the mechanism SDC's own "Observation-based extraction" uses for the code, rather than a custom extension. Unlike D9, these items **do** render on the Custom tab as normal (using the synthesized setter/storage from D5) — there's no other UI for them.

- **Export**: see D12 — resources are derived from the already-built `QuestionnaireResponse`, not from a separate scan of `nodeProperties`.
- **Import — double-counting guard**: `extractDataFromCondition`/`extractDataFromObservation` currently add *every* `Condition`/`Observation` they see into `properties.disorders`/`properties.hpoTerms`/`candidateGenes` unconditionally. Before that generic extraction runs, the importer checks the resource's `.code` against configured `mapsToCondition`/`mapsToObservation` items' codes (`codeableConceptMatches`/`findMappedQuestionnaireItem`); a match routes the resource to populate that mapped item's answer instead, skipping generic extraction, so the fact isn't double-counted into both places.
- Same dual-write authority rule as D9: the mapped `Condition`/`Observation` is authoritative on import; the QR item is provenance-only.

*Alternative considered:* letting `mapsToCondition`/`mapsToObservation` items also merge into `properties.disorders`/`hpoTerms` (so they show up in the Disorders/Clinical tab's legend too, in addition to the Custom tab). Rejected — doubles up the UI (same fact shown twice, in two different widgets) for no clear benefit; if an implementer wants a mapped item to *also* behave like a first-class disorder/phenotype (with legend colour, etc.), they should just use the existing Disorders/Clinical tab directly instead of a Questionnaire item.

### D11 — Mapping extension shape and validation

The mapping extension itself is now minimal — a single `valueCode` naming the kind (`mapsToField` / `mapsToCondition` / `mapsToObservation`), with the actual target/code carried by the standard `item.definition`/`item.code` fields (D9/D10) rather than nested custom sub-extensions. It's read once at Questionnaire-parse time (alongside D2's parsing) and validated defensively: a `mapsToField` whose `item.definition` doesn't resolve to a supported target (missing, malformed, or an unrecognised terminal segment), a `mapsToCondition`/`mapsToObservation` with no `item.code`, or any mapping on a `group`/unsupported item type, is treated as *no mapping* (the item still renders as a normal Custom-tab field, dual-write is simply skipped) with a logged warning — mapping misconfiguration degrades to "just capture it generically," never a hard failure.

### D12 — Export is structured as build-QuestionnaireResponse-then-derive, matching SDC `$extract`'s shape

Prompted by evaluating FHIR SDC's `QuestionnaireResponse/$extract` operation ([build.fhir.org/ig/HL7/sdc/en/OperationDefinition-QuestionnaireResponse-extract.html](https://build.fhir.org/ig/HL7/sdc/en/OperationDefinition-QuestionnaireResponse-extract.html)): its actual contract (both `questionnaire-response` and `questionnaire` input parameters are `0..1`; return is a single resource or Bundle) is not restricted to server-side execution — a client-side implementation of the same input/output shape is legitimate SDC-compatible extraction, it just isn't exposed as an HTTP operation. We don't adopt the operation itself (no guaranteed FHIR server exists at export time — e.g. the local storage backend — and even under SMART we can't assume the launching server supports `$extract`/StructureMap execution), but we do structure our own export to match the shape: `processTreeNode` now calls `addQuestionnaireResponse` to build the `QuestionnaireResponse` *first*, then `deriveResourcesFromQuestionnaireResponse` walks *that resource's* `item[]` (resolving each `linkId` back to its config entry to check `.mapping`) to derive `mapsToCondition`/`mapsToObservation` resources — instead of the original design's separate re-scan of `nodeProperties.questionnaireAnswers` inside `addConditions`/`addObservations`.

This mirrors `extractDataFromQuestionnaireResponse` on the import side, which already derives properties by walking an *incoming* `QuestionnaireResponse`'s `item[]` — export and import now share the same "given a QuestionnaireResponse, derive other resources from its items" shape, just running in opposite directions. It also collapses what was two separate mapping-check passes (one inside `buildQuestionnaireResponse`, one inside `addConditions`/`addObservations`) into one.

**Value-shape correction surfaced by this refactor:** `QuestionnaireResponse.item.answer.value[x]` only permits `Coding` for a choice answer, not `CodeableConcept` ([hl7.org/fhir/R4/questionnaireresponse-definitions.html#QuestionnaireResponse.item.answer.value_x_](https://hl7.org/fhir/R4/questionnaireresponse-definitions.html#QuestionnaireResponse.item.answer.value_x_)) — `answerToFhirValue`'s original choice branch produced an invalid `valueCodeableConcept`. This only became externally observable once export started reading answers back *through* the constructed QR (via `fhirValueToAnswer`, previously only exercised on import) rather than straight from `nodeProperties`. Fixed by emitting `valueCoding` from `answerToFhirValue` (QR-answer-valid), and adding a sibling `answerToObservationValue` (used only when building the *derived Observation resource's* `value[x]`, which does allow `CodeableConcept` and matches the existing generic phenotype/gene Observations already in `addObservations`).

## Risks / Trade-offs

- **[Risk]** A `questionnaireUrl` fetch failure (network error, malformed resource) leaves the editor without a Custom tab entirely. → **Mitigation:** catch and log; editor continues to function normally with all other tabs, consistent with `EmptyPatientProvider`/`EmptyTerminology`'s "missing config degrades silently" precedent elsewhere in the codebase.
- **[Risk]** Per-instance setter synthesis on every `Person` construction adds a small amount of work proportional to configured item count. → **Mitigation:** negligible in practice (typical Questionnaires have tens of items, not thousands); no measurable impact expected, not benchmarked further for v1.
- **[Risk]** Questionnaire version drift between when a pedigree was saved and when it's reopened (item added/removed/retyped) could produce answers that no longer match the current item list. → **Mitigation:** D8's mismatch handling (preserve raw, don't render) covers the "different Questionnaire entirely" case; same-URL-different-version drift within the *matching* branch is explicitly not handled in v1 — a changed item type/removed linkId simply won't render even though the answer is preserved in `_questionnaireAnswers`. Acceptable for v1; flagged as a follow-up if it proves painful in practice.
- **[Trade-off]** Choosing per-node-only scope (not per-relationship) means data like "consanguinity questionnaire" (naturally about a partnership, not a person) doesn't fit this mechanism. Matches the proposal's explicit scope; a future change would need a `Partnership`-resource-equivalent linkage pattern, which doesn't exist in the current GA4GH exporter (partnerships aren't exported as their own resource today).
- **[Risk]** Dual-write (D9/D10) means every mapped answer exists in two places (the mapped FHIR location and the QR item); a naive reader of the exported bundle could double-count a mapped `mapsToCondition` fact if it doesn't know to cross-reference the `QuestionnaireResponse` section against `Condition`s it's already processing. → **Mitigation:** this is inherent to choosing "provenance record + authoritative location" over "one or the other" — accepted because it's the same shape FHIR SDC extraction implementations already use (QR retained alongside extracted resources), and because a consumer that only understands GA4GH pedigree Conditions (not QuestionnaireResponse) will correctly see the fact exactly once, in the normal place.
- **[Risk]** `mapsToCondition`/`mapsToObservation` code collisions with codes an implementer's disorder/phenotype terminology could independently produce (e.g. a mapped item happens to use the same SNOMED code a clinician separately selects from the Disorders tab) would cause the generic-extraction exclusion in D10 to swallow a legitimately-separate disorder entry on import. → **Mitigation:** narrow enough to accept for v1 — implementers are expected to choose mapping codes that are semantically exclusive to the mapped item (e.g. a study-specific observation code), not codes that overlap with open-ended disorder/phenotype vocabularies; flagged as a known sharp edge in task/doc work, not solved architecturally.
