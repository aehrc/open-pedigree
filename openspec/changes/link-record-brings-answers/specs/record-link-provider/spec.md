## ADDED Requirements

### Requirement: Linking a record can bring its answers
`openPicker`'s `onLinked` callback SHALL accept an optional third argument, `answers`, an array of `{linkId: string, value: any}` entries, the same shape as `onCreated`'s. When it is an array, the editor SHALL store `recordRef` on the node and apply `answers` in one event, exactly as it does for `onCreated`: through the same setter resolution, with the refresh semantics in "A linked-record refresh applies the record's changes". The answers SHALL be compared with the snapshot the node already has - what its previous record sent, if any - so that record's values are replaced or cleared, not left behind, while values entered in the diagram stay. The snapshot then SHALL become this record's. A single undo SHALL remove the link and the values together. When `answers` is absent or not an array, `onLinked` SHALL behave as before: the ref only (with the snapshot reset a changed ref causes).

#### Scenario: Linking brings the record's values in
- **WHEN** a provider calls `onLinked("Record/42", {}, [{ linkId: "ext_field_a", value: "from the record" }])`
- **THEN** the node's linked record ref SHALL be `"Record/42"`, and its `ext_field_a` answer SHALL be `"from the record"`

#### Scenario: Linking without answers only sets the ref
- **WHEN** a provider calls `onLinked("Record/42", {})`
- **THEN** the node's linked record ref SHALL be `"Record/42"`, and no answers SHALL be applied

#### Scenario: Relinking to another record replaces the old record's values
- **WHEN** a node linked to `Record/1`, whose answers set `ext_field_a` to `"one"`, is linked to `Record/2` with answers `[{ linkId: "ext_field_a", value: "two" }]`
- **THEN** `ext_field_a` SHALL be `"two"`, and the node's snapshot SHALL be `Record/2`'s answers only

#### Scenario: Relinking to a record without a value clears the old record's value
- **WHEN** a node linked to `record:1/instance:1`, whose answers set `note` and `count`, has `count` changed in the diagram, and is then linked to `record:1/instance:2` with answers `note: null, count: null`
- **THEN** `note` SHALL be cleared, `count` SHALL keep the diagram's value, and the snapshot SHALL be empty

#### Scenario: One undo removes a link and its values
- **WHEN** a node is linked with answers and the user undoes once
- **THEN** the node SHALL be unlinked, and the values the link brought SHALL be gone
