## ADDED Requirements

### Requirement: Service URLs are configurable via initialiseEditor options
The pedigree editor SHALL accept `omimServiceUrl` and `hpoServiceUrl` as optional properties in the options object passed to `OpenPedigree.initialiseEditor()`. When provided, these URLs SHALL be used directly by `Disorder` and `HPOTerm` instead of constructing them via `XWiki.Document`. When not provided, the editor SHALL fall back to a sensible default (empty string or a configurable constant), logging a warning if the OMIM/HPO terminology is used without a URL.

#### Scenario: Custom service URL used for disorder lookup
- **WHEN** `initialiseEditor({ omimServiceUrl: 'https://example.com/omim' })` is called
- **THEN** `Disorder` uses `'https://example.com/omim'` as its base URL for AJAX lookups

#### Scenario: Custom service URL used for HPO lookup
- **WHEN** `initialiseEditor({ hpoServiceUrl: 'https://example.com/hpo' })` is called
- **THEN** `HPOTerm` uses `'https://example.com/hpo'` as its base URL for AJAX lookups

#### Scenario: No remaining XWiki.Document reference in source
- **WHEN** `grep -rn "XWiki\.Document\|XWiki\.currentWiki" src/script/` is run
- **THEN** it produces no output

### Requirement: XWiki vendor files removed from localEditor.html
`public/vendor/xwiki/xwiki-min.js`, `xwiki-min.css`, `colibri.css`, `fullScreen.js`, `fullScreen.css`, `actionButtons.js`, and `public/vendor/lock/lock.js` SHALL be deleted or confirmed unused and removed from `localEditor.html`. `public/vendor/phenotips/FamilyContentTopMenu.js`, `Skin.js`, and `Skin.css` SHALL likewise be removed from `localEditor.html`.

#### Scenario: localEditor.html loads without XWiki platform files
- **WHEN** `localEditor.html` is opened without any XWiki vendor script tags
- **THEN** the editor initialises and the pedigree canvas renders correctly

### Requirement: Prototype removed from vendor and host page
`public/vendor/prototype-1.7.3.js` SHALL be deleted. The `<script>` tag loading it in `localEditor.html` SHALL be removed.

#### Scenario: Build succeeds without Prototype
- **WHEN** `npm run build` is run after Prototype is deleted and all source call sites are migrated
- **THEN** the build exits 0

#### Scenario: All tests pass without Prototype
- **WHEN** `npm test` is run after Prototype is removed
- **THEN** all 27 unit tests pass
