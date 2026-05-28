## ADDED Requirements

### Requirement: Date fields use flatpickr
The date-picker fields in the node menu (`nodeMenu.ts`) SHALL use flatpickr instead of `XWiki.widgets.DateTimePicker`. flatpickr SHALL be installed as an npm dependency and imported in the bundle. The date format and locale behaviour SHALL match the existing date-only picker (no time component required).

#### Scenario: Date picker opens on field focus
- **WHEN** the user clicks a date field in the node menu
- **THEN** a flatpickr calendar opens without requiring XWiki.widgets to be present on the page

#### Scenario: Selected date updates node property
- **WHEN** the user selects a date in the flatpickr calendar
- **THEN** the node's date property is updated via the existing field event listener mechanism

#### Scenario: No remaining DateTimePicker reference
- **WHEN** `grep -rn "DateTimePicker\|XWiki\.widgets" src/script/` is run
- **THEN** it produces no output

### Requirement: DateTimePicker vendor files removed
`public/vendor/phenotips/DateTimePicker.js` and `DateTimePicker.css` SHALL be deleted. The `<script>` and `<link>` tags loading them in `localEditor.html` SHALL be removed.

#### Scenario: Build succeeds without DateTimePicker vendor files
- **WHEN** `npm run build` is run after DateTimePicker files are deleted
- **THEN** the build exits 0 and flatpickr styles are included in the bundle
