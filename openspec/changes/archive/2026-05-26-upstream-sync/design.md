## Context

The `aehrc/open-pedigree` fork cannot be directly merged with `phenotips/open-pedigree` upstream because the architectures have diverged: upstream uses PrototypeJS `Class.create` and `document.fire`/`document.observe`; this fork has been fully migrated to TypeScript ES6 classes and native `CustomEvent`/`addEventListener`. All upstream changes must be manually translated.

The four upstream changes to port are small and self-contained:

1. **`pedigree:person:set:<field>` events** (5 lines in controller) — fire after every `setProperty` call
2. **SVG gradient export fix** (53 lines in saveLoadEngine) — strip page-URL references from gradient IDs
3. **Autosave option** (29 lines in pedigree) — trigger save after every undoable action
4. **Dockerfile** — container build configuration

## Goals / Non-Goals

**Goals:**
- Port all four upstream changes faithfully, translated to TypeScript/native DOM
- Keep the ported code consistent with existing patterns in this codebase
- No changes to public API signatures of `initialiseEditor`

**Non-Goals:**
- Merging the upstream custom-backend callback pattern (go-1269 `save`/`load` functions) — this fork already has its own `backend` abstraction that handles the same concern differently; reconciling the two approaches is out of scope
- Upstreaming any of our changes back to phenotips — a separate process

## Decisions

**`pedigree:person:set:<field>` event naming** — upstream fires `pedigree:person:set:${field}` where `field` is the property name lowercased with the `set` prefix stripped (e.g. `setFirstName` → `pedigree:person:set:firstname`). We keep that exact naming for compatibility with any external code targeting the upstream event contract.

**SVG `canvasToSvg` helper** — upstream uses Prototype's `.down()` and `.innerHTML` to extract SVG content and strip page-URL gradient references. Our translation uses `querySelector` and the same regex approach. The `window.location.href` stripping is kept verbatim — it is the key fix.

**Autosave wiring** — upstream attaches a listener to `pedigree:graph:changed` in `pedigree.js`. In this codebase the equivalent pattern is adding an `addEventListener` in `pedigree.ts` `initialize`. The autosave save call goes through `this._saveLoadEngine.save()` which is already the pattern used by the Save button handler.

**Dockerfile base image** — use `node:24-alpine` to match the Node 24 version used in CI, rather than the older image in the upstream Dockerfile.

## Risks / Trade-offs

- **`pedigree:person:set` event field naming**: The field name is derived by stripping `set` and lowercasing, which means multi-word setters like `setFirstName` become `firstname` (no separator). Upstream made this choice; we match it for compat. → No mitigation needed, just document it.
- **Autosave and undo interaction**: Autosave fires on every `pedigree:graph:changed` event, which includes undo/redo actions. This matches upstream behaviour but means an undo immediately triggers a save (the undone state is saved). → Acceptable; matches upstream contract.
- **SVG fix side-effects**: The URL-stripping regex uses `window.location.href` at save time. In the `localEditor.html` standalone context `location.href` includes query parameters; these are stripped correctly. No known side-effects. → Low risk.

## Migration Plan

All changes are additive or bug fixes. No data migration required. No public API changes. Deploy by rebuilding the bundle.
