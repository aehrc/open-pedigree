## ADDED Requirements

### Requirement: PERSON nodes support an unknownParent property
The system SHALL support a boolean `unknownParent` property on PERSON nodes. When `true` the node represents a placeholder parent whose identity is not known, not a real individual. The property SHALL default to `false`/absent when not set.

#### Scenario: unknownParent is persisted in internal JSON round-trip
- **WHEN** a pedigree containing nodes with `unknownParent: true` is serialised and reloaded
- **THEN** every such node SHALL have `unknownParent: true` after reload

#### Scenario: unknownParent absent from JSON is treated as false
- **WHEN** a pedigree node in the saved JSON has no `unknownParent` key
- **THEN** the node SHALL behave as if `unknownParent` is `false`

---

### Requirement: Importers auto-mark synthesised ghost parent nodes
When any importer (PED, BOADICEA, GEDCOM, DADA2, GA4GH FHIR) creates a PERSON node to satisfy the two-parent constraint for an unknown parent, it SHALL set `unknownParent: true` on that node's properties immediately.

#### Scenario: PED import with missing father
- **WHEN** a PED file is imported and a row has father ID `0`
- **THEN** the synthesised father node SHALL have `unknownParent: true`

#### Scenario: PED import with missing mother
- **WHEN** a PED file is imported and a row has mother ID `0`
- **THEN** the synthesised mother node SHALL have `unknownParent: true`

#### Scenario: Known parents are not auto-marked
- **WHEN** a PED file is imported and both parents are present in the file
- **THEN** neither parent node SHALL have `unknownParent: true` set by the importer

---

### Requirement: Unknown-parent nodes render with a distinct placeholder visual
PERSON nodes with `unknownParent: true` SHALL be rendered with a visually distinct style that clearly differentiates them from real individuals. The style SHALL use a dashed border, a muted grey fill, and display a `?` label in place of the person's name.

#### Scenario: Unknown node displays placeholder style
- **WHEN** a node has `unknownParent: true` and unknown-parent rendering is active
- **THEN** the node SHALL be drawn with a dashed border and grey fill

#### Scenario: Unknown node displays ? label
- **WHEN** a node has `unknownParent: true`
- **THEN** the node SHALL display `?` as its label instead of any name fields

#### Scenario: Normal node is unaffected
- **WHEN** a node has `unknownParent` absent or `false`
- **THEN** the node SHALL render with its standard appearance

---

### Requirement: Users can mark any PERSON node as an unknown parent via the node menu
The node editing panel SHALL include a checkbox labelled "Unknown parent" that reflects and updates the `unknownParent` property on the selected node.

#### Scenario: Checking the checkbox marks the node
- **WHEN** the user opens the node menu for a PERSON node and checks "Unknown parent"
- **THEN** `unknownParent` SHALL be set to `true` on the node and the node SHALL re-render with the placeholder style

#### Scenario: Unchecking the checkbox unmarks the node
- **WHEN** the user opens the node menu for a node with `unknownParent: true` and unchecks "Unknown parent"
- **THEN** `unknownParent` SHALL be set to `false` and the node SHALL re-render with normal appearance

---

### Requirement: Canvas toggle shows or hides unknown-parent nodes
The workspace toolbar SHALL include a toggle control labelled "Hide unknown parents" (or equivalent). When activated, all nodes with `unknownParent: true` SHALL become visually invisible and non-interactive on the canvas. When deactivated, they SHALL reappear.

#### Scenario: Toggling hide suppresses unknown nodes
- **WHEN** the user activates "Hide unknown parents"
- **THEN** all nodes with `unknownParent: true` SHALL have zero opacity and SHALL NOT be clickable or hoverable

#### Scenario: Toggling show restores unknown nodes
- **WHEN** the user deactivates "Hide unknown parents"
- **THEN** all nodes with `unknownParent: true` SHALL be visible and interactive again

#### Scenario: Couple line is also suppressed when unknown node is hidden
- **WHEN** the user activates "Hide unknown parents" and one parent of a couple is an unknown node
- **THEN** the line segments connecting the hidden unknown node to the relationship SHALL also be invisible

#### Scenario: Child drop-line is unaffected
- **WHEN** the user activates "Hide unknown parents"
- **THEN** the vertical drop-line from the relationship node to children SHALL remain visible

---

### Requirement: SVG export accepts a hideUnknownParents option
`PedigreeExport.exportAsSVG(pedigree, privacySetting, options)` SHALL accept an `options` object with a `hideUnknownParents: boolean` field. When `true`, nodes with `unknownParent: true` and their associated line segments SHALL be omitted from the exported SVG regardless of the current canvas toggle state.

#### Scenario: Export with hideUnknownParents true omits placeholder nodes
- **WHEN** `exportAsSVG` is called with `options.hideUnknownParents: true`
- **THEN** the exported SVG SHALL contain no elements corresponding to unknown-parent nodes

#### Scenario: Export with hideUnknownParents false retains placeholder nodes
- **WHEN** `exportAsSVG` is called without `hideUnknownParents` or with it set to `false`
- **THEN** the exported SVG SHALL include unknown-parent nodes rendered with their placeholder style

#### Scenario: Export does not permanently alter canvas state
- **WHEN** `exportAsSVG` is called with `hideUnknownParents: true`
- **THEN** after the export completes the canvas SHALL show unknown nodes at the same visibility they had before the export

---

### Requirement: PDF export accepts a hideUnknownParents option
`PedigreeExport.exportAsPDF(pedigree, privacySetting, pageSize, layout, legendPos, options)` SHALL accept an `options` object with a `hideUnknownParents: boolean` field with the same semantics as the SVG export option.

#### Scenario: PDF export with hideUnknownParents true omits placeholder nodes
- **WHEN** `exportAsPDF` is called with `options.hideUnknownParents: true`
- **THEN** the exported PDF SHALL not render any unknown-parent nodes

#### Scenario: PDF export does not permanently alter canvas state
- **WHEN** `exportAsPDF` is called with `hideUnknownParents: true`
- **THEN** after the export completes the canvas SHALL show unknown nodes at the same visibility they had before the export
