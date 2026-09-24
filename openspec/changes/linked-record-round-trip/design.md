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
- A refresh applies the record's changes: it clears what the record emptied (while the node still holds the record's value), never wipes a diagram-entered value, and reconciles legends.
- Refreshes are quiet: strict change detection, no twin side effects, and at most one undo step.

**Non-Goals:**
- Changing `patient-provider`'s import semantics.
- Several external fields feeding one legend (still deferred on the host side).
- Persisting the snapshot in `fhir_v1`, PED or DADA2 formats. Only `internal` and GA4GH carry links at all.

## Decisions

**D1. The link is stored as a Patient extension.** URL `https://github.com/aehrc/open-pedigree/StructureDefinition/linked-record-ref`, `valueString` = the ref. This follows the existing `patient-unborn` extension pattern on the same resource; import reads it in the same extension loop. *Alternative:* `Patient.identifier`. Rejected, because an identifier asserts the patient's identity in another system, which is stronger than "this node is linked to that row", and it could collide with real identifiers when exported to other FHIR consumers.

**D2. The snapshot is a Patient extension holding JSON.** URL `…/StructureDefinition/linked-record-snapshot`, `valueString` = JSON of `{ linkId: last value }`. It's written only alongside the link, under the same privacy gate, since it holds record values such as names. *Revised during implementation:* per-item markers on the QuestionnaireResponse were built first. Once the rule became "compare with what the record sent" (D4), the snapshot holds record-side values that the QR, which reflects node values, can't represent. So it's app bookkeeping in one extension, not clinical data.

**D3. `Person` owns the snapshot** beside `_linkedRecordRef`. `setLinkedRecordRef` resets it when the ref changes. The record-link actions (`linkRecord`, `createNewRecord`) also send `setLinkedRecordSnapshot({})` in the same event, so the undo memo captures the old snapshot and undoing a relink restores both.

**D4. Apply the record's changes: compare with the snapshot, not the node.** *Revised after the first review:* comparing the record's values against the node's never settles, because open-pedigree's setters normalise, reject and recompute:
- gestation age reads back `null` for a live-born person, and an unborn person's is recomputed from the conception date
- gender is rejected by partnership rules
- legend IDs are sanitised
- setting life status clears the death date

So `computeLinkedRecordRefresh` (pure, `linkedRecordRefresh.ts`) compares each answer with the snapshot:
- unchanged: nothing
- changed: set
- emptied: clear only if `sameValue(node, snapshot)`, so a diagram edit or a rejected value is left alone
- legend lists: remove what the record dropped, add what it added, keep what it never sent

*Trade-off accepted (David, 2026-09-24):* a record-supplied field edited directly on the diagram stays edited until the record's value changes.

**D5. A per-target clear table.** A clear is the value each setter treats as unset:

| Target | Clear value |
|---|---|
| gender | `'U'` (passes `getPossibleGenders`) |
| lifeStatus | `'alive'` |
| names, comments, externalID, dates, carrierStatus, gestationAge | `''` (`parseInt('')` is NaN, which the gestation setter treats as unset) |
| childlessStatus | `null` |
| booleans | `false` |
| generic answer | removed (`null`) |

Clearing carrier status on a node that still has disorders leaves it "affected", because that's open-pedigree's model (disorders without a carrier status mean affected).

**D6. The controller honours the refresh flag.** For flagged events, `handleSetProperty` compares strictly and doesn't copy the adopted flag to twins. Monozygotic gender and monozygosity still propagate, since those are group invariants. The flag is also written into the undo memo, so undoing a refresh is treated the same way. (Redo already reads `event.memo`, which a CustomEvent doesn't have, so redoing any `setproperty` throws on `main`. That's a separate bug and not addressed here.)

**D7. Side effects are put back once.** Before dispatching, the dispatcher notes which snapshot fields the node currently matches. After dispatching, any of those a setter's side effect has changed (e.g. clearing life status wipes the death date) are re-applied in one follow-up flagged event. Reserved legend IDs are matched through the legend's own `terminology.sanitizeID`. Separately, a fixed set-order for birth and death dates turned out to be unnecessary, since moving both later or both earlier works as-is (covered by e2e).

## Risks / Trade-offs

- [A new GA4GH extension that other GA4GH consumers ignore] → Harmless (unknown extensions are ignored). The document stays valid, and it's documented in the FHIR format notes.
- [Existing saved pedigrees have no snapshot, so the first refresh after upgrading sets everything the record has (as if first linked) and clears nothing] → Conservative. From then on the snapshot exists. Release notes mention it.
- [Clearing life status to `alive` when the record still has a death date] → D7 puts the death date back, and `setDeathDate` makes the person deceased again, following open-pedigree's own rule.
- [The adopted-only twin exception diverges from the controller's normal behaviour] → Scoped by the event flag, and covered by e2e both ways (adopted not copied, monozygotic gender still copied).

## Migration Plan

Additive. Old documents load unchanged (no extensions, no snapshot), and new documents are valid GA4GH. Released as one minor version; the host then sends `null` for empty fields and refreshes its bundled `dist/`. Rollback: revert. Extensions left in saved documents are ignored by older builds.

## Open Questions

- Should `childlessStatus` and `monozygotic` be clearable by a refresh at all, or excluded as structural? Default: clearable, like the rest, since they're only touched if the record sent them.
