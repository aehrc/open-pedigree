## Context

The project is a webpack 4 build producing `dist/pedigree.min.js`. The host page (REDCap or `index.html`) loads PrototypeJS, jQuery, Scriptaculous, and other vendor libs via `<script>` tags before the bundle; these are declared as webpack externals and must never be bundled. The build was last updated in 2020 and now carries 104 known npm vulnerabilities. The REDCap external module review process requires all packages to be current before accepting an update.

There are two separate dependency surfaces:
1. **npm devDependencies** — the webpack toolchain (build-time only; none ship to the browser except their compiled output)
2. **Vendor library copies** — files in `public/vendor/` that are loaded directly by the host HTML; these are not managed by npm at all

## Goals / Non-Goals

**Goals:**
- Upgrade all npm devDependencies to current stable versions, eliminating known vulnerabilities
- Migrate webpack config from v4 API to v5 API, preserving identical output (`dist/pedigree.min.js`)
- Replace `node-sass` with `sass` (dart-sass) and update `sass-loader` accordingly
- Replace `file-loader` with webpack 5 native asset modules
- Replace `style-loader` 0.x with current version
- Upgrade webpack-dev-server 3 → 5 (breaking config changes)
- Upgrade eslint 5 → 9 with new flat config format
- Upgrade @fortawesome/fontawesome-free 5 → 6, fixing import paths
- Replace jQuery 3.4.1 in `public/vendor/` with 3.7.x (patches CVE-2020-11022/11023)
- Update URI.js, Selectize, and FileSaver.js vendor copies to current releases
- Clarify and resolve the dual Font Awesome situation (vendor FA4 vs npm FA5/6)

**Non-Goals:**
- Upgrading PrototypeJS or Scriptaculous (effectively abandonware; no upstream releases)
- Replacing XWiki or PhenoTips vendor scripts (custom project code, no public package)
- Changing any application behaviour or `src/script/` logic
- Adding a test suite
- Moving vendor libs from `public/vendor/` into npm management

## Decisions

### D1: Webpack 4 → 5 migration approach
**Decision**: Migrate `webpack.config.js` in-place; keep the single config file, not split into dev/prod.

The current config has no `mode` handling split. Webpack 5 is largely backwards-compatible for simple configs, but three specific changes are required:
- `file-loader` rule → `type: 'asset/resource'` with `generator.filename`
- `devServer.contentBase` → `devServer.static`
- `optimization.minimizer` TerserPlugin import changes (now provided by webpack 5 itself, but explicit plugin still needed for `reserved: ['$super']`)

**Alternative considered**: Split into `webpack.config.dev.js` / `webpack.config.prod.js`. Rejected — adds complexity with no benefit for a single-output project.

### D2: node-sass → sass (dart-sass)
**Decision**: Replace `node-sass` with `sass` package and upgrade `sass-loader` to 16.x.

`node-sass` is deprecated and does not support Node.js 18+. Dart sass is the reference implementation, API-compatible for the SCSS used in this project (no advanced `@use`/`@forward` features). The `sass-loader` API change: the `implementation` option is no longer required (auto-detected).

### D3: file-loader removal
**Decision**: Replace the `file-loader` rule for PNG/SVG/JPG/GIF with webpack 5 asset modules (`type: 'asset/resource'`).

Webpack 5 includes asset modules natively. The `outputPath` / `publicPath` behaviour maps directly to `generator.filename` and `output.assetModuleFilename`. This eliminates one vulnerable package entirely.

### D4: eslint 5 → 9 config format
**Decision**: Migrate `.eslintrc` to `eslint.config.js` (flat config, the only format supported by ESLint 9).

ESLint 9 dropped support for the legacy `.eslintrc` format. The current `.eslintrc` is minimal — this migration is straightforward. `@eslint/js` provides the replacement for the `eslint:recommended` ruleset.

**Alternative considered**: Use ESLint 8 (still supports `.eslintrc`). Rejected — ESLint 8 is at end of maintenance; using 9 future-proofs the upgrade.

### D5: Font Awesome consolidation
**Decision**: Keep npm FA6 as the primary source (bundled via webpack); remove the unused vendor FA4 copy (`public/vendor/font-awesome/`).

Investigation shows:
- `src/app.js` imports `@fortawesome/fontawesome-free/js/fontawesome` and `@fortawesome/fontawesome-free/js/solid` — this is the live source for icons
- `workspace.js` uses `fa fa-*` class names — these are FA5/6 compatible with the JS-based approach
- The vendor FA4 CSS copy (`public/vendor/font-awesome/`) is not referenced in `index.html` or `localEditor.html`; it appears to be an unused leftover

