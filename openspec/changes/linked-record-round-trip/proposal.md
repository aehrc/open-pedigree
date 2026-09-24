## Why

`redcap_pedigree_editor` links pedigree nodes to REDCap repeating-instrument rows and re-imports a row whenever its REDCap edit window closes. Two gaps in open-pedigree break that round trip.

1. **The link isn't saved in GA4GH format.** Only the `internal` format writes a node's `linkedRecordRef`. `exportAsGA4GH`, which is the host's recommended and default-selected format, never writes it, and import never reads it. Confirmed live 2026-09-24: after the editor's Save, unmapped answers survive (via the exported QuestionnaireResponse) but the link doesn't. After a save and reload, the person loses the link, and the host's "Edit in REDCap" action disappears.
2. **A refresh can't remove anything.** Linked-record answers go through the same dispatch as a one-off import. It only sets the linkIds it's given, merges legend lists, and compares values loosely. So a value cleared in the external record stays on the node, and a legend entry removed there stays too. A host-side attempt to send per-type "empty" values failed review: gender validation rejects `''`, `0 == ''` counts as "no change", a blank boolean becomes an explicit `false` that spreads to twins, and every refresh adds undo entries.

## What Changes

- **GA4GH persistence of the link:** the node's `linkedRecordRef` is exported as a `Patient` extension and restored on import.
- **A snapshot of what the record last sent:** kept per node, saved with the pedigree in both `internal` and GA4GH formats (GA4GH as a JSON extension on the `Patient`, beside the link), and reset when the node is relinked or unlinked. The record-link actions send the reset with the new ref, so undo restores it.
- **Refresh dispatch for `openEditor`/`createNew` answers: apply the record's *changes*.** Each answer is compared with the snapshot, not with the node, because open-pedigree's setters normalise, reject and recompute values, so comparing against the node never settles:
  - Unchanged: nothing happens.
  - Changed: it's set.
  - Emptied: it's cleared through a per-target clear, but only while the node still holds the record's last value. A diagram edit, or a value open-pedigree rejected, is left alone.
  - Legend lists are reconciled (dropped entries removed, new ones added, diagram-entered ones kept), matching IDs through the legend's own sanitising.
  - A refresh with no changes adds no undo step. The adopted flag isn't copied to twins, but twin-group rules still apply.
- **Bug fix found on the way:** `Person.removePhenotype` and `removeGene` called Prototype.js's `Array#without`, which no longer exists, so removing any phenotype or candidate gene threw, in the normal UI too. They now use `filter`, like `removeDisorder`.
- `patient-provider`'s one-off import (`importClinicalData`) keeps today's merge behaviour.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `record-link-provider`: link persistence across GA4GH save and load; a snapshot of what the record last sent; refresh semantics for `onDone`/`onCreated` (apply the record's changes: set, clear-if-still-the-record's, legend reconciliation; quiet undo).

## Impact

- `src/script/GA4GHFHIRConverter.ts` (export and import of the link and snapshot Patient extensions), `src/script/view/person.ts` (link and snapshot properties, reset on relink; `removePhenotype`/`removeGene` fix), `src/script/pedigree.ts` (`editRecord`/`createNewRecord` dispatch in refresh mode), `src/script/controller.ts` (a refresh path with strict compare and no twin propagation, if needed).
- Tests: unit tests for the converter round trip and refresh dispatch; e2e for save, reload and the link surviving, and for refresh behaviour against a real editor (clearing, diagram values kept, rejected values, sanitised legend IDs, dates, twins, undo).
- Host follow-up (`redcap_pedigree_editor`): send `null` for empty fields, pick up the release, and refresh its bundled `dist/`. Released as one minor version.
