## 1. Audit and Remove Dead Vendor Files

- [x] 1.1 Grep source and `localEditor.html` to confirm `FamilyContentTopMenu.js`, `Skin.js/.css`, `actionButtons.js`, `fullScreen.js/.css`, `lock.js`, `colibri.css`, `xwiki-min.css`, `Widgets.css` are not referenced by our TypeScript source
- [x] 1.2 Remove confirmed-unused files from `public/vendor/` and from `localEditor.html` `<script>`/`<link>` tags
- [x] 1.3 Verify: `npm run build` exits 0, `npm test` 27 passing

## 2. jQuery from node_modules

- [x] 2.1 Update `localEditor.html` to load jQuery from `node_modules/jquery/dist/jquery.min.js` instead of `public/vendor/jquery-3.7.1.min.js`
- [x] 2.2 Delete `public/vendor/jquery-3.7.1.min.js`
- [x] 2.3 Verify: `npm run build` exits 0, editor loads in browser with jQuery available

## 3. Configurable Service URLs

- [x] 3.1 Add `omimServiceUrl` and `hpoServiceUrl` optional properties to the options object accepted by `PedigreeEditor` constructor in `pedigree.ts`; store on `editor` and expose via getter methods
- [x] 3.2 Replace `XWiki.Document('OmimService', 'PhenoTips').getURL(...)` in `disorder.ts` with `editor.getOmimServiceUrl()`
- [x] 3.3 Replace `XWiki.Document('SolrService', 'PhenoTips').getURL(...)` in `hpoTerm.ts` with `editor.getHpoServiceUrl()`
- [x] 3.4 Replace `XWiki.Document` URL construction in `pedigree.ts` CTSS options with the new getter methods
- [x] 3.5 Update `localEditor.html` to pass service URLs via editor options (or leave empty for standalone use)
- [x] 3.6 Verify: `grep -rn "XWiki\.Document" src/script/` produces no output; `npm run build` exits 0

## 4. Native Zoom Slider

- [x] 4.1 Replace the `Control.Slider` zoom widget in `workspace.ts` with a native `<input type="range">` element; wire its `input` event to the same zoom update logic
- [x] 4.2 Adjust CSS for the range input to match the existing zoom slider appearance
- [x] 4.3 Delete `public/vendor/scriptaculous/slider.js`; remove its `<script>` tag from `localEditor.html`
- [x] 4.4 Verify: `grep -rn "Control\.Slider" src/script/` produces no output; zoom slider works in browser; `npm run build` exits 0

## 5. Flatpickr Date Picker

- [x] 5.1 Add `flatpickr` to `package.json` dependencies and run `npm install`
- [x] 5.2 Replace `new XWiki.widgets.DateTimePicker(...)` in `nodeMenu.ts` with a flatpickr initialisation on the date input fields; wire the `onChange` callback to the existing date field event mechanism
- [x] 5.3 Import flatpickr CSS in the relevant CSS/SCSS file so it is bundled
- [x] 5.4 Delete `public/vendor/phenotips/DateTimePicker.js` and `DateTimePicker.css`; remove their tags from `localEditor.html`
- [x] 5.5 Verify: `grep -rn "DateTimePicker\|XWiki\.widgets" src/script/` produces no output; date fields open flatpickr calendar; `npm run build` exits 0

## 6. Replace Prototype DOM Construction

- [x] 6.1 Replace all `new (Element as any)(tag, attrs)` / `new Element(tag, attrs)` calls in `view/nodeMenu.ts` with `document.createElement` + attribute assignment
- [x] 6.2 Replace all `new (Element as any)(...)` calls in `view/workspace.ts`
- [x] 6.3 Replace all `new (Element as any)(...)` calls in `view/legend.ts`, `disorderLegend.ts`, `phenotypeLegend.ts`, `geneLegend.ts`
- [x] 6.4 Replace all `new (Element as any)(...)` calls in remaining view files (`nodetypeSelectionBubble.ts`, `templateSelector.ts`, `importSelector.ts`, `exportSelector.ts`)
- [x] 6.5 Verify: `grep -rn "new (Element\|new Element" src/script/` produces no output; `npm run build` exits 0; `npm test` 30 passing

## 7. Replace Prototype DOM Manipulation Methods

