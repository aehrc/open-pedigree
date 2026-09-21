## ADDED Requirements

### Requirement: Node menu shows a reserved Linked Record tab
When `recordLinkProvider.isConfigured()` returns `true`, the node menu SHALL show a reserved "Linked Record" tab containing: the link/create-new/edit actions gated by `canLink`/`canCreateNew`, and every Questionnaire item marked `linkedRecordSource: true` (per the `linked-record-questionnaire-rendering` capability), rendered read-only.

#### Scenario: Tab is hidden when no record-link provider is configured
- **WHEN** the active provider is `EmptyRecordLinkProvider`
- **THEN** the "Linked Record" tab SHALL NOT be shown

#### Scenario: Tab shows actions and read-only fields together
- **WHEN** `recordLinkProvider.isConfigured()` returns `true` and the current node has one or more `linkedRecordSource: true` items in the resolved Questionnaire
- **THEN** the "Linked Record" tab SHALL show the applicable link/create/edit actions at the top, followed by the read-only linked items grouped by their original section structure

#### Scenario: Edit action is available only when a record is already linked
- **WHEN** the current node has no record linked yet
- **THEN** the "Edit" action (invoking `openEditor`) SHALL NOT be shown, while "Link to existing" and/or "Create new" (per `canLink`/`canCreateNew`) SHALL be shown as applicable

#### Scenario: Successful link or edit refreshes the tab's displayed values
- **WHEN** `openPicker`'s `onLinked`, `openEditor`'s `onDone`, or `createNew`'s `onCreated` callback fires
- **THEN** the Linked Record tab SHALL re-render to show the current values of all `linkedRecordSource: true` items after the corresponding setters have been dispatched
