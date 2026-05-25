## Why

The codebase uses PrototypeJS `Class.create()` across 48 source files — a pattern that makes type checking impossible, IDE navigation unreliable, and refactoring fragile. Converting to TypeScript ES6 classes gives static analysis, autocomplete, and a safe foundation for the upcoming REDCap external module integrations. The testing framework from Phase 2 (30 Vitest unit + 7 Playwright E2E tests) now provides the safety net to do this with confidence.

## What Changes

- Add TypeScript toolchain: `tsconfig.json`, `ts-loader` (webpack), `typescript` devDependency
- Add a `src/types/` directory with declaration files for PrototypeJS globals (`$$`, `$`, `Ajax`, `Element`, `Class`, `document.observe`, `document.fire`) and Raphaël, so the runtime externals are typed
- Rename all 48 `Class.create()` source files from `.js` → `.ts`; convert each class body to `export default class ... { constructor(...) {...} }` — `initialize` → `constructor`, `$super(...)` → `super(...)`
- Update webpack alias resolution to include `.ts` extensions
- Update vitest config to include `.ts` sources
- Files not using `Class.create()` (18 plain-module files) stay as `.js` for now; webpack and vitest handle mixed `.js`/`.ts` naturally

**NOT in scope:**
- Replacing `document.observe` / `document.fire` with a modern event bus (separate change)
- Enabling `strict: true` — use `noImplicitAny: false` initially to keep the diff focused
- Removing the PrototypeJS runtime dependency (it is still needed for DOM events, `$$`, `Ajax`, etc.)

## Capabilities

### New Capabilities
- `typescript-toolchain`: tsconfig.json, ts-loader webpack integration, PrototypeJS + Raphaël type declarations, updated module alias resolution and vitest config
- `class-migration`: All 48 `Class.create()` files converted to TypeScript ES6 classes — `initialize` → `constructor`, `$super` → `super`, inheritance via `extends`, static methods preserved

### Modified Capabilities
*(none — no spec-level behaviour changes; this is a pure implementation refactor)*

## Impact

- **`package.json`**: add `typescript`, `ts-loader` devDependencies
- **`webpack.config.js`**: add ts-loader rule, add `.ts` to resolve extensions, add `.ts` to alias resolution
- **`vitest.config.js`**: add `.ts` to resolve extensions
- **`tsconfig.json`**: new file, targets ES2017, module ESNext, `noImplicitAny: false`, includes `src/script/**/*.ts` and `src/types/**/*.d.ts`
- **`src/types/`**: new directory with `prototype.d.ts` and `raphael.d.ts`
- **`src/script/**/*.js` (48 files)**: renamed to `.ts`, class bodies rewritten
- **Tests**: unit tests remain `.js` and continue to pass; E2E tests unaffected (browser runtime unchanged)
