## ADDED Requirements

### Requirement: Font Awesome 6 npm package used
The project SHALL use `@fortawesome/fontawesome-free` version 6.x (not 5.x). Import paths in `src/app.js` SHALL reference FA6 package paths.

#### Scenario: FA6 imported in app entry point
- **WHEN** `src/app.js` is read
- **THEN** the import references `@fortawesome/fontawesome-free` at v6-compatible paths
- **AND** no v5-specific import paths (e.g., `/js/fontawesome`, `/js/solid` without `@6` compatibility) are present that break under v6

### Requirement: Icon classes updated for FA6 compatibility
Icon class references in `src/script/view/workspace.js` SHALL be compatible with Font Awesome 6. FA6 changed the default prefix from `fa` to `fas` for solid icons. All `fa fa-*` class references SHALL be updated to `fas fa-*` or the FA6 compatibility layer SHALL be confirmed to handle the mapping.

#### Scenario: Icons render in dev server
- **WHEN** `npm start` is run and the pedigree editor is opened in a browser
- **THEN** pan controls, zoom controls, and menu icons are visually rendered (not blank/missing)

### Requirement: No duplicate Font Awesome installations
The project SHALL have exactly one Font Awesome installation: the npm FA6 package bundled via webpack. The vendor FA4 CSS copy (`public/vendor/font-awesome/`) SHALL be absent (see vendor-library-versions spec).

#### Scenario: Single FA source
- **WHEN** the browser network tab is observed during editor load
- **THEN** no `font-awesome.min.css` or `fontawesome-webfont.*` files are loaded from `public/vendor/`
