## Why

The `aehrc/open-pedigree` fork diverged from `phenotips/open-pedigree` in June 2020. Since then, upstream has merged several bug fixes and features from external contributors that are worth bringing into this fork. A straight `git merge` is impossible because the codebases now differ architecturally (upstream: PrototypeJS + plain JS; ours: TypeScript ES6 + native DOM), so each upstream change must be manually ported.

## What Changes

- **Port `pedigree:person:set:<field>` event** — fire a typed event each time any person property is set via the node menu, so external code (e.g. REDCap) can react to individual field changes in real time.
- **Fix transparent nodes in SVG export** — remove page-URL references from Raphaël-generated gradient IDs in the exported SVG; without this, downloaded SVG files render pedigree nodes as transparent in most viewers.
- **Port autosave option** — add an `autosave` flag to `initialiseEditor` options that triggers a save after every mutating action, useful for integrations that have no explicit Save button.
- **Add Dockerfile** — upstream accepted a Dockerfile from Manchester Centre; add it to the fork so the app can be run as a container.

## Capabilities

### New Capabilities

- `person-set-events`: Fire `pedigree:person:set:<field>` custom DOM events from the controller whenever a person property is updated, carrying `{ node, value }` in the event detail.
- `autosave`: Optional `autosave: true` flag passed to `initialiseEditor` that calls the save backend after every undoable action.
- `dockerfile`: Dockerfile and supporting documentation for containerised deployment.

### Modified Capabilities

- `native-dom-events`: The set of events fired by the controller gains the new `pedigree:person:set:<field>` family.

## Impact

- `src/script/controller.ts` — add event dispatch after each `setProperty` call
- `src/script/pedigree.ts` — read `autosave` option; wire up save-on-action
- `src/script/saveLoadEngine.ts` — fix SVG gradient export (`canvasToSvg` helper)
- New file: `Dockerfile`
