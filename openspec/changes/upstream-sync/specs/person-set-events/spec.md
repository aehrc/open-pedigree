# person-set-events Specification

## Purpose
Allow external code to react to individual person property changes in real time by
observing typed DOM events fired after each setter call.

## Requirements

### Requirement: Controller fires set event after each property update
After calling `node[propertySetFunction](propValue)` in the `setproperty` handler,
the controller SHALL dispatch a `CustomEvent` named `pedigree:person:set:<field>`
on `document`, where `<field>` is `propertySetFunction` with the leading `set`
stripped and the remainder lowercased (e.g. `setFirstName` → `firstname`).
The event detail SHALL be `{ node, value: propValue }`.

#### Scenario: Field event fired on property set
- **WHEN** the user sets a person's first name via the node menu
- **THEN** `document` receives a `pedigree:person:set:firstname` CustomEvent
- **AND** `event.detail.node` is the affected node
- **AND** `event.detail.value` is the new first name string

#### Scenario: Set event fires for disorder update
- **WHEN** the user adds a disorder to a person node
- **THEN** `document` receives a `pedigree:person:set:disorders` CustomEvent with the updated disorders array in `event.detail.value`

#### Scenario: Set event fires for all setter types
- **WHEN** any setter on a person node is invoked via `pedigree:node:setproperty`
- **THEN** a corresponding `pedigree:person:set:<field>` event is dispatched for each property in the update payload

### Requirement: Set event does not fire for non-person nodes
The `pedigree:person:set:<field>` event SHALL only be dispatched for person nodes,
not for partnership or group nodes.

#### Scenario: No set event for partnership node
- **WHEN** a property is set on a partnership node
- **THEN** no `pedigree:person:set` event is dispatched
