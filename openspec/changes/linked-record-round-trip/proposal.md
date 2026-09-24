## Why

`redcap_pedigree_editor` links pedigree nodes to REDCap repeating-instrument rows and re-imports a row whenever its REDCap edit window closes. Two gaps in open-pedigree break that round trip.

1. **The link isn't saved in GA4GH format.** Only the `internal` format writes a node's `linkedRecordRef`. `exportAsGA4GH`, which is the host's recommended and default-selected format, never writes it, and import never reads it. Confirmed live 2026-09-24: after the editor's Save, unmapped answers survive (via the exported QuestionnaireResponse) but the link doesn't. After a save and reload, the person loses the link, and the host's "Edit in REDCap" action disappears.
2. **A refresh can't remove anything.** Linked-record answers go through the same dispatch as a one-off import. It only sets the linkIds it's given, merges legend lists, and compares values loosely. So a value cleared in the external record stays on the node, and a legend entry removed there stays too. A host-side attempt to send per-type "empty" values failed review: gender validation rejects `''`, `0 == ''` counts as "no change", a blank boolean becomes an explicit `false` that spreads to twins, and every refresh adds undo entries.

## What Changes

- **GA4GH persistence of the link:** the node's `linkedRecordRef` is exported as a `Patient` extension and restored on import.
- **Supplied-value tracking:** the editor remembers which answers (and which legend entries) the linked record supplied at its last refresh. This is saved with the pedigree in both `internal` and GA4GH formats (GA4GH as QuestionnaireResponse item/answer extensions), and reset when the node is linked to a different record or unlinked.
- **Refresh dispatch for `openEditor`/`createNew` answers:**
  - `null` means "empty in the linked record". A value the record previously supplied is cleared through a defined per-target clear; a value it never supplied (entered in the diagram) is left alone.
  - Legend targets remove previously-supplied entries the record no longer has, and add new ones. Entries added in the diagram are kept.
  - Comparisons are strict. Nothing changes and no undo entry is added when the refresh matches the node. A refresh that changes something is one undo step.
  - Twin propagation is not triggered by a refresh.
- `patient-provider`'s one-off import (`importClinicalData`) keeps today's merge behaviour.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `record-link-provider`: link persistence across GA4GH save and load; supplied-value tracking; refresh semantics for `onDone`/`onCreated` (clearing, legend replacement, strict comparison, single undo step).

## Impact

- `src/script/GA4GHFHIRConverter.ts` (export and import of the link and supplied markers), `src/script/view/person.ts` (link and supplied-set properties, reset on relink), `src/script/pedigree.ts` (`editRecord`/`createNewRecord` dispatch in refresh mode), `src/script/controller.ts` (a refresh path with strict compare and no twin propagation, if needed).
- Tests: unit tests for the converter round trip and refresh dispatch; e2e for save, reload and the link surviving, and for refresh clearing supplied values while keeping diagram-entered ones.
- Host follow-up (`redcap_pedigree_editor`): send `null` for empty fields, pick up the release, and refresh its bundled `dist/`. Released as one minor version.
