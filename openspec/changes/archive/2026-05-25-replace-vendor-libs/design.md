## Context

Seven vendor library copies live in `public/vendor/` and are loaded either as webpack-bundled imports (pdfkit trio, via the `vendor/` webpack alias) or as `<script>` tags that expose globals (FileSaver/Blob, URI.js, Selectize). Font Awesome is already duplicated — the npm `@fortawesome/fontawesome-free` package is the live copy; the `public/vendor/font-awesome/` directory is dead. jQuery and Selectize are loaded as script tags before PrototypeJS to avoid the `$` symbol conflict; Selectize uses jQuery as a plugin.

The E2E test suite (7 Playwright tests, including PED and GA4GH export downloads) provides the safety net for verifying export functionality survives the file-saver migration. The unit tests (30 Vitest) cover the model layer, which includes the pdfkit-dependent PDF export path in `model/export.js`.

## Goals / Non-Goals

**Goals:**
- All six targeted libraries (`pdfkit`, `blob-stream`, `svg-to-pdfkit`, `file-saver`, `urijs`, `@selectize/selectize`) managed via npm, with no corresponding copy in `public/vendor/`
- `npm audit` covers all six libraries post-migration
- `public/vendor/font-awesome/` deleted (dead code)
- All existing tests pass; PDF, PED, and GA4GH export still work in the browser

**Non-Goals:**
- Moving jQuery to npm (PrototypeJS `$` conflict; deferred)
- Removing PrototypeJS or Scriptaculous
- Touching `public/vendor/phenotips/`, `xwiki/`, `lock/`
- Adding types for the newly-npm-managed libraries (handled during TypeScript migration)

## Decisions

### D1: pdfkit — use the standalone browser build inside the npm package

The `pdfkit` npm package ships a pre-compiled browser standalone at `pdfkit/js/pdfkit.standalone.js`. This is exactly what the current vendor file is — a frozen snapshot of that artifact. Importing `from 'pdfkit/js/pdfkit.standalone'` requires no webpack polyfills and keeps the import pattern identical to the current vendor alias. The vendor alias `vendor/pdfkit/pdfkit.standalone` → npm path `pdfkit/js/pdfkit.standalone` is a one-line change in `export.js`.

**Alternative rejected:** Using the main `pdfkit` entry point with `resolve.fallback` polyfills for Node.js `stream`, `buffer`, `path` — adds significant webpack configuration complexity for no functional benefit.

### D2: blob-stream and svg-to-pdfkit — direct npm imports

Both packages are browser-first and have no Node.js dependencies. Import paths change from `vendor/pdfkit/blob-stream` → `blob-stream` and `vendor/pdfkit/svg-to-pdfkit` → `svg-to-pdfkit`. The `vendor/pdfkit/` alias entry in webpack can be removed entirely once all three imports are updated.

### D3: file-saver — webpack import, remove global

`saveAs` is currently a `window.saveAs` global injected by the FileSaver `<script>` tag. After this change, `exportSelector.js` imports it directly: `import { saveAs } from 'file-saver'`. The `Blob.js` polyfill (also loaded via script tag) is unnecessary in any browser that supports the Fetch/Streams baseline — it can be deleted along with FileSaver. The `<script>` tags for both are removed from `localEditor.html` (and `index.html` if present).

**Alternative rejected:** Keeping FileSaver as a script-tag global and just updating the vendor file version — misses the npm audit coverage goal entirely.

### D4: urijs — webpack import, remove global

`URI` is used in exactly one file (`localStorageBackend.js`, two call sites). Adding `import URI from 'urijs'` at the top and removing the `<script>` tag is a self-contained change. The `urijs` package is the maintained successor to the original URI.js.

### D5: @selectize/selectize — webpack import with jQuery declared as external

Selectize is a jQuery plugin; it calls `$.fn.selectize = ...` at load time. jQuery is still loaded as a `<script>` tag global (not moved to npm in this change). The approach:
1. Add `jquery: 'jQuery'` to webpack `externals` so that when `@selectize/selectize` does `require('jquery')` internally, webpack resolves it to the page-global `jQuery` object.
2. Import the selectize JS in `src/app.js` (or `src/script/view/nodeMenu.js`) so webpack bundles it.
3. Replace the vendor CSS import in `src/app.js` with `@selectize/selectize/dist/css/selectize.default.css`.
4. Remove the Selectize `<script>` tag from HTML files.

**Why `@selectize/selectize` not `selectize`:** The original `selectize` npm package is unmaintained (last publish 2017). `@selectize/selectize` is the actively maintained fork starting at 0.15, matching the version in the vendor directory.

### D6: font-awesome vendor copy — just delete it

`public/vendor/font-awesome/` is Font Awesome 4.x. No HTML file loads it via `<script>` or `<link>` tag (confirmed by grep). The npm `@fortawesome/fontawesome-free` (v6) is the sole live copy, imported via `src/app.js`. Deleting the directory fulfils the existing `vendor-library-versions` and `fontawesome-v6` spec requirements without any code changes.

## Risks / Trade-offs

- **[Risk] pdfkit standalone path wrong in npm package** → Mitigation: verify `pdfkit/js/pdfkit.standalone.js` exists after `npm install pdfkit`; fall back to checking `node_modules/pdfkit/` structure before writing import.
- **[Risk] @selectize/selectize can't find jQuery at runtime** → Mitigation: verify webpack `externals: { jquery: 'jQuery' }` causes `require('jquery')` inside the bundled selectize to resolve to `window.jQuery`; test autocomplete in E2E.
- **[Risk] E2E export tests break after file-saver migration** → Mitigation: the existing Playwright download tests (`export-formats.spec.js`) will catch any regression; run them immediately after the file-saver change.
- **[Risk] Blob.js polyfill was actually needed** → Mitigation: Blob is a baseline API in all supported browsers; removing the polyfill is safe. The E2E tests confirm file downloads work.

## Migration Plan

One commit per library group, tests green after each:
1. Delete `public/vendor/font-awesome/` (no code changes needed)
2. pdfkit trio: update three import paths in `export.js`; add npm packages; remove `public/vendor/pdfkit/`
3. file-saver: add import to `exportSelector.js`; remove script tags; delete `public/vendor/filesaver/`; `npm test` + `npm run test:e2e`
4. urijs: add import to `localStorageBackend.js`; remove script tag; delete `public/vendor/URI.js`
5. @selectize/selectize: add externals entry; update imports; remove script tag + vendor CSS; delete `public/vendor/selectize/`
6. Final: `npm audit`, `npm run build`, full test suite

Rollback: each commit is self-contained; reverting a single commit restores the vendor file and removes the npm import.
