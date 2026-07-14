## Context

`questionnaire-fields` (archived) made the Questionnaire additive: `PedigreeEditor.generateNodeMenu()` (`src/script/pedigree.ts`) is a static 21-entry field-descriptor array (`identifier`, `gender`, `first_name`, `last_name`, `link_patient`, `external_id`, `carrier`, `evaluated`, `disorders`, `import_from_record`, `candidate_genes`, `hpo_positive`, `date_of_birth`, `date_of_death`, `state`, `gestation_age`, `childlessSelect`, `adopted`, `monozygotic`, `nocontact`, `placeholder`, `comments`), and the Questionnaire only ever appends a separate `'Custom'` tab (`.concat(this._buildQuestionnaireFieldDescriptors())`, tabs array conditionally including `'Custom'`).

Verified directly in the current code (not assumed) — the visibility/availability logic for these fields, in `Person.getSummary()` (`src/script/view/person.ts:905-1001`), is considerably richer than plain FHIR `enableWhen`:

| Field | Rule | Mechanism |
|---|---|---|
| `gender` | disable specific radio *values* | `inactive: inactiveGenders` (array of disabled values), from `editor.getGraph().getPossibleGenders(id)` |
| `state` (life status) | disable specific radio *values* | `inactive: inactiveStates` (array), from `editor.getGraph().hasRelationships(id)` |
| `carrier` | disable specific radio *values* | `disabled: inactiveCarriers` (array — note: `disabled`, not `inactive`), from current disorders + life status |
| `date_of_birth`/`date_of_death` | hide whole item | `inactive: this.isFetus()` |
| `adopted` | hide whole item | `inactive: cantChangeAdopted` = `isFetus() || hasToBeAdopted(id)` |
| `childlessSelect` | hide whole item | `inactive: this.isFetus()` |
| `monozygotic` | hide *and separately* grey-out | `inactive` (not a twin) vs `disabled` (twins exist but genders differ) — the only field using both, from `getAllTwinsSortedByOrder(id)` |
| `nocontact` | hide whole item | `inactive: isProband() \|\| !isRelatedToProband(id)` |
| `link_patient` | hide whole item | `inactive: !patientProvider.canLinkPatient(id)` |
| `import_from_record` | hide whole item | `inactive: !(patientProvider.canImportClinicalData() && linkedPatientRef)` |
| `placeholder` | always hidden | `inactive: true` unconditionally (dead in the current live UI; carried over as-is, not solved here) |

