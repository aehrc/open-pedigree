## 1. pedigree:person:set events (controller.ts)

- [x] 1.1 In `src/script/controller.ts`, locate the `pedigree:node:setproperty` handler where `node[propertySetFunction](propValue)` is called
- [x] 1.2 After the setter call, derive the field name: strip leading `set` from `propertySetFunction` and lowercase the remainder
- [x] 1.3 Dispatch `new CustomEvent('pedigree:person:set:' + field, { detail: { node, value: propValue } })` on `document` — but only when the node is a person (check `node.getType() === 'Person'` or equivalent)
- [x] 1.4 Verify the event fires by adding a temporary `document.addEventListener('pedigree:person:set:firstname', ...)` in `localEditor.html` and setting a first name in the editor

## 2. SVG gradient export fix (saveLoadEngine.ts)

- [x] 2.1 In `src/script/saveLoadEngine.ts`, locate where the SVG string is extracted from the canvas element before saving
- [x] 2.2 Add helper functions `escapeRegExp(string)` and `canvasToSvg(element)` that strip `window.location.href` occurrences from the SVG string (port the upstream `uriAsRegex`/`canvasToSvg` approach, replacing Prototype `.down()` with `querySelector` and `.innerHTML` with native equivalent)
- [x] 2.3 Replace the existing SVG extraction call with `canvasToSvg(canvasElement)`
- [x] 2.4 Verify by exporting a pedigree as FHIR or using Save, opening the resulting SVG attachment in a browser — nodes should not be transparent

## 3. Autosave (pedigree.ts)

- [x] 3.1 In `src/script/pedigree.ts`, read `options.autosave` (boolean, default false) in the constructor
- [x] 3.2 If `autosave` is true, add a `document.addEventListener('pedigree:graph:changed', ...)` listener that calls `this._saveLoadEngine.save()` — add this after the save/load engine is initialised
- [x] 3.3 Verify by passing `autosave: true` in `localEditor.html` and confirming that localStorage is updated after each node edit (check via browser devtools)

## 4. Dockerfile

- [x] 4.1 Create `Dockerfile` at the repository root: multi-stage or single-stage Node 24 build that runs `npm ci && npm run build`, then serves the static output on port 9000 using `webpack-dev-server --mode=production --host=0.0.0.0` (matching the existing `npm run start-docker` script)
- [x] 4.2 Update `README.md` to add a Docker section with `docker build` and `docker run` commands (port the upstream README addition)

## 5. Commit and push

- [x] 5.1 Commit all changes to `master` and push; verify the GitHub Pages deploy workflow succeeds
- [x] 5.2 Cherry-pick or apply the same changes to `feature/redcap_em_0.4_upgrade` and push
