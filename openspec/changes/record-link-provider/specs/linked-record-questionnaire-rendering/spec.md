## ADDED Requirements

### Requirement: A generic extension marks a Questionnaire item as linked-record-sourced
The Questionnaire parser SHALL recognize a non-standard `questionnaire-linked-record-source` extension (boolean presence, no value payload required) on any item, independent of `questionnaire-field-mapping`/`mapsToField`/legend mappings, and expose it as `item.linkedRecordSource: boolean`. This extension SHALL be distinct from any host-application-specific "data source" extension (e.g. a REDCap-specific one) — it carries no information about *where* the data comes from, only that it does, and does not require `record-link-provider` to be configured to take effect.

#### Scenario: Item with the extension is exposed as linked-record-sourced
- **WHEN** a Questionnaire item carries the `questionnaire-linked-record-source` extension
- **THEN** the parsed item descriptor SHALL have `linkedRecordSource: true`

#### Scenario: Item without the extension is unaffected
- **WHEN** a Questionnaire item does not carry the extension
- **THEN** the parsed item descriptor SHALL have `linkedRecordSource: false` (or equivalently absent/falsy)

#### Scenario: Rendering works with no record-link provider configured
- **WHEN** a Questionnaire item is marked `linkedRecordSource: true` but `recordLinkProvider` was not supplied to `initialiseEditor()`
- **THEN** the item SHALL still render disabled per the requirement below, with no error

---

### Requirement: Linked-record-sourced items always render disabled
`Person.getSummary()` SHALL treat any item with `linkedRecordSource: true` as disabled, independent of and in addition to the item's own `disabledWhen`/`disablingPredicate` evaluation. This SHALL NOT be implemented as a synthesized `disabledWhen` condition or named predicate — it is a static, always-true fact about the item, not something evaluated against current answers or graph state.

#### Scenario: Linked-record-sourced item is always disabled regardless of its own disabledWhen
- **WHEN** an item has `linkedRecordSource: true` and its own `disabledWhen` would otherwise evaluate to "not disabled" given current answers
- **THEN** `getSummary()` SHALL still report that item's `disabled` as `true`

#### Scenario: Non-linked item's disabled state is unaffected
- **WHEN** an item does not have `linkedRecordSource: true`
- **THEN** its `disabled` value SHALL be computed exactly as today, unaffected by this requirement

---

### Requirement: Linked-record-sourced items are grouped together, not interspersed
Regardless of which authored tab/group a `linkedRecordSource: true` item was declared under, the node-edit form SHALL render it grouped together with every other linked-record-sourced item, rather than alongside editable items on its originally-authored tab. The item's original immediate parent group (if any) SHALL be preserved as a sub-heading within that grouping, so an instrument's own section structure is not lost.

#### Scenario: Items from different authored tabs are regrouped together
- **WHEN** a Questionnaire has linked-record-sourced items declared under two different top-level groups (e.g. "Demographics" and "Medical History")
- **THEN** the rendered form SHALL show both items together in one place, not on the "Demographics"/"Medical History" tabs they were authored under

#### Scenario: Original section structure is preserved as sub-headings
- **WHEN** linked-record-sourced items originally sat under groups labelled "Demographics" and "Medical History"
- **THEN** the regrouped rendering SHALL show "Demographics" and "Medical History" as sub-headings distinguishing which items came from which original group

#### Scenario: Editable items remain on their own authored tabs
- **WHEN** a Questionnaire has both linked-record-sourced items and ordinary editable items
- **THEN** the editable items SHALL continue to render on their originally-authored tabs, unaffected by the regrouping of linked-record-sourced items
