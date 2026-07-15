## Context

`questionnaire-source-of-truth` (archived) made the node-edit form Questionnaire-driven end to end: any number of custom fields, mapped via `mapsToField`/`mapsToCondition`/`mapsToObservation`/`mapsToLegendCondition`/`mapsToLegendObservation`, or left as plain unmapped items. `generateNodeMenu()` (`pedigree.ts`) already builds a per-`linkId` setter-dispatch table for rendering the form (`descriptor.function` — resolved to the reserved legend setter, the `mapsToField` target's real setter, or a generic `setQuestionnaireAnswer_<linkId>`, in that priority order).

`AbstractPatientProvider.openClinicalImportModal`'s `onImported` callback was never updated to match — it still assumes importing clinical data always means "here is a disorders list," because that was the only case that existed when `PatientProvider` was designed (before `questionnaire-source-of-truth`). `FHIRPatientProvider`'s `openClinicalImportModal` fetches FHIR `Condition` resources and returns them as `{id, name}` pairs; `pedigree.ts`'s `importClinicalData` action hardcodes merging that list into the node's disorders via `setDisorders`.

A REDCap-repeating-instrument-backed provider (planned separately, in `redcap_pedigree_editor`'s `pedigree-repeating-instrument-import` change) needs to import a full row of REDCap data — potentially touching a `mapsToField` target (e.g. `gender`), a legend target (`disorders`), and a plain custom item, all from the same import action. The current contract has no way to express that.

## Goals / Non-Goals

**Goals:**
- Generalize `openClinicalImportModal`'s `onImported` callback so a provider can return answers for any Questionnaire-mapped or unmapped `linkId`, not only disorders
- Reuse `generateNodeMenu()`'s existing per-`linkId` dispatch resolution for the generalized import handler, rather than building a second, parallel dispatch mechanism
- Preserve `FHIRPatientProvider`'s exact current behavior under the new contract (no functional regression for existing FHIR-based deployments)

**Non-Goals:**
- Renaming the persisted `linkedPatientRef` node property (see D4 — deliberately out of scope)
- Any change to `GA4GHFHIRConverter.ts`'s export logic (its existing behavior already does the right thing — see D5)
- Building the REDCap-side provider itself (tracked separately in `redcap_pedigree_editor`'s `pedigree-repeating-instrument-import` change, which depends on this one)

## Decisions

### D1 — `onImported` callback shape: `{linkId, value}[]`

The callback changes from `(disorders: {id: string, name: string}[]) => void` to `(answers: {linkId: string, value: any}[]) => void`. `value`'s shape is whatever the target `linkId`'s existing setter already expects — this decision doesn't invent a new universal value type, it just lets a provider address *which* setter each piece of imported data goes to:

- For the three reserved legend targets (`disorders`, `candidate_genes`, `hpo_positive`): `value` is an array of `{id, name}` entries, exactly as today.
- For `mapsToField` targets (e.g. `gender`, `birthDate`): `value` is the scalar value the target's real setter expects (a string, in all 10 current cases) — matching how `linkPatient`'s existing details-merge already dispatches `gender`/`birthDate`/`lifeStatus` as scalars.
- For plain/unmapped items and non-reserved `mapsToCondition`/`mapsToObservation`/`mapsToLegendCondition`/`mapsToLegendObservation` items: `value` is whatever `setQuestionnaireAnswer_<linkId>` already expects for that item type.

*Alternative considered:* a plain object keyed by `linkId` (`{[linkId]: value}`) instead of an array of pairs. Rejected — an array mirrors the existing disorders shape more closely (an ordered list of entries), and avoids any ambiguity about whether object key order is meaningful; a provider building the result incrementally (e.g. looping over REDCap fields) naturally produces a list.

### D2 — Generalized dispatch reuses `generateNodeMenu()`'s existing per-`linkId` resolution

`_questionnaireActions.importClinicalData` (`pedigree.ts`) is rewritten to loop over the returned `{linkId, value}` entries and, for each, resolve the same three-way priority `generateNodeMenu()` already computes at `pedigree.ts:380-386` (reserved legend target → `mapsToField` target → generic `setQuestionnaireAnswer_<linkId>`), then dispatch via the existing `pedigree:node:setproperty` event:

- **Reserved legend targets** keep today's exact merge semantics: read the node's current value via the target's getter, dedup by `id` against `value`'s entries, and dispatch the merged array through the target's setter (e.g. `setDisorders`) — unchanged behavior from today's disorders-only code.
- **`mapsToField` targets and generic/unmapped items** dispatch `value` directly through the resolved setter, overwriting any existing value — there is no established "merge" semantics for arbitrary scalar or custom fields today (the existing `linkPatient` action already overwrites `gender`/`birthDate`/`lifeStatus` directly), so overwrite is the natural, consistent default.

*Alternative considered:* a provider-supplied merge/overwrite flag per entry. Rejected — adds API surface for a distinction (merge vs. overwrite) that's already fully determined by the target's mapping kind; the reserved-legend-targets-merge / everything-else-overwrites split needs no additional signal from the provider.

### D3 — `fhirRef` → `patientRef` rename (naming only)

The parameter is renamed across `AbstractPatientProvider`, `FHIRPatientProvider`, `SmartPatientProvider`, and `pedigree.ts`'s call sites. Purely cosmetic — the type stays a plain `string`, and this was already true before the rename; the name change just stops the interface from reading as FHIR-specific to a future non-FHIR implementer (e.g. `RedcapInstrumentPatientProvider`, whose reference is a REDCap `record_id`/`redcap_repeat_instance` pair encoded as an opaque string, not a FHIR reference).

### D4 — `linkedPatientRef` (persisted property name) stays unchanged

Unlike the `fhirRef` parameter name (D3, internal to function signatures, zero persistence impact), `linkedPatientRef` is a key in the pedigree's saved JSON format and in GA4GH import/export. Renaming it would be a breaking change to every previously-saved pedigree and would require a migration path for existing data. The gain is purely cosmetic (the property already accepts any provider's opaque ref string today, regardless of its name), so it is not renamed.

*Alternative considered:* rename to `linkedRecordRef` with a load-time alias for backward compatibility. Rejected — the migration/alias complexity isn't justified by a naming-only improvement; revisit only if a concrete need for the generic name emerges beyond readability.

### D5 — GA4GH export's non-FHIR-ref exclusion is confirmed, not changed

`GA4GHFHIRConverter.ts`'s existing check (`nodeProperties['linkedPatientRef'].startsWith('Patient/')`) already excludes any `linkedPatientRef` that isn't FHIR-`Patient/`-shaped from being used as the exported stable Patient reference — a REDCap-shaped ref (D3/D4 in `pedigree-repeating-instrument-import`'s design) already falls through this check today with no code change needed. This decision is to add a regression test making that existing behavior explicit and locked in, since a future non-FHIR provider now depends on it not regressing silently.

## Risks / Trade-offs

- **[Risk] Breaking callback signature change.** Any external code implementing a custom `PatientProvider` against the old disorders-only `onImported` shape breaks. Accepted — the only implementations in this repo today are `FHIRPatientProvider`/`SmartPatientProvider` (both updated as part of this change); no other in-tree or known external consumer exists yet. `redcap_pedigree_editor`'s planned provider is written against the new shape from the start.
- **[Dependency] `pedigree-repeating-instrument-import`'s `RedcapInstrumentPatientProvider`** depends on this change landing on `develop`/`develop_redcap_em` first — without it, that provider could only ever populate the disorders list, defeating most of the point of deriving a full Questionnaire from a REDCap instrument.