- [x] 7.1 Replace `.insert()`, `.update()`, `.select()`, `.up()`, `.down()` Prototype calls in `view/nodeMenu.ts` with native DOM equivalents
- [x] 7.2 Replace `.addClassName()`, `.removeClassName()`, `.hasClassName()`, `.setStyle()`, `.getStyle()`, `.show()`, `.hide()` calls in `view/nodeMenu.ts`
- [x] 7.3 Replace Prototype DOM manipulation methods in `view/workspace.ts`
- [x] 7.4 Replace Prototype DOM manipulation methods in all legend files (`legend.ts`, `disorderLegend.ts`, `phenotypeLegend.ts`, `geneLegend.ts`)
- [x] 7.5 Replace Prototype DOM manipulation methods in all hoverbox files (`abstractHoverbox.ts`, `personHoverbox.ts`, `partnershipHoverbox.ts`)
- [x] 7.6 Replace Prototype DOM manipulation methods in remaining view files (`templateSelector.ts`, `importSelector.ts`, `exportSelector.ts`, `nodetypeSelectionBubble.ts`)
- [x] 7.7 Replace Prototype Array extensions (`.each`, `.invoke`, `.without` on arrays) across all files
- [x] 7.8 Verify: `npm run build` exits 0; `npm test` 30 passing

## 8. Replace Prototype Event System

- [x] 8.1 Replace all `document.observe(eventName, handler)` calls in `controller.ts` with `document.addEventListener(eventName, handler)`; update all `event.memo` reads to `event.detail`
- [x] 8.2 Replace all `document.fire(eventName, memo)` calls in `saveLoadEngine.ts`, `undoRedo.ts`, hoverbox files, and any other files with `document.dispatchEvent(new CustomEvent(eventName, { detail: memo }))`
- [x] 8.3 Replace `.observe()` / `.stopObserving()` on DOM elements in `nodeMenu.ts`, `nodetypeSelectionBubble.ts`, `pedigree.ts` with `addEventListener` / `removeEventListener`
- [x] 8.4 Replace all `.bindAsEventListener(this)` calls with `.bind(this)` or arrow functions
- [x] 8.5 Verify: `grep -rn "document\.observe\|document\.fire\|\.observe(\|\.stopObserving(\|event\.memo\|bindAsEventListener" src/script/` produces no output; `npm run build` exits 0; `npm test` 30 passing

## 9. Replace Ajax.Request with fetch()

- [x] 9.1 Replace `new Ajax.Request(...)` in `terminology/abstractAjaxTerminology.ts` with `fetch()`; map `onSuccess`/`onFailure`/`onComplete` callbacks to `.then()`/`.catch()`/`.finally()`; create fake `{ responseText }` response for subclass compatibility
- [x] 9.2 Replace `new Ajax.Request(...)` in `disorder.ts` and `hpoTerm.ts` with `fetch()`
- [x] 9.3 Replace `new Ajax.Request(...)` in `saveLoadEngine.ts` with `fetch()`; parse XML response with DOMParser
- [x] 9.4 Replace any remaining `Ajax.Request` or `Ajax.Responders` references
- [x] 9.5 Verify: `grep -rn "Ajax\." src/script/` produces no output; `npm run build` exits 0; `npm test` 30 passing

## 10. Remove Prototype and Remaining Scriptaculous

- [x] 10.1 Remove `public/vendor/scriptaculous/effects.js` and `dragdrop.js` (confirm unused by source); remove their `<script>` tags from `localEditor.html`
- [x] 10.2 Delete `public/vendor/prototype-1.7.3.js`; remove its `<script>` tag from `localEditor.html`
- [x] 10.3 Remove `public/vendor/xwiki/xwiki-min.js` (confirm unused after task 3); remove from `localEditor.html`
- [x] 10.4 Remove `Prototype`, `$$`, `$`, `$F`, `Class` from `webpack.config.js` externals (they are no longer globals provided by the host)
- [x] 10.5 Update `src/types/prototype.d.ts` to remove Prototype ambient declarations; keep only `editor` and `jQuery` globals
- [x] 10.6 Replace `PhenoTips.widgets.ModalPopup` in `templateSelector.ts`, `importSelector.ts`, `exportSelector.ts` with native `NativeModal` class; remove `Widgets.js` from vendor and `localEditor.html`; replace `document.observe('dom:loaded')` in `localEditor.html` with `addEventListener('DOMContentLoaded')`
- [x] 10.7 Verify: `npm run build` exits 0; `npm test` 30 passing; browser loads without Prototype
- [x] 10.8 Commit the completed migration
