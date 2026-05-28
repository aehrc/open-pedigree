## Context

The first TypeScript migration pass converted all view-layer and entry-point files using `Class.create()` (PrototypeJS classes) to TypeScript ES6 classes. That pass intentionally skipped the model layer and utility files because they were already written as plain functions/constructor functions without PrototypeJS — a different, lower-risk conversion pattern. `GA4GHFHIRConverter.js` was the last holdout and was converted separately. The 17 files that remain are all plain-function or constructor-function style JS that TypeScript accepts as-is without annotation.

## Goals / Non-Goals

**Goals:**
- Rename all 17 remaining `.js` source files to `.ts`
- Build passes cleanly after the full set is converted
- No logic, API, or runtime behaviour changes

**Non-Goals:**
- Adding TypeScript type annotations (that is a follow-on task if desired)
- Fixing pre-existing logic bugs discovered during conversion
- Changing module structure or refactoring internals

## Decisions

**Rename-only, no annotations.** TypeScript's `allowJs` is not in use; the tsconfig requires `.ts` files. All 17 files compile as `.ts` with zero or minimal errors under `noImplicitAny: false` (the current setting). Adding type annotations is valuable but out of scope — it doubles the effort and mixes two concerns.

**Convert in dependency order, validate build after each file.** The model files form an import chain (`helpers` → `queues`/`xcoordclass` → `positionedGraph` → `dynamicGraph`). Converting in leaf-first order lets us catch breakage immediately rather than at the end.

**`app.js` last.** It is the webpack entry point. The `webpack.config.js` `entry` field must be updated to `app.ts` at the same time as the rename to avoid a missing-module error.

**`raphael.js` is a thin re-export wrapper, not Raphaël itself.** Convert it like any other file — it just re-exports the npm `raphael` package under the `pedigree/raphael` alias.

## Risks / Trade-offs

[Some files may have implicit `any` errors under stricter settings] → Current tsconfig has `noImplicitAny: false`, so this is not a blocker. Note any cases for future annotation work.

[`dynamicGraph.js` and `positionedGraph.js` are 3500+ lines each] → Rename only; no structural changes, so size is not a risk for this pass.

## Migration Plan

1. Convert leaf utilities first: `helpers`, `queues`, `xcoordclass`, `ageCalc`, `graphicHelpers`, `templates`, `pedigreeEditorParameters`
2. Convert model layer: `relationshipTracker`, `ordering`, `edgeOptimization`, `positionedGraph`, `baseGraph`, `dynamicGraph`
3. Convert I/O layer: `import`, `export`, `localStorageBackend`
4. Convert `raphael.js`
5. Convert entry point: update `webpack.config.js` entry, rename `app.js` → `app.ts`
6. Full build verification after each group
