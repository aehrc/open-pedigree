## Context

`record-link-provider` (archived 2026-09-22) gave the editor `linkedRecordRef` and routed `onDone`/`onCreated` answers through `_dispatchQuestionnaireAnswers`, the path `patient-provider`'s import uses. That path was designed for a one-off import:
- It dispatches one `pedigree:node:setproperty` event containing only the linkIds provided.
- It merges reserved legend lists.
- `Controller.handleSetProperty` validates each value (e.g. `getPossibleGenders(id)[value]`), skips it on `oldValue == newValue` (loose), propagates twin-shared properties, and records undo state.

`redcap_pedigree_editor` now re-imports a linked row every time its REDCap window closes or the editor regains focus (host PR #14). So this path must behave as a *mirror*, not an accumulator.

Persistence: `Person.getProperties()` includes `linkedRecordRef` and `questionnaireAnswers` (the `internal` format). `GA4GHFHIRConverter.exportAsGA4GH` builds a QuestionnaireResponse per person from *every* questionnaire item (mapped, legend and generic), so answers survive. It never writes the link, and import (`extractDataFromQuestionnaireResponse`, the Patient extension loop) never reads one.

## Goals / Non-Goals

**Goals:**
- The link survives a GA4GH save and reload.
- A refresh clears what the record used to supply and no longer does. It never wipes what the diagram supplied, and it reconciles legends.
- Refreshes are quiet: strict change detection, no twin side effects, and at most one undo step.

**Non-Goals:**
- Changing `patient-provider`'s import semantics.
- Several external fields feeding one legend (still deferred on the host side).
- Persisting supplied-value tracking in `fhir_v1`, PED or DADA2 formats. Only `internal` and GA4GH carry links at all.

## Decisions

**D1. The link is stored as a Patient extension.** URL `https://github.com/aehrc/open-pedigree/StructureDefinition/linked-record-ref`, `valueString` = the ref. This follows the existing `patient-unborn` extension pattern on the same resource; import reads it in the same extension loop. *Alternative:* `Patient.identifier`. Rejected, because an identifier asserts the patient's identity in another system, which is stronger than "this node is linked to that row", and it could collide with real identifiers when exported to other FHIR consumers.

**D2. Supplied markers go on the QuestionnaireResponse.** Each QR `item` the record supplied carries extension `…/questionnaire-response-linked-record-supplied` (`valueBoolean: true`). For legend items, each supplied `answer` carries it instead, since legend entries are per-answer. Import rebuilds the node's supplied set from those markers. In `internal` format it's a `linkedRecordSupplied` property: `{ linkId: true | [legendIds] }`. *Alternative:* one Patient extension holding a JSON blob. Rejected, because it's opaque to FHIR consumers and duplicates what QR items already identify.

**D3. `Person` owns the supplied set.** It's stored beside `_linkedRecordRef`. `setLinkedRecordRef` clears it when the ref changes, and `getProperties`/`assignProperties` round-trip it.

**D4. A dedicated refresh dispatch, not the shared one.** `_dispatchLinkedRecordRefresh(nodeId, answers)` is used by `editRecord` and `createNewRecord`. `_dispatchQuestionnaireAnswers` stays as it is for `importClinicalData`. The refresh dispatch:
1. Resolves each linkId to its target (same priority).
2. Computes the node's intended new value: set / clear (only if supplied) / reconcile (legends).
3. Compares strictly with the current value, per target: dates by calendar day (`toDateString`, matching what the controller stores); gestation age as an integer or unset (the getter returns `null` for non-fetuses); legend lists as ID sets; objects and arrays by JSON.
4. Emits one `setproperty` event carrying only real changes, flagged `{linkedRecordRefresh: true}`, plus the updated supplied set.
5. Emits nothing if there are no changes.

**D5. A per-target clear table.** A clear is expressed as the value each setter accepts as "unset":

| Target | Clear value |
|---|---|
| gender | `'U'` (passes `getPossibleGenders`) |
| lifeStatus | `'alive'` (its setter also drops the death date) |
| birthDate, deathDate, names, comments, externalID | `''` |
| carrierStatus | `''` |
| booleans (adopted, evaluated, monozygotic, lostContact) | `false` |
| gestationAge | `''` (`parseInt('')` is NaN, which the setter treats as unset; unlike `undefined`, it survives the undo memo's JSON clone) |
| childlessStatus | `null` |
| generic answer | remove (`setQuestionnaireAnswer(linkId, null)` deletes) |

This table is the one place clearing semantics live, and it's unit-tested per target.

**D6. The controller honours the refresh flag.** For `linkedRecordRefresh` events, `handleSetProperty` uses strict comparison and skips twin propagation. Twins share some properties for drawing reasons, but a linked record describes one person. Everything else (validation, `updateAncestors`, undo) runs as usual, and because D4 sends one event, it's one undo step.

**D7. Ordering inside one event.** Clears are applied before sets, and a death date is applied after a birth date, so `setBirthDate`'s "birth before death" guard can't reject a valid new pair because of a stale old value.

## Risks / Trade-offs

- [A new GA4GH extension that other GA4GH consumers ignore] → Harmless (unknown extensions are ignored). The document stays valid, and it's documented in the FHIR format notes.
- [Existing saved pedigrees have no supplied markers, so the first refresh after upgrading treats every existing value as diagram-entered and won't clear it] → Acceptable, since it's conservative (nothing is wiped). From the next refresh on, markers exist. Release notes mention it.
- [Clearing life status to `alive` could be wrong if the diagram, not the record, set "deceased"] → It's only cleared when the record supplied it (D5 applies only to supplied linkIds).
- [The skip-twins rule diverges from the controller's normal behaviour] → Scoped by the event flag, and covered by a test.

## Migration Plan

Additive. Old documents load unchanged (no extensions, empty supplied sets), and new documents are valid GA4GH. Released as one minor version; the host then sends `null` for empty fields and refreshes its bundled `dist/`. Rollback: revert. Extensions left in saved documents are ignored by older builds.

## Open Questions

- Should `childlessStatus` and `monozygotic` be clearable by a refresh at all, or excluded as structural? Default: clearable, like the rest, since they're only touched if the record supplied them.
