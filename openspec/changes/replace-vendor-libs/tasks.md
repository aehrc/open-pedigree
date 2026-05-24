## 1. Font Awesome Vendor Cleanup

- [x] 1.1 Delete `public/vendor/font-awesome/` directory entirely
- [x] 1.2 Verify `npm run build` exits 0 and no HTML file references the deleted directory
- [x] 1.3 Verify `npm test` (27 passing) and `npm run test:e2e` (7 passing)

## 2. pdfkit, blob-stream, svg-to-pdfkit

- [x] 2.1 Run `npm install pdfkit blob-stream svg-to-pdfkit` and confirm packages install cleanly
- [x] 2.2 Verify the standalone browser build path: confirm `node_modules/pdfkit/js/pdfkit.standalone.js` exists
- [x] 2.3 Update `src/script/model/export.js`: change `from 'vendor/pdfkit/pdfkit.standalone'` → `from 'pdfkit/js/pdfkit.standalone'`
- [x] 2.4 Update `src/script/model/export.js`: change `from 'vendor/pdfkit/svg-to-pdfkit'` → `from 'svg-to-pdfkit'`
- [x] 2.5 Update `src/script/model/export.js`: change `from 'vendor/pdfkit/blob-stream'` → `from 'blob-stream'`
- [x] 2.6 Delete `public/vendor/pdfkit/` directory
- [x] 2.7 Run `npm run build` — confirm exit 0
- [x] 2.8 Run `npm test` — confirm 27 passing (export.js is imported by unit tests indirectly)
- [x] 2.9 Manually verify PDF export works in the browser (open dev server, export a pedigree as PDF)

## 3. file-saver

- [x] 3.1 Run `npm install file-saver` and confirm it installs cleanly
- [x] 3.2 Add `import { saveAs } from 'file-saver';` at the top of `src/script/view/exportSelector.js`
- [x] 3.3 Remove the `<script>` tag for `public/vendor/filesaver/FileSaver.js` from `localEditor.html`
- [x] 3.4 Remove the `<script>` tag for `public/vendor/filesaver/Blob.js` from `localEditor.html`
- [x] 3.5 Remove the same `<script>` tags from `index.html` if present
- [x] 3.6 Delete `public/vendor/filesaver/` directory
- [x] 3.7 Run `npm run build` — confirm exit 0
- [x] 3.8 Run `npm run test:e2e` — confirm all 7 E2E tests pass (PED and GA4GH download tests are the key signal)

## 4. urijs

- [x] 4.1 Run `npm install urijs` and confirm it installs cleanly
- [x] 4.2 Add `import URI from 'urijs';` at the top of `src/script/localStorageBackend.js`
- [x] 4.3 Remove the `<script>` tag for `public/vendor/URI.js` from `localEditor.html`
- [x] 4.4 Remove the same `<script>` tag from `index.html` if present
- [x] 4.5 Delete `public/vendor/URI.js`
- [x] 4.6 Run `npm run build` — confirm exit 0
- [x] 4.7 Run `npm test` — confirm 27 passing

## 5. @selectize/selectize

- [x] 5.1 Run `npm install @selectize/selectize` and confirm it installs cleanly
- [x] 5.2 Add `jquery: 'jQuery'` to the `externals` array in `webpack.config.js`
- [x] 5.3 Replace the selectize CSS import in `src/app.js`: change `'../public/vendor/selectize/selectize.default.css'` → `'@selectize/selectize/dist/css/selectize.default.css'`
- [x] 5.4 Add `import '@selectize/selectize';` in `src/app.js` (or `src/script/view/nodeMenu.js`) so webpack bundles the selectize plugin and registers it on jQuery
- [x] 5.5 Remove the `<script>` tag for `public/vendor/selectize/selectize.js` from `localEditor.html`
- [x] 5.6 Remove the same `<script>` tag from `index.html` if present
- [x] 5.7 Delete `public/vendor/selectize/` directory
- [x] 5.8 Run `npm run build` — confirm exit 0
- [x] 5.9 Run `npm run test:e2e` — confirm all 7 E2E tests pass
- [ ] 5.10 Manually verify autocomplete in the browser: open the dev server, select a person node, type in a disorder/phenotype/gene field, confirm the dropdown appears

## 6. Final Validation

- [x] 6.1 Run `npm audit` — confirm zero high/critical vulnerabilities
- [x] 6.2 Confirm `public/vendor/` no longer contains `font-awesome/`, `filesaver/`, `pdfkit/`, `URI.js`, or `selectize/`
- [x] 6.3 Run `npm run build` — confirm `dist/pedigree.min.js` produced, exit 0
- [x] 6.4 Run `npm test` — confirm all 30 unit tests pass
- [x] 6.5 Run `npm run test:e2e` — confirm all 7 E2E tests pass
- [ ] 6.6 Commit the completed migration
