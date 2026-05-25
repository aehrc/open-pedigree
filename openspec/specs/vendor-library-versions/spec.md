## Purpose

Defines requirements for vendor library versions under `public/vendor/`, including security patches, updates to current stable releases, removal of superseded files, and documentation of abandonware.
## Requirements
### Requirement: jQuery updated to patch CVEs
The file `public/vendor/jquery-*.min.js` SHALL be replaced with jQuery 3.7.x (minimum 3.5.0 to patch CVE-2020-11022 and CVE-2020-11023). The `<script>` src in `index.html` and `localEditor.html` SHALL be updated to reference the new filename.

#### Scenario: jQuery CVE patches applied
- **WHEN** the jQuery version in `public/vendor/` is inspected
- **THEN** the version is 3.7.1 or later
- **AND** both `index.html` and `localEditor.html` reference the new filename

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

