## ADDED Requirements

### Requirement: A provider can relabel its node-menu actions
`AbstractRecordLinkProvider` SHALL offer an optional `getActionLabel(action)` method, where `action` is one of `linkRecord`, `createNewRecord` or `editRecord`. The editor SHALL use a non-blank string it returns as that action's button label, and SHALL otherwise use the generic default ("Link to existing record", "Create new linked record", "Edit linked record"). The editor SHALL only call the method if the provider has it, since a host may supply a provider object that does not extend `AbstractRecordLinkProvider`.

#### Scenario: A provider relabels one action
- **WHEN** a provider's `getActionLabel('editRecord')` returns "Edit in REDCap" and it returns `undefined` for the other actions
- **THEN** the Edit action's button reads "Edit in REDCap", and Link/Create-new keep their default labels

#### Scenario: A blank or non-string label is ignored
- **WHEN** `getActionLabel` returns a blank string or a non-string value for an action
- **THEN** that action keeps its default label

#### Scenario: A provider without the method keeps the defaults
- **WHEN** the configured provider has no `getActionLabel` method, or the editor uses `EmptyRecordLinkProvider`
- **THEN** all three actions keep their default labels