None of `getPossibleGenders`/`hasRelationships`/`isFetus`/`hasToBeAdopted`/`getAllTwinsSortedByOrder`/`isRelatedToProband` (all on `DynamicPositionedGraph`, `src/script/model/dynamicGraph.ts`) or the `PatientProvider` capability checks have any FHIR `enableWhen` equivalent — they depend on pedigree graph structure or app-level capability, not on other Questionnaire item answers. `enableWhen` per spec ([hl7.org/fhir/R4/questionnaire-definitions.html](https://hl7.org/fhir/R4/questionnaire-definitions.html)) can only reference a sibling item's answer.

`disorders`/`hpo_positive`/`candidate_genes` use `disease-picker`/`hpo-picker`/`gene-picker` NodeMenu field types, each backed by a dedicated `DisorderLegend`/`PhenotypeLegend`/`GeneLegend` (`src/script/view/disorderLegend.ts` etc., all extending `Legend` in `src/script/view/legend.ts`). `Legend` is an editor-level singleton (one per editor instance, not per-node) tracking `_affectedNodes` (term ID → list of node IDs) and `_objectColors` (term ID → CSS colour, assigned via `Raphael.getColor()` the first time a term is seen) across the *whole pedigree*, rendering its own floating UI box with hover-to-highlight-affected-nodes-on-canvas behaviour. `Person.addDisorder`/`removeDisorder` (`person.ts:624-655`, and equivalently for phenotypes/genes) call `legend.addCase()`/`removeCase()` directly against the hardcoded `editor.getDisorderLegend()` etc. accessors. None of this has any FHIR representation - it's a bespoke view-layer concept.

`link_patient`/`import_from_record` are `type: 'button-action'` descriptors whose `action` closure calls `editor.getPatientProvider().openPatientPickerModal()`/`openClinicalImportModal()` directly - they don't set a property at all.

## Goals / Non-Goals

**Goals:**
- Every field currently in `generateNodeMenu()`'s static array, including tab identity, is expressible as a Questionnaire item, with zero behavioural regression (every cascade, undo interaction, and visibility rule above keeps working exactly as today).
- A built-in default Questionnaire, equivalent to today's static array, is used when no `questionnaireUrl`/`questionnaireLocal` is supplied - "Questionnaire is the source of truth" holds unconditionally.
- Tabs, field order, and labels come from the Questionnaire (`group` item structure), not hardcoded strings.
- Legend-backed repeating fields (disorders/phenotypes/genes) become Questionnaire items, reusing the generic `Legend` base class per-`linkId` rather than three hardcoded subclasses.
- A closed, named vocabulary of graph/app-state predicates makes every rule in the table above expressible from the Questionnaire, including per-option-value disabling and the `inactive`/`disabled` distinction - explicitly a non-standard extension to `enableWhen`, not drawn from the FHIR spec.
- Action items (`link_patient`/`import_from_record`) are expressible as Questionnaire items invoking one of a small, fixed set of built-in named actions.

**Non-Goals:**
- Arbitrary/unbounded predicates (e.g. a general expression language, FHIRPath, or letting an implementer define *new* predicates) - the predicate vocabulary is closed and fixed to exactly the cases above (see D16). Extending it later is possible but out of scope now.
- Arbitrary/unbounded actions - action items invoke one of the built-in named actions (`linkPatient`, `importClinicalData` today), not arbitrary app code (see D17).
- Changing the GA4GH FHIR export/import shape, the `mapsToField`/`mapsToCondition`/`mapsToObservation` extension vocabulary, or the `$extract`-shaped derivation (`buildQuestionnaireResponse`/`deriveResourcesFromQuestionnaireResponse`) - unchanged from `questionnaire-fields`.
- An implicit merge between a built-in default and an implementer-supplied Questionnaire (see D14) - the supplied Questionnaire fully replaces the default; the default is exported as a reusable starting template instead.
- Making `disorders`' "affected" virtual-disorder auto-removal rule (`person.ts:636-639` - adding a second real disorder auto-removes a placeholder "affected" entry) generic - this is disorders-specific business logic, carried over as-is for the `mapsToLegendCondition`-mapped disorders item specifically, not generalised to arbitrary legend items.
- Fixing `placeholder`'s always-inactive dead field - carried over unchanged (out of scope; pre-existing, unrelated to this change).

## Decisions

### D13 - Whole-form generation: `generateNodeMenu()` parses tabs from top-level `group` items

`generateNodeMenu()` no longer returns a static array. It resolves the effective Questionnaire (configured one, or the built-in default per D14), parses it once, and builds the full field-descriptor list and tabs array from the parse result - the same `questionnaireParser.ts`/`NodeMenu` pipeline `questionnaire-fields` already built, now used for the *entire* form instead of only a `'Custom'` addendum.

**Tab derivation**: a *top-level* `group` item (a direct child of `Questionnaire.item[]`) becomes a tab; its `text` is the tab's displayed label, its `linkId` is the tab's internal key (NodeMenu is changed to key tabs by a stable identifier distinct from the displayed label - today `this.tabs[tabName]` conflates the two, which breaks if two tabs happen to share a label). A *nested* `group` (child of a top-level group) becomes a heading pseudo-field within its parent tab, exactly as today's D2 already specifies for any group - nesting depth beyond that is still flattened, unchanged. A top-level *non-group* item (not wrapped in any group) is placed into an implicit `"General"` tab and a warning is logged - matches the established "misconfiguration degrades gracefully, never hard-fails" precedent (D11), rather than requiring every implementer to remember to wrap things.

*Alternative considered:* require every top-level item to be a group (hard validation error otherwise). Rejected - inconsistent with every other "missing/malformed config" case in this codebase, which all degrade with a warning rather than throw.

### D14 - Built-in default Questionnaire; supplied Questionnaire fully replaces it (no implicit merge)

`src/script/questionnaire/defaultQuestionnaire.ts` exports a plain `Questionnaire` object, `DEFAULT_QUESTIONNAIRE`, equivalent to today's static array (full item-by-item mapping in the Impact section of proposal.md). It's used whenever `initialiseEditor()` receives neither `questionnaireUrl` nor `questionnaireLocal`.

When an implementer *does* supply a Questionnaire, it **fully replaces** `DEFAULT_QUESTIONNAIRE` - there is no implicit merge. `DEFAULT_QUESTIONNAIRE` is exported as part of the public API (`OpenPedigree.defaultQuestionnaire`) specifically so "I want everything plus a few new fields" remains a one-line change for the implementer:

```js
const myQuestionnaire = {
  ...OpenPedigree.defaultQuestionnaire,
  item: [...OpenPedigree.defaultQuestionnaire.item, ...myExtraItems],
};
initialiseEditor({ questionnaireLocal: myQuestionnaire });
```

*Alternative considered:* implicit merge (built-in fields always present; supplied Questionnaire's items appended/overridden by `linkId` collision). Rejected for v1 - a real merge algorithm needs explicit rules for tab-collision, position-on-override, and partial-group-override that add a lot of design surface for a behaviour a one-line JS spread already gives implementers, with the added downside of the library doing "invisible" merging that isn't visible by reading the Questionnaire alone (undermining "Questionnaire is the source of truth" - with a spread, what's rendered *is* what's in the object actually passed in). Revisit only if implementers report the spread-based approach as insufficient in practice.

**Forward-compatibility note (not part of this change's scope, but shapes this decision):** a planned future REDCap external module integration will compose its own effective Questionnaire server-side in PHP (from REDCap project field metadata), then hand the result to the editor as `questionnaireLocal` - the editor itself stays a self-contained browser window, no PHP-side JS execution. That PHP code can't `import` `defaultQuestionnaire.ts` to build "all the default fields plus mine," so `DEFAULT_QUESTIONNAIRE` is also emitted as a plain JSON artifact (`dist/defaultQuestionnaire.json`, generated at build time - see tasks.md 5.3) alongside the JS export, so any non-JS composer can read and extend it the same way a JS caller spreads `OpenPedigree.defaultQuestionnaire`.

### D15 - Legend-backed repeating items: `mapsToLegendCondition` / `mapsToLegendObservation`

The mapping extension's `valueCode` enum (currently `mapsToField` / `mapsToCondition` / `mapsToObservation`) gains two more values: `mapsToLegendCondition` and `mapsToLegendObservation`. An item with either must be `type: choice` or `open-choice`, `repeats: true`, with `answerValueSet` set (exactly like today's terminology-backed `questionnaire-choice-picker`) - no `item.code` is used (legend items have no single fixed code; the user picks arbitrary terms from the ValueSet, same as `disorders`/`hpo_positive`/`candidate_genes` today).

Rendering: a new NodeMenu field type, `questionnaire-legend-picker`, generalising `disease-picker`/`hpo-picker`/`gene-picker` - a multi-select Selectize widget wired to the item's terminology instance (D4's existing per-`linkId` terminology, unchanged) *and* a generic per-`linkId` `Legend` instance. `Legend`'s constructor (`legend.ts`) is changed to accept an explicit `idPrefix` parameter instead of relying on subclasses overriding `_getPrefix()` (a small refactor: `DisorderLegend`/`PhenotypeLegend`/`GeneLegend` pass their existing fixed prefixes through to the base constructor unchanged; a new bare `Legend` can be constructed directly, `new Legend(item.label, terminology, 'legend-' + item.linkId)`, for any Questionnaire-driven legend item). `PedigreeEditor` exposes `getQuestionnaireLegend(linkId)` alongside the existing `getQuestionnaireTerminology(linkId)`, built at the same parse-time step.

Answer storage and dispatch: `Person` gains a generic `setQuestionnaireLegendAnswer(linkId, newValues)` (paralleling `addDisorder`/`removeDisorder`'s diffing logic at `person.ts:624-655` generically instead of three hardcoded copies) - diffs the new array of `{system, code, display}` against the previously stored one, calling `getQuestionnaireLegend(linkId).addCase()`/`.removeCase()` for the delta and updating `_questionnaireAnswers[linkId]`. `_synthesizeQuestionnaireSetters` (D5) gets a third branch: `mapsToLegendCondition`/`mapsToLegendObservation` items get a synthesized `setQuestionnaireAnswer_<linkId>` that calls this instead of the plain `setQuestionnaireAnswer`.

Export: `deriveResourcesFromQuestionnaireResponse` (D12) gets a case for these two kinds - for each selected term, build a `Condition` (for `mapsToLegendCondition`) or `Observation` (for `mapsToLegendObservation`) with `code: {coding: [{system, code, display}]}` sourced directly from the stored answer (no terminology re-lookup needed, same as today's disorders/phenotypes/genes `addConditions`/`addObservations` loops) - one resource per selected term, matching today's exact shape. Import: `extractDataFromCondition`/`extractDataFromObservation`'s existing generic-vs-mapped code-exclusion check (D10) extends naturally - a `mapsToLegendCondition`/`mapsToLegendObservation` item has no single fixed code to match against, so instead of a code-equality check, generic disorders/phenotypes/genes extraction is *replaced entirely* by the legend-mapped extraction when *any* Questionnaire item declares one of these kinds (a Questionnaire either fully owns disorders-shaped extraction or it doesn't - no partial overlap, avoiding an ambiguous "does this specific Condition belong to the generic list or the mapped one" case that a fixed-code check can't resolve for an open-ended ValueSet).

*Alternative considered:* a single `mapsToLegend` kind with a separate small sub-extension flagging Condition vs Observation. Rejected - inconsistent with the existing pattern where `mapsToCondition`/`mapsToObservation` are already two distinct enum values, not one kind plus a flag; keeping the same shape is simpler to parse and document.

*Alternative considered:* generalising `Legend` further into a fully arbitrary "any array-valued field can have a legend" mechanism with implementer-defined colour/case logic. Rejected - scope creep; the three existing legends already fully define what "legend-backed" means in this codebase, D15 just makes that mechanism `linkId`-parametric instead of hardcoded three times.

### D16 - A closed graph/app-state predicate vocabulary, usable from `enableWhen`

A new, non-standard extension on an `enableWhen` condition (or on the item itself, for option-level rules - see below), `https://github.com/aehrc/open-pedigree/questionnaire-enable-predicate`, names one of a fixed set of predicates instead of (or alongside) a normal item-answer condition:

| Predicate | Equivalent to today's | Resolves to |
|---|---|---|
| `isFetus` | `this.isFetus()` | boolean (whole-item show/hide) |
| `hasRelationships` | `editor.getGraph().hasRelationships(id)` | boolean |
| `isProband` | `this.isProband()` | boolean |
| `isRelatedToProband` | `editor.getGraph().isRelatedToProband(id)` | boolean |
| `hasToBeAdopted` | `editor.getGraph().hasToBeAdopted(id)` | boolean |
| `isTwin` | `editor.getGraph().getAllTwinsSortedByOrder(id).length > 1` | boolean |
| `isTwinWithConsistentGender` | `isTwin` AND all twins share this node's gender | boolean (used for `monozygotic`'s *separate* `disabled` state, not `inactive` - see below) |
| `canLinkPatient` | `editor.getPatientProvider().canLinkPatient(id)` | boolean |
| `canImportClinicalData` | `editor.getPatientProvider().canImportClinicalData() && !!linkedPatientRef` | boolean |
| `possibleGenders` | `editor.getGraph().getPossibleGenders(id)` | a per-option-value map (see below), not a plain boolean |
| `lifeStatusAvailability` | `hasRelationships(id)` applied per radio value | disables `unborn`/`aborted`/`miscarriage`/`stillborn` specifically, once the node has ever had relationships |
| `carrierAvailability` | today's `inactiveCarriers` logic (disorders + life-status dependent) | per-option-value map |

Two shapes are needed, matching the two things `Person.getSummary()` computes today:
1. **Whole-item show/hide** (`inactive: boolean`) - a predicate extension directly on the item, evaluated like an `enableWhen` condition but resolving from graph/app state instead of a sibling answer. Reuses the *existing* `enableWhen`-evaluation call site in `Person.getSummary()` (D6) - the evaluator gains a branch: if a condition carries this extension, resolve via the named predicate instead of `this._questionnaireAnswers[condition.question]`.
2. **Per-option-value disabling** (`disabled`/`inactive` as an *array* of disabled values, for `radio`/`select` types only) - a predicate reference *on the item itself* (not a per-condition `enableWhen` entry), naming a predicate that resolves to an array of disabled option values rather than a boolean. `possibleGenders` and `carrierAvailability` are this shape; `NodeMenu`'s existing array-means-"disable these specific values" handling for `radio` (already present, unchanged, e.g. `_setFieldInactive['radio']`) is reused unmodified - only *what computes the array* changes, from bespoke `Person.getSummary()` code to a named predicate lookup.

`monozygotic` needs *both* `inactive` (via `isTwin`, hide unless in a twin group) *and* `disabled` (via `isTwinWithConsistentGender`, grey out unless all twins share gender) simultaneously - both are whole-item booleans, not per-option arrays, so the parser supports a second, `disabled`-targeting condition list mirroring `enableWhen`/`enableBehavior` exactly (same shape, same evaluator, same predicate vocabulary): `disabledWhen`/`disabledBehavior`, a non-standard sibling property on the raw Questionnaire item JSON (`item.disabledWhen`), evaluated the same way `enableWhen` is but assigned to the field's `disabled` state instead of `inactive`. A predicate condition (in either list) may also carry `negate: true` to invert its result before combining via `enableBehavior`/`disabledBehavior` - needed to express rules like `adopted`'s "inactive unless neither isFetus nor hasToBeAdopted" (De Morgan's: enabled = NOT isFetus AND NOT hasToBeAdopted, i.e. two negated conditions combined with `'all'`) without a richer boolean expression language.

Separately, the three *per-option* array-valued rules (`possibleGenders` for `gender`, `carrierAvailability` for `carrier`, `lifeStatusAvailability` for `state`) are driven by a single-predicate-name item property, `disablingPredicate`, plus `disablingPredicateTarget: 'inactive' | 'disabled'` saying which NodeMenu attribute the resulting array applies to (matching today's split: `gender`/`state` use `inactive` arrays, `carrier` uses a `disabled` array) - these are radio-only, so there's no boolean-vs-array ambiguity to resolve per field type.

*Alternative considered:* a general FHIRPath-based `enableWhenExpression` (the closest real FHIR mechanism, already listed as a non-goal in `questionnaire-fields`' D-notes). Rejected again here - would require embedding a FHIRPath evaluator with access to the pedigree graph model as its evaluation context, a much larger dependency and design surface than a closed set of ~10 named predicates covering exactly the cases that exist today. Revisit only if the closed vocabulary proves too narrow for a concrete future need.

*Alternative considered:* one generic predicate mechanism returning only booleans, with per-option disabling left unsolved (regressing `gender`/`state`/`carrier` to whole-item hide instead of per-value disable). Rejected - would be a visible behavioural regression from today's UI (hiding the entire gender field when only one option should be unavailable is materially worse UX), and the user's explicit goal is zero regression from today's form.

### D17 - Action items: a fixed set of built-in named actions, not arbitrary code

An item's mapping extension gains a third top-level use unrelated to property mapping: `valueCode: 'invokesAction'`, paired with a second extension naming the action, `https://github.com/aehrc/open-pedigree/questionnaire-action`, `valueCode: 'linkPatient' | 'importClinicalData'` (the two that exist today; the vocabulary is closed - see Non-Goals). The parser maps these directly to the *existing* `button-action` NodeMenu field type and the *existing* action closures already in `generateNodeMenu()` (`pedigree.ts:503-517` for `linkPatient`, `:560-577` for `importClinicalData`) - lifted out of the static array into two named functions the parser attaches by lookup by action name, not reimplemented. `item.text` becomes the button's `buttonLabel`. Visibility (`link_patient`/`import_from_record`'s existing `canLinkPatient`/`canImportClinicalData` checks) is expressed via D16's predicates on the item, same as any other field.

*Alternative considered:* a generic "invoke this JS callback" mechanism (e.g. a registry the implementer populates). Rejected - no such registry exists today and building one is unbounded scope for a problem with exactly two known instances; a closed enum is simpler, safer (no risk of arbitrary code execution from a JSON-sourced field), and trivially extended later by adding a new named action if a third one is ever needed.

## Risks / Trade-offs

- **[Risk] Regression risk is the dominant concern for this whole change.** Every visibility rule, setter cascade, and undo interaction in the table under Context must be reproduced exactly via `DEFAULT_QUESTIONNAIRE` + D16's predicates + the existing `mapsToField` machinery. → **Mitigation:** the task list (see tasks.md) should include a field-by-field parity checklist against the current `generateNodeMenu()` array, and the existing e2e suite (`tests/e2e/*.spec.js`) - which exercises the *current* hardcoded form - continues running unmodified throughout implementation as a regression net; it should keep passing without modification until the very last step where `generateNodeMenu()` actually switches over.
- **[Risk]** `Legend`'s constructor change (accepting an explicit `idPrefix`) touches all three existing subclasses (`DisorderLegend`/`PhenotypeLegend`/`GeneLegend`). → **Mitigation:** additive/backward-compatible constructor signature change (new optional trailing param, or subclasses pass their existing hardcoded prefix through unchanged) - low risk, but flagged since it's the one change to already-shipped, non-Questionnaire-specific code this design requires.
- **[Trade-off]** No implicit merge (D14) means an implementer who wants "everything plus one field" must import and spread `DEFAULT_QUESTIONNAIRE` in their own code, rather than the library doing it invisibly. Accepted - explicit is a deliberate choice here (see D14's rationale), and it's a one-line cost.
- **[Risk]** The predicate vocabulary (D16) is closed/fixed. If a future field needs a predicate not in the list, it either can't be expressed via the Questionnaire (regressing that one field back to hardcoded) or the vocabulary needs extending (a small, contained change - add one named predicate - not a redesign). Accepted as the correct trade-off against an open-ended expression language (see D16's alternative).
- **[Risk]** `mapsToLegendCondition`/`mapsToLegendObservation`'s "a Questionnaire either fully owns disorders-shaped extraction or it doesn't" import rule (D15) means an implementer who supplies a Questionnaire *without* a disorders-equivalent item loses generic disorders extraction entirely for that deployment, even if the imported GA4GH bundle contains disorder-coded Conditions from a different source. → **Mitigation:** this only applies when using `mapsToField`-style full replacement (D14) - an implementer who wants generic disorders extraction preserved should spread `DEFAULT_QUESTIONNAIRE` (which always includes a disorders item) rather than authoring a from-scratch Questionnaire, mirroring the same guidance as D14 generally.
