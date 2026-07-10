## Why

Pedigree diagrams often have individuals with one known parent and one unknown parent (e.g. anonymous donors, uncontactable relatives, or simply undocumented lineage). The editor currently forces all relationships to carry two visible parent nodes, creating ghost "unknown" person nodes that clutter the diagram and confuse clinicians who did not intend to add them.

## What Changes

- Add an `unknownParent` boolean property to PERSON nodes, settable via the node editor panel.
- Render unknown-parent nodes with a distinct muted/placeholder visual (dashed border, grey fill, `?` label) so they are clearly differentiated from real individuals.
- Add a canvas toggle ("Hide unknown parents") that collapses unknown-parent nodes from view while keeping the graph structure intact.
- Add an option to the SVG and PDF export paths to suppress unknown-parent nodes from the exported output.
- Persist `unknownParent` in the internal JSON serialisation and round-trip it through the GA4GH FHIR export/import (mapped to an `INFERRED` relationship or an extension).

## Capabilities

### New Capabilities

- `unknown-parent-node`: Marking, rendering, toggling visibility, and exporting with unknown-parent nodes hidden.

### Modified Capabilities

- `patient-provider`: GA4GH FHIR import/export must handle `unknownParent` flag (round-trip via extension or relationship type).

## Impact

- **Model**: `baseGraph.ts` — add `unknownParent` to the node properties schema; no structural graph changes.
- **Serialisation**: Internal JSON (`toJSON` / `loadGraph`) — include `unknownParent` in node property round-trip.
- **GA4GH FHIR converter**: `GA4GHFHIRConverter.ts` — encode/decode `unknownParent` in FHIR resources.
- **View**: `personVisuals.ts` (or equivalent) — alternate SVG rendering path for unknown nodes.
- **UI controls**: Canvas toolbar — add hide/show toggle; node editor panel — add checkbox.
- **Export**: SVG and PDF export paths — honour `hideUnknownParents` option.
- **No layout/algorithm changes**: The two-parent graph invariant is preserved; unknown nodes are visually suppressed, not removed from the graph.
