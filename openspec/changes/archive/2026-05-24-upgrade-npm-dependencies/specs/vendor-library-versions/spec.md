## ADDED Requirements

### Requirement: jQuery updated to patch CVEs
The file `public/vendor/jquery-*.min.js` SHALL be replaced with jQuery 3.7.x (minimum 3.5.0 to patch CVE-2020-11022 and CVE-2020-11023). The `<script>` src in `index.html` and `localEditor.html` SHALL be updated to reference the new filename.

#### Scenario: jQuery CVE patches applied
- **WHEN** the jQuery version in `public/vendor/` is inspected
- **THEN** the version is 3.7.1 or later
- **AND** both `index.html` and `localEditor.html` reference the new filename

### Requirement: URI.js updated
The file `public/vendor/URI.js` SHALL be replaced with URI.js 1.19.6 (latest stable). The filename SHALL remain `URI.js` (no version number in filename).

#### Scenario: URI.js is current
- **WHEN** the version comment in `public/vendor/URI.js` is inspected
- **THEN** it reports version 1.19.6 or later

### Requirement: FileSaver.js updated
The file `public/vendor/filesaver/FileSaver.js` SHALL be replaced with the current stable release from the eligrey/FileSaver.js repository.

#### Scenario: FileSaver.js is current
- **WHEN** the updated `FileSaver.js` is inspected
- **THEN** it is the current release (newer than the existing undated copy)

### Requirement: Selectize updated
The file `public/vendor/selectize/selectize.js` SHALL be replaced with Selectize 0.15.x. The CSS file `public/vendor/selectize/selectize.default.css` SHALL also be updated to the matching release.

#### Scenario: Selectize is current
- **WHEN** the version comment in `public/vendor/selectize/selectize.js` is inspected
- **THEN** it reports version 0.15.x

#### Scenario: Autocomplete still works after Selectize upgrade
- **WHEN** the pedigree editor is opened and a disorder, phenotype, or gene is searched
- **THEN** the autocomplete dropdown appears and items can be selected

### Requirement: Unused Font Awesome 4 vendor copy removed
The directory `public/vendor/font-awesome/` (Font Awesome 4.7.0 CSS copy) SHALL be removed. It is not referenced by any HTML file and is superseded by the npm FA6 bundle.

#### Scenario: FA4 vendor directory absent
- **WHEN** the `public/vendor/` directory is listed
- **THEN** no `font-awesome/` subdirectory exists

### Requirement: Abandonware vendor libraries documented
PrototypeJS (`public/vendor/prototype-1.7.3.js`) and Scriptaculous (`public/vendor/scriptaculous/`) SHALL remain at their current versions. A comment SHALL be added to `index.html` above each noting that no upstream updates are available.

#### Scenario: Abandonware comment present
- **WHEN** `index.html` is read
- **THEN** the PrototypeJS `<script>` tag has a comment indicating no upstream updates exist

### Requirement: XWiki and PhenoTips vendor scripts unchanged
Files under `public/vendor/xwiki/` and `public/vendor/phenotips/` SHALL NOT be modified as part of this upgrade. They are custom project code with no public upstream package.

#### Scenario: Custom vendor scripts untouched
- **WHEN** git diff is inspected for files in public/vendor/xwiki/ and public/vendor/phenotips/
- **THEN** no changes are present for those files
