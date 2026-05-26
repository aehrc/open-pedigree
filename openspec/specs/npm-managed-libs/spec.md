# npm-managed-libs Specification

## Purpose
TBD - created by archiving change replace-vendor-libs. Update Purpose after archive.
## Requirements
### Requirement: pdfkit, blob-stream, and svg-to-pdfkit managed via npm
The packages `pdfkit`, `blob-stream`, and `svg-to-pdfkit` SHALL be listed in `package.json` dependencies. No corresponding files SHALL exist under `public/vendor/pdfkit/`. The `src/script/model/export.js` file SHALL import these packages using their npm package names, not the `vendor/` webpack alias.

#### Scenario: pdfkit trio present in package.json
- **WHEN** `package.json` is read
- **THEN** `pdfkit`, `blob-stream`, and `svg-to-pdfkit` are listed as dependencies

#### Scenario: vendor pdfkit directory absent
- **WHEN** the `public/vendor/` directory is listed
- **THEN** no `pdfkit/` subdirectory exists

#### Scenario: PDF export still works after migration
- **WHEN** the pedigree editor is open and a PDF export is triggered
- **THEN** a valid PDF file is downloaded without errors

---

### Requirement: file-saver managed via npm
The `file-saver` package SHALL be listed in `package.json` dependencies. No `public/vendor/filesaver/` directory SHALL exist. `src/script/view/exportSelector.js` SHALL import `saveAs` from `file-saver` rather than using the `window.saveAs` global. The `<script>` tags for `FileSaver.js` and `Blob.js` SHALL be removed from `localEditor.html` and `index.html`.

#### Scenario: file-saver present in package.json
- **WHEN** `package.json` is read
- **THEN** `file-saver` is listed as a dependency

#### Scenario: filesaver vendor directory absent
- **WHEN** the `public/vendor/` directory is listed
- **THEN** no `filesaver/` subdirectory exists

#### Scenario: PED export download works after migration
- **WHEN** the export dialog is opened and PED format is selected and Export is clicked
- **THEN** a file named `open-pedigree.ped` is downloaded

#### Scenario: GA4GH FHIR export download works after migration
- **WHEN** the export dialog is opened and GA4GH format is selected and Export is clicked
- **THEN** a file named `open-pedigree-GA4GH-fhir.json` is downloaded

---

### Requirement: urijs managed via npm
The `urijs` package SHALL be listed in `package.json` dependencies. No `public/vendor/URI.js` file SHALL exist. `src/script/localStorageBackend.js` SHALL import `URI` from `urijs` rather than using the `window.URI` global. The `<script>` tag for `URI.js` SHALL be removed from `localEditor.html` and `index.html`.

#### Scenario: urijs present in package.json
- **WHEN** `package.json` is read
- **THEN** `urijs` is listed as a dependency

#### Scenario: URI.js vendor file absent
- **WHEN** the `public/vendor/` directory is listed
- **THEN** no `URI.js` file exists

#### Scenario: Local storage backend parses URIs correctly
- **WHEN** the editor is initialised with a `patientDataUrl` using the `local://` scheme
- **THEN** the URI is parsed correctly and the local storage key is extracted without error

---

### Requirement: @selectize/selectize managed via npm
The `@selectize/selectize` package SHALL be listed in `package.json` dependencies. No `public/vendor/selectize/` directory SHALL exist. The selectize JavaScript SHALL be bundled via webpack (imported in `src/app.js` or `nodeMenu.js`). The selectize CSS SHALL be imported from the npm package path. The webpack config SHALL declare `jquery: 'jQuery'` as an external so bundled selectize resolves to the page-global jQuery.

#### Scenario: @selectize/selectize present in package.json
- **WHEN** `package.json` is read
- **THEN** `@selectize/selectize` is listed as a dependency

#### Scenario: selectize vendor directory absent
- **WHEN** the `public/vendor/` directory is listed
- **THEN** no `selectize/` subdirectory exists

#### Scenario: Disorder autocomplete works after migration
- **WHEN** the pedigree editor is open, a person node is selected, and a disorder term is typed in the disorder search field
- **THEN** a selectize autocomplete dropdown appears with matching results

---

### Requirement: Font Awesome 4 vendor copy removed
The directory `public/vendor/font-awesome/` (Font Awesome 4.x CSS copy) SHALL NOT exist. The sole Font Awesome installation SHALL be the `@fortawesome/fontawesome-free` npm package bundled via webpack.

#### Scenario: FA4 vendor directory absent
- **WHEN** the `public/vendor/` directory is listed
- **THEN** no `font-awesome/` subdirectory exists

#### Scenario: Icons still render after vendor copy removal
- **WHEN** the editor is opened in a browser
- **THEN** toolbar icons (pan, zoom, templates, export) are visually rendered and not blank

