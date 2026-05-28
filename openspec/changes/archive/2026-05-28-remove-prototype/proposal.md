## Why

PrototypeJS (v1.7.3) and Scriptaculous (v1.9.0) are abandonware — no releases since 2010 — and are the last remaining vendor-copied libraries not managed by npm. Now that the TypeScript migration has eliminated `Class.create()` and `$super`, the only remaining dependency on Prototype is its runtime DOM/event/AJAX API, which has direct modern equivalents. Removing these libraries reduces security risk, eliminates vendor-copied code, and allows the bundle to fully own its dependency graph.

## What Changes

- **Remove** `public/vendor/prototype-1.7.3.js` — replace all `Ajax.Request`, `document.observe/fire`, `new Element()`, `.insert()`, `.update()`, `.observe()`, `.addClassName()`, `.bindAsEventListener()` usages in source with native DOM APIs and `fetch()`
- **Remove** `public/vendor/scriptaculous/slider.js` — replace `Control.Slider` zoom widget in `workspace.ts` with a native `<input type="range">`
- **Remove** `public/vendor/scriptaculous/effects.js` and `dragdrop.js` — audit whether anything in our source actually calls these; remove if unused
- **Remove** `public/vendor/jquery-3.7.1.min.js` — switch to the npm-managed copy already in `package.json`; load via webpack or from `node_modules` in `localEditor.html`
- **Remove** `public/vendor/xwiki/xwiki-min.js` — replace the `XWiki.Document(...).getURL()` calls used to build service URLs with a configurable option passed at `initialiseEditor()`
- **Remove** `public/vendor/phenotips/DateTimePicker.js/.css` — replace `XWiki.widgets.DateTimePicker` usage in `nodeMenu.ts` with an npm date-picker (flatpickr)
- **Audit and remove** `public/vendor/phenotips/FamilyContentTopMenu.js`, `Skin.js/.css`, `Widgets.css`, `public/vendor/xwiki/actionButtons.js`, `fullScreen.js/.css`, `lock/lock.js`, `xwiki/colibri.css`, `xwiki/xwiki-min.css` — confirm unused in standalone/REDCap context and delete
- **Update** `localEditor.html` to remove all deleted `<script>` and `<link>` tags

## Capabilities

### New Capabilities
- `native-dom-events`: Replace Prototype DOM manipulation and custom event system with native browser APIs — `document.createElement`, `addEventListener`, `dispatchEvent(new CustomEvent(...))`, `fetch()`
- `native-zoom-slider`: Replace Scriptaculous `Control.Slider` zoom control with native `<input type="range">`
- `flatpickr-date-picker`: Replace `XWiki.widgets.DateTimePicker` with flatpickr npm package in the node menu date fields
- `configurable-service-urls`: Replace `XWiki.Document(...).getURL()` calls with URLs passed via `initialiseEditor()` options, making the editor host-agnostic

### Modified Capabilities
- `npm-managed-libs`: jQuery moves from vendor copy to the npm-managed copy (already in `package.json`)
- `vendor-library-versions`: Prototype, Scriptaculous, and XWiki/PhenoTips vendor files are removed entirely

## Impact

- `src/script/view/nodeMenu.ts` — 120+ Prototype DOM call sites; DateTimePicker replacement
- `src/script/view/workspace.ts` — Control.Slider replacement
- `src/script/view/abstractHoverbox.ts`, `personHoverbox.ts`, `partnershipHoverbox.ts` — drag event handling
- `src/script/controller.ts` — all `document.observe` listeners
- `src/script/saveLoadEngine.ts` — `Ajax.Request` + `document.fire`
- `src/script/disorder.ts`, `hpoTerm.ts` — `Ajax.Request` + `XWiki.Document` URL building
- `src/script/terminology/abstractAjaxTerminology.ts` — `Ajax.Request`
- `src/script/pedigree.ts` — `XWiki.Document` URL building
- `public/vendor/` — 13 files/dirs removed
- `localEditor.html` — script/link tags updated
- `webpack.config.js` — remove `jquery` external if bundled; no longer needs Prototype externals
- New npm dependencies: `flatpickr`