**Risk**: If any icon classes used in the app were removed between FA4 and FA6, they will silently fail. Verify icon names post-upgrade.

### D6: Vendor library update strategy
**Decision**: Replace vendor files in-place (same filename, new content). Do not rename files to include version numbers.

`index.html` and `localEditor.html` reference filenames like `jquery-3.4.1.min.js` — this filename must be updated. For other vendor libs (URI.js, selectize.js, FileSaver.js) the filenames are version-agnostic.

**Exception for jQuery**: The filename `jquery-3.4.1.min.js` must be updated to `jquery-3.7.1.min.js` (or similar), and the `<script>` src in both HTML files updated accordingly.

### D7: Selectize upgrade caution
**Decision**: Upgrade Selectize 0.12.6 → 0.15.x but treat as higher-risk; test autocomplete UI after upgrade.

Selectize 0.15 introduced breaking changes in plugin API and event names. The project uses Selectize for disorder/phenotype/gene autocomplete widgets (via PhenoTips `Widgets.js`). The `Widgets.js` is custom code not managed by npm, so any Selectize API break will require a corresponding fix in `public/vendor/phenotips/Widgets.js`.

## Risks / Trade-offs

- **webpack 5 asset module output paths**: The `publicPath: 'dist/assets'` in the old `file-loader` config ensures bundled assets resolve correctly when the script is loaded from a parent page. This must be preserved exactly in the asset module generator config or assets will 404 in REDCap.  
  → Mitigation: Test the built bundle in `localEditor.html` before declaring done.

- **Selectize 0.15 breaking changes** may break autocomplete in `Widgets.js`.  
  → Mitigation: Test disorder/phenotype/gene search after vendor update; be prepared to patch `Widgets.js`.

- **FA6 icon name changes**: Some icon names changed between FA4/5 and FA6. The `fa-search-plus`, `fa-search-minus`, `fa-arrow-*`, `fa-user` icons used in `workspace.js` are available in FA6 Solid, but the class API changes from `fa fa-*` to `fas fa-*`.  
  → Mitigation: Update class references in `workspace.js` when upgrading to FA6, or use the FA6 compatibility shim.

- **eslint 9 flat config**: The flat config format is significantly different from `.eslintrc`. If any custom rules or plugins are present, they need compat wrappers.  
  → Mitigation: Current `.eslintrc` is simple (extends `eslint:recommended` only) — migration risk is low.

## Migration Plan

Upgrade in this order to isolate failures:

1. **Vendor library copies** (independent of build toolchain)  
   - jQuery 3.4.1 → 3.7.x (update HTML script tags)  
   - URI.js 1.19.2 → 1.19.6  
   - FileSaver.js → latest  
   - Selectize 0.12.6 → 0.15.x (test autocomplete after)  
   - Remove unused vendor FA4 copy  

2. **Font Awesome npm package** (isolated to `src/app.js` imports)  
   - Upgrade `@fortawesome/fontawesome-free` 5 → 6  
   - Update import paths and icon class names  

3. **Sass toolchain** (isolated change: node-sass → sass + sass-loader upgrade)  
   - `npm remove node-sass; npm install --save-dev sass sass-loader@latest`  
   - Verify SCSS compiles  

4. **Webpack core + loaders** (the highest-risk step)  
   - Upgrade webpack 4 → 5, webpack-cli 3 → 6  
   - Migrate webpack.config.js (asset modules, devServer.static)  
   - Upgrade css-loader, style-loader, html-webpack-plugin  
   - Remove file-loader  
   - Verify `npm run build` produces `dist/pedigree.min.js`  
   - Verify `npm start` dev server works  

5. **Babel** (upgrade @babel/core, @babel/preset-env, babel-loader)  
   - Minor compatibility risk; test build output  

6. **ESLint** (5 → 9, config format migration)  
   - Migrate `.eslintrc` → `eslint.config.js`  
   - Verify `npx eslint src/` runs clean  

7. **Terser-webpack-plugin** (upgrade 2 → 5)  
   - Ensure `reserved: ['$super']` mangle config still applies  

**Rollback**: Each step is a separate commit on `dependency-upgrade` branch. Roll back by reverting individual commits.

## Open Questions

- **Selectize compatibility**: Will `public/vendor/phenotips/Widgets.js` need changes for Selectize 0.15? Needs hands-on testing — cannot determine from source alone.
- **FA6 class names**: Does the REDCap deployment load its own Font Awesome that conflicts with the bundled FA6? The JS-based FA6 approach injects inline SVG; CSS-based FA loaded separately by REDCap may conflict.
- **PrototypeJS 1.7.3**: No upstream updates exist. The REDCap reviewer may flag this as out of date regardless — may need a discussion with the reviewer about abandonware exceptions.
