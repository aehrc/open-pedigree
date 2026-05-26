# native-dom-events Delta Specification

## ADDED Requirements

### Requirement: Controller fires pedigree:person:set events
See the `person-set-events` capability spec. This requirement records the
addition to the event vocabulary managed by this module.

The full set of events dispatched by the controller SHALL include the
`pedigree:person:set:<field>` family in addition to all previously specified events.

#### Scenario: Set event is part of controller event contract
- **WHEN** `pedigree:node:setproperty` is handled by the controller for a person node
- **THEN** both the existing property mutation AND a new `pedigree:person:set:<field>` event occur
- **AND** the order is: mutation first, then event dispatch
