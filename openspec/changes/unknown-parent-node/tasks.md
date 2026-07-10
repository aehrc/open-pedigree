## 1. Model: unknownParent property

- [x] 1.1 Add `unknownParent` to the node property accessors in `baseGraph.ts` — add `isUnknownParent(v)` helper that reads `this.properties[v]['unknownParent'] === true`
- [x] 1.2 Ensure `unknownParent` is included in the internal JSON serialisation round-trip (`toJSON` / `loadGraph` in `dynamicGraph.ts` or equivalent) — verify it survives save and reload

## 2. Importers: auto-mark ghost nodes

- [x] 2.1 In `import.ts` PED format — after creating a synthetic father/mother node for a `0` parent ID, set `unknownParent: true` on its properties
- [x] 2.2 In `import.ts` BOADICEA format — same auto-mark for synthesised unknown parent nodes
- [x] 2.3 In `import.ts` GEDCOM format — same auto-mark
- [x] 2.4 In `import.ts` DADA2 format — same auto-mark
- [x] 2.5 In `GA4GHFHIRConverter.ts` importer — auto-mark synthesised ghost nodes; also detect the `unknownParent` FHIR extension on Patient resources and set the flag on import

## 3. Visual rendering: placeholder style

- [x] 3.1 Add a `nodeShapeUnknown` attribute set to `PedigreeEditorParameters` — dashed stroke (`stroke-dasharray`), grey fill (`#e0e0e0` or similar), reduced opacity (`0.7`)
- [x] 3.2 In `abstractPersonVisuals.ts` `setGenderGraphics()` — add a branch: when `node.isUnknownParent()`, apply `nodeShapeUnknown` attributes to the shape
- [x] 3.3 In the person label rendering — when `node.isUnknownParent()`, render `?` as the display label instead of name fields
- [x] 3.4 Add `data-unknown-parent="true"` attribute to the Raphael element set for unknown nodes (used by export suppression)

## 4. Node menu: Unknown parent checkbox

- [x] 4.1 Locate the node editing panel (where `isAdopted` / `lostContact` checkboxes live) and add an "Unknown parent" checkbox field wired to the `unknownParent` property
- [x] 4.2 Ensure checking/unchecking fires the appropriate `pedigree:node:setproperty` event and triggers a node re-render

## 5. Canvas toggle: show/hide unknown nodes

- [x] 5.1 Add a `hideUnknownParents` boolean to the editor view state (accessible via `editor`)
- [x] 5.2 Add a toggle button to the workspace toolbar in `workspace.ts` `generateViewControls()` — labelled "Hide unknown parents"
- [x] 5.3 When the toggle is activated: set `opacity: 0; pointer-events: none` on each unknown node's Raphael set; suppress the line segments connecting hidden nodes to their relationship node
- [x] 5.4 When the toggle is deactivated: restore `opacity` and `pointer-events` on all unknown node sets and their line segments
- [x] 5.5 Verify child drop-lines (CHILDHUB to children) are unaffected by the toggle

## 6. GA4GH FHIR export: encode unknownParent extension

- [x] 6.1 In `GA4GHFHIRConverter.ts` export path — when building a Patient resource for a node with `unknownParent: true`, append the extension `{ url: "https://github.com/aehrc/open-pedigree/unknownParent", valueBoolean: true }`

## 7. SVG export: hideUnknownParents option

- [x] 7.1 Add an `options?: { hideUnknownParents?: boolean }` parameter to `PedigreeExport.exportAsSVG`
- [x] 7.2 When `options.hideUnknownParents` is `true`: before capturing the SVG, set `opacity: 0; fill-opacity: 0` on all elements with `data-unknown-parent="true"`; wrap in try/finally to always restore opacity after capture
- [x] 7.3 Verify the existing `removeHiddenNodes()` call strips the zeroed elements from the output SVG

## 8. PDF export: hideUnknownParents option

- [x] 8.1 Add an `options?: { hideUnknownParents?: boolean }` parameter to `PedigreeExport.exportAsPDF`
- [x] 8.2 Apply the same pre-capture opacity suppression + try/finally restore as for SVG export (reuse or extract a shared helper)

## 9. Export UI: wire hideUnknownParents option

- [x] 9.1 In the export dialog/selector — add a "Hide unknown parents" checkbox that passes `hideUnknownParents: true` to both `exportAsSVG` and `exportAsPDF` when checked
