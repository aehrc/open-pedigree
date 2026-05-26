## Why

Files hand-copied into `public/vendor/` are invisible to `npm audit` and must be updated manually — security fixes land last or not at all. Several of these libraries have maintained npm packages available; moving them to npm puts them under the same automated vulnerability scanning and `npm outdated` visibility as every other dependency. Doing this before the TypeScript migration reduces the `vendor/` webpack alias surface area and gives the migration access to proper `@types/*` declarations.

## What Changes

- **Remove** `public/vendor/font-awesome/` — already replaced by `@fortawesome/fontawesome-free` npm package; this is a dead vendor copy. Fulfils the existing `vendor-library-versions` spec requirement.
- **Replace** `public/vendor/pdfkit/pdfkit.standalone.js` with the standalone browser build bundled in the `pdfkit` npm package; import via `pdfkit/js/pdfkit.standalone` instead of the `vendor/` alias.
- **Replace** `public/vendor/pdfkit/blob-stream.js` with npm `blob-stream`; import directly.
- **Replace** `public/vendor/pdfkit/svg-to-pdfkit.js` with npm `svg-to-pdfkit`; import directly.
- **Replace** `public/vendor/filesaver/FileSaver.js` + `Blob.js` (script-tag globals) with npm `file-saver`; import `saveAs` directly in `exportSelector.js`; remove the two `<script>` tags from `localEditor.html` and `index.html`.
- **Replace** `public/vendor/URI.js` (script-tag global) with npm `urijs`; import `URI` in `localStorageBackend.js`; remove the `<script>` tag.
- **Replace** `public/vendor/selectize/` (script-tag jQuery plugin) with npm `@selectize/selectize`; bundle via webpack; import CSS from the npm package in `src/app.js`; add `jquery: 'jQuery'` to webpack externals so the bundled selectize finds the page-loaded jQuery; remove the `<script>` tag and the existing CSS import from vendor alias.

**Not in scope:**
- jQuery — stays as vendor script tag; too tightly coupled to the PrototypeJS `$` coexistence arrangement.
- PrototypeJS + Scriptaculous — tied to the TypeScript migration and eventual event bus replacement.
- `public/vendor/phenotips/`, `public/vendor/xwiki/`, `public/vendor/lock/` — proprietary or XWiki-specific; no npm equivalent.

## Capabilities

### New Capabilities
- `npm-managed-libs`: requirements covering all six libraries now managed via npm — pdfkit trio, file-saver, urijs, and @selectize/selectize — including that no `public/vendor/` copy exists for any of them and that all affected features continue to work.

### Modified Capabilities
- `vendor-library-versions`: REMOVE the requirements for URI.js, FileSaver.js, and Selectize (those vendor files will no longer exist); the font-awesome removal requirement is being fulfilled by this change, not changed. jQuery, PrototypeJS/Scriptaculous, and XWiki/PhenoTips requirements are unchanged.

## Impact

- **`package.json`**: add `pdfkit`, `blob-stream`, `svg-to-pdfkit`, `file-saver`, `urijs`, `@selectize/selectize` as dependencies
- **`webpack.config.js`**: add `jquery: 'jQuery'` to externals so bundled selectize finds the page-global jQuery
- **`src/script/model/export.js`**: update three import paths from `vendor/pdfkit/...` to npm package names
- **`src/script/view/exportSelector.js`**: add `import { saveAs } from 'file-saver'`; remove reliance on `saveAs` global
- **`src/script/localStorageBackend.js`**: add `import URI from 'urijs'`; remove reliance on `URI` global
- **`src/app.js`**: update selectize CSS import from vendor alias to `@selectize/selectize/dist/css/selectize.default.css`
- **`localEditor.html`** (and `index.html` if applicable): remove `<script>` tags for FileSaver/Blob.js, URI.js, Selectize
- **`public/vendor/`**: remove `font-awesome/`, `filesaver/`, `pdfkit/`, `URI.js`, `selectize/` entirely
