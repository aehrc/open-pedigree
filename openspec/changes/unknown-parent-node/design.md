## Context

Open Pedigree's graph model requires every RELATIONSHIP node to have exactly two parent PERSON nodes. When a parent is unknown, importers auto-create a ghost PERSON node with `comments: 'unknown'`. These ghost nodes are indistinguishable from real individuals in the rendered diagram, cluttering clinical pedigrees with unwanted placeholders.

The two-parent graph invariant is deliberately preserved (relaxing it would require redesigning the layout engine's geometric assumptions). Instead, `unknownParent` is a display-level property: the node stays in the graph but is visually and optionally export-suppressed.

## Goals / Non-Goals

**Goals:**
- Add `unknownParent: boolean` to the PERSON node property schema.
- Render unknown-parent nodes with a distinct "placeholder" visual.
- Provide a canvas toggle to show/hide unknown nodes.
- Add `hideUnknownParents` option to SVG and PDF export.
- Round-trip `unknownParent` through internal JSON and GA4GH FHIR.
- Auto-mark ghost nodes created by importers as `unknownParent: true`.

**Non-Goals:**
- Removing the two-parent graph invariant (layout engine dependency).
- Changing the PED/BOADICEA/GEDCOM import format to emit single-parent relationships.
- Adding a separate "unknown" node type — this is a property on PERSON, not a new type.
- Modifying relationship (CHILDHUB/RELATIONSHIP) node rendering.

## Decisions

### D1 — Property location: node `properties` object

`unknownParent` is stored as a plain boolean in the existing `properties` object on PERSON nodes, alongside `isAdopted`, `lostContact`, etc. This is the least-invasive approach — all serialisation, JSON import/export, and property accessors already handle arbitrary keys in this object. No schema migration is needed.

*Alternative considered: separate graph-level flag on the vertex.* Rejected — would require touching `BaseGraph._addVertex`, all constructors, and the serialisation layer independently.

### D2 — Visual rendering: alternate Raphael attributes set

In `abstractPersonVisuals.ts`, `setGenderGraphics()` draws the person shape using attribute sets from `PedigreeEditorParameters`. A new `nodeShapeUnknown` attribute set (dashed stroke, light grey fill, reduced opacity) is applied when `node.getProperties().unknownParent === true`. A `?` label replaces the name display.

The existing shape geometry (circle/rect/diamond) is preserved — unknown rendering is a style override, not a shape change. This means gender is still visible even for unknown nodes (useful when the gender is known but identity isn't).

*Alternative considered: hide the node entirely on the canvas in "normal" mode.* Rejected — hiding in the model layer breaks the canvas hoverbox hit-testing. CSS `display:none` on Raphael elements causes layout issues. Opacity + pointer-events suppression is safer for the "toggle off" mode.

### D3 — Canvas toggle: global view state on the editor, re-render via DOM event

A boolean `hideUnknownParents` is added to the editor's view state (in `workspace.ts` or a new `viewState` object on `editor`). The toolbar toggle button flips this flag and fires a `pedigree:view:refresh` DOM event (or equivalent). Each `PersonVisuals` re-render call checks the flag and sets `opacity: 0; pointer-events: none` on the Raphael set when `hideUnknownParents && node.unknownParent`.

The RELATIONSHIP node's couple line (partnership visuals) is also suppressed when both connected parents are unknown, or when the one visible unknown is toggled off.

*Alternative considered: CSS class on the SVG container.* A single class toggle on the SVG root with a CSS rule `[data-unknown-parent] { display: none }` would be simpler. Rejected because Raphael SVG elements don't reliably pick up external CSS rules in all host environments (the REDCap EM iframe context in particular).

### D4 — Export suppression: leverage existing `removeHiddenNodes` + new parameter

`exportAsSVG` and `exportAsPDF` already call `removeHiddenNodes()` which strips elements with `display:none` or `opacity:0; fill-opacity:0`. Unknown-parent nodes rendered with `opacity:0` will be stripped automatically when this path is active.

Both export functions get a new `hideUnknownParents?: boolean` option. When true, the export sets unknown nodes to zero-opacity in the live SVG immediately before capture, then restores them. This is independent of the canvas toggle so export can suppress unknown nodes even when they're visible on canvas.

Unknown-node Raphael sets are identified by a `data-unknown-parent="true"` attribute added at render time.

### D5 — FHIR round-trip: FHIR extension on Patient resource

In `GA4GHFHIRConverter.ts`, when exporting a PERSON with `unknownParent: true`, add a FHIR extension to the Patient resource:
```json
{ "url": "https://github.com/aehrc/open-pedigree/unknownParent", "valueBoolean": true }
```
On import, detect this extension and set `unknownParent: true` on the node property.

*Alternative considered: use `INFERRED` relationship type on FamilyMemberHistory.* Rejected — `INFERRED` applies to the relationship confidence, not to whether the person itself is a placeholder. The extension is more semantically precise.

### D6 — Auto-marking import-created ghost nodes

All four import paths in `import.ts` (PED, BOADICEA, GEDCOM, DADA2) and the FHIR importer create ghost nodes with `'comments': 'unknown'`. After creating such a node, set `unknownParent: true` on the properties immediately. Existing pedigrees loaded from JSON without the flag are unaffected — `unknownParent` defaults to `false`/undefined.

### D7 — Node editor UI: checkbox in node menu

A "Unknown parent" checkbox is added to the node editing panel (wherever `isAdopted` / `lostContact` appear). This lets users manually mark/unmark any PERSON node.

## Risks / Trade-offs

**[Risk] Opacity-zero nodes still occupy canvas space** → In "hide unknown" mode, the node is invisible but still takes up layout space (the graph structure is unchanged). Mitigated by labelling the toggle clearly: "Hide unknown parent indicators" rather than implying they are removed.

**[Risk] Couple line orphaned when unknown node hidden** → If one parent of a couple is hidden, the horizontal line from the visible parent to nowhere looks broken. Mitigation: also suppress the couple line (and the unknown node's connecting line segments) when hiding. The child drop-line attaches to the CHILDHUB, not the parents, so it is unaffected.

**[Risk] Existing pedigrees with `comments: 'unknown'` ghost nodes** → These won't be auto-migrated to `unknownParent: true` on load (we can't tell if a user intentionally named someone "unknown"). Users can manually mark them, or we provide a migration hint in the UI ("this looks like an unknown parent — mark it?"). No automatic migration is implemented in this change.

**[Risk] PDF export opacity restore failure** → If export throws mid-flight, nodes remain at zero opacity. Mitigation: wrap in try/finally to always restore opacity.

## Open Questions

- Should the toolbar toggle persist across sessions (saved to local storage / backend)? Initial implementation: transient (resets on reload). Can be promoted later.
- Should unknown nodes be selectable/editable while hidden? Initial: no (pointer-events suppressed). A right-click context menu could allow "reveal" in a later iteration.
