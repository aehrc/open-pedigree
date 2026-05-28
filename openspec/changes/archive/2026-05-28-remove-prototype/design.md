## Context

Open Pedigree's source code (now fully TypeScript) still uses PrototypeJS and Scriptaculous at runtime for DOM manipulation, custom events, AJAX, and the zoom slider. These libraries are vendor-copied, abandonware, and unmanaged by npm. jQuery is already an npm dependency (`^3.7.1`) but served from a vendor copy. The goal is to remove all of these in favour of native browser APIs, `fetch()`, and small focused npm packages.

The host environment (REDCap, XWiki, or standalone `localEditor.html`) previously provided Prototype and XWiki platform libraries as script tags. After this change, the pedigree editor will only require jQuery to be present on the host page (as before), and everything else is either bundled or native.

## Goals / Non-Goals

**Goals:**
- Remove `prototype-1.7.3.js` and all three Scriptaculous files from `public/vendor/`
- Remove `jquery-3.7.1.min.js` vendor copy; host page loads jQuery from `node_modules` build or CDN
- Remove `xwiki-min.js` and all other XWiki/PhenoTips vendor files unused in our source
- Replace all Prototype DOM/event/AJAX API call sites in our TypeScript source with native equivalents
- Replace `Control.Slider` with a native `<input type="range">`
- Replace `XWiki.widgets.DateTimePicker` with flatpickr
- Replace `XWiki.Document(...).getURL()` URL building with configurable options
- Build and all 27 unit tests pass after each phase

**Non-Goals:**
- Removing jQuery itself (it stays as an external loaded by the host page)
- Changing the public `OpenPedigree.initialiseEditor()` API shape beyond adding new optional URL options
- Replacing Raphaël (separate concern)
- Modifying REDCap module PHP to serve dependencies differently (out of scope here)

## Decisions

### D1: Replace Prototype DOM methods with native browser APIs (not jQuery)

Prototype's `.insert()`, `.update()`, `.addClassName()`, `new Element()`, etc. all have direct native equivalents in modern browsers (`appendChild`, `insertAdjacentHTML`, `classList.add`, `document.createElement`). Using native APIs avoids introducing a jQuery DOM-manipulation dependency in the source code and makes the code readable without knowing jQuery's API.

*Alternative considered: use jQuery `$('<div>')`, `.addClass()`, `.append()` etc.* — jQuery is already an external on the page, so this would work, but it would create a runtime coupling to jQuery in the application source. Native APIs are preferred.

### D2: Replace `document.observe/fire` with native `CustomEvent` + `addEventListener`

Prototype's `document.observe('pedigree:x', handler)` maps directly to `document.addEventListener('pedigree:x', handler)`. Prototype's `document.fire('pedigree:x', memo)` maps to `document.dispatchEvent(new CustomEvent('pedigree:x', { detail: memo }))`. The memo object access changes from `event.memo` to `event.detail`.

This is the most pervasive change (~62 observer/fire sites) but is entirely mechanical.

### D3: Replace `Ajax.Request` with `fetch()`

`fetch()` is native, promise-based, and supported in all target browsers. The Prototype callback pattern (`onSuccess`, `onFailure`, `onComplete`) maps to `.then()` / `.catch()` / `.finally()`. The response object shape changes: `response.responseText` → `await response.text()`.

*Alternative: jQuery `$.ajax()`* — would work but adds jQuery coupling to server I/O code.

### D4: Replace `Control.Slider` with native `<input type="range">`

The zoom slider in `workspace.ts` uses only basic Scriptaculous slider functionality (set value, onChange callback). A native range input with an `input` event listener covers this with zero dependencies.

### D5: Replace `XWiki.widgets.DateTimePicker` with flatpickr

flatpickr is actively maintained, has no dependencies, supports the date-only mode needed by the node menu, and integrates with existing `<input>` fields. It is the smallest footprint npm option for this use case.

*Alternative: `react-datepicker`, `pikaday`* — heavier or framework-dependent.

### D6: Replace `XWiki.Document(...).getURL()` with constructor options

The three call sites build OMIM/HPO/CTSS service URLs. These URLs are already configurable via `initialiseEditor()` options in the REDCap module — the XWiki-specific code is dead in that context. Adding `omimServiceUrl` and `hpoServiceUrl` options (with the XWiki URL as the default when running in XWiki) makes the editor fully host-agnostic.

### D7: Migrate jQuery vendor copy to node_modules

`localEditor.html` currently loads `/public/vendor/jquery-3.7.1.min.js`. After this change it will load from `node_modules/jquery/dist/jquery.min.js` (symlinked or copied via a small webpack asset). jQuery stays as a webpack external (`{ jquery: 'jQuery' }`) — the bundle does not include it, but the host page no longer needs a separate CDN.

## Risks / Trade-offs

- **`event.memo` → `event.detail`** — All controller event handlers read `event.memo`; these must all be updated when `document.observe` is replaced. Missing one causes silent undefined access. → Mitigation: text-search for `.memo` after migration and verify 0 remaining occurrences.
- **Prototype array extensions** — `Array#each`, `Array#invoke`, `Array#detect`, `Array#select` are used in some view code. These must be replaced with `.forEach`, `.map`, `.find`, `.filter`. → Mitigation: grep for `.each(`, `.invoke(`, `.detect(`, `.select(` after migration.
- **`Element#up/down/previous/next`** — Prototype DOM traversal methods; must be replaced with `closest`, `querySelector`, `previousElementSibling`, `nextElementSibling`. → Mitigation: grep for `.up(`, `.down(` after migration.
- **XWiki platform files** — `Widgets.js`, `Skin.js`, `FamilyContentTopMenu.js`, `actionButtons.js`, `lock.js`, `fullScreen.js` are loaded by `localEditor.html` but may be needed in the full PhenoTips/XWiki deployment. Removing them from the vendor directory removes them from standalone use but does not affect the XWiki deployment (where they are served by the platform). → Mitigation: remove from `localEditor.html` only; document that the XWiki host provides them.

## Migration Plan

Execute in seven phases, each independently buildable and testable:

1. **Audit dead vendor files** — confirm which vendor files are unreferenced by our source; remove from `localEditor.html` and `public/vendor/`
2. **jQuery from node_modules** — update `localEditor.html` to load from `node_modules`; delete vendor copy
3. **Replace `XWiki.Document` URL building** — add options, remove XWiki dependency from source
4. **Replace `Control.Slider`** — native range input in `workspace.ts`
5. **Replace `DateTimePicker`** — add flatpickr, update `nodeMenu.ts`
6. **Replace Prototype DOM/event/AJAX** — the large migration across all view/controller files; verify with build + tests after each file
7. **Remove Prototype + Scriptaculous** — delete vendor files, remove from `localEditor.html`, clean webpack config

Rollback: each phase is a separate commit; reverting is a `git revert`.
