## Context

Open Pedigree is a webpack-bundled browser application. All 66 source files are currently JavaScript. 48 files use PrototypeJS `Class.create()` for OOP; the rest use plain module patterns. PrototypeJS and other host-page libraries (`$$`, `$`, `Ajax`, `Element`, `Class`) are webpack **externals** — they arrive at runtime as globals, not as npm packages.

The Phase 2 testing framework provides the safety net: 30 Vitest unit tests cover the model layer; 7 Playwright E2E tests cover golden-path browser scenarios including export formats.

## Goals / Non-Goals

**Goals:**
- TypeScript compiles cleanly (`tsc --noEmit` exits 0) with lenient settings
- All 48 `Class.create()` files converted to `.ts` ES6 classes
- `npm test` (27 unit), `npm run test:e2e` (7 E2E), and `npm run build` all continue to pass
- PrototypeJS runtime globals (`$$`, `$`, `Ajax`, `document.observe/fire`) remain usable in `.ts` files with ambient type declarations

**Non-Goals:**
- Enabling TypeScript `strict` mode or `noImplicitAny` (follow-on change)
- Replacing `document.observe`/`document.fire` with a modern event bus
- Removing the PrototypeJS runtime dependency
- Adding rich types beyond what's needed to compile (use `any` freely)

## Decisions

### D1: Use `ts-loader` (transpile-only mode) for webpack; separate `tsc --noEmit` for type-check

**Why over `@babel/preset-typescript`:** `ts-loader` honours `tsconfig.json` path mappings directly, which matters because our webpack alias (`pedigree → src/script/`) must also be reflected in TypeScript's `paths`. With `transpileOnly: true` the build stays fast (no type-checking during bundle). A separate `npm run typecheck` script (`tsc --noEmit`) is the explicit type-check step, separate from the build.

**Why not `fork-ts-checker-webpack-plugin`:** Adds complexity; not needed initially.

### D2: `tsconfig.json` — lenient settings, `allowJs: true`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "strict": false,
    "noImplicitAny": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "pedigree/*": ["src/script/*"], "vendor/*": ["public/vendor/*"] }
  },
  "include": ["src/**/*", "src/types/**/*.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`allowJs: true` lets `.ts` files import unchanged `.js` files during migration without type errors. `skipLibCheck: true` avoids fighting third-party `.d.ts` issues early on.

### D3: Ambient type declarations in `src/types/`

PrototypeJS has no `@types` package. Rather than stub the full API, we declare only the globals actually used in source files. Two files:
- `src/types/prototype.d.ts` — `$$`, `$`, `$F`, `Ajax`, `Element` (constructor + `extend`), `document.observe`, `document.fire`, `Class` (kept for any residual `.js` files)
- `src/types/raphael.d.ts` — `Raphael` constructor and the subset of methods used in visuals code

All types default to `any` where the shape is complex, to minimise churn.

### D4: Webpack externals stay unchanged; webpack resolve gains `.ts` extension

`Class`, `$$`, `$`, `$F` remain in `externals` (they come from PrototypeJS on the host page). Add `.ts` to `resolve.extensions` so imports like `import X from 'pedigree/model/baseGraph'` resolve to `baseGraph.ts` after rename. Both `.js` and `.ts` must be in the extensions list to support the mixed state during incremental migration.

### D5: Migration order — terminology → root utils → view → orchestrators

The dependency graph bottom-up:
1. **Terminology leaf terms**: `abstractTerm`, `disorderTerm`, `geneTerm`, `phenotypeTerm` (no Class.create parent)
2. **Terminology base chain**: `abstractTerminology` → `abstractAjaxTerminology` → concrete impls (`FHIRTerminology`, `StaticTerminology`, `BioportalTerminology`, `CTSSTerminology`, `DelegatingTerminology`, `EmptyTerminology`)
3. **Root utility classes**: `disorder`, `hpoTerm`, `DefaultFhirTerminologyHelper`, `FhirTerminologyHelper`, `undoRedo`, `versionUpdater`
4. **View base chain**: `abstractNodeVisuals` → `abstractNode` + `abstractPersonVisuals` → `abstractPerson` → `person`, `partnership`, `personGroup` + their visuals and hoverboxes; then legends, selectors, `workspace`, `nodeMenu`, `lineSet`, `nodetypeSelectionBubble`, `readonlyHoverbox`
5. **Root orchestrators** (most complex, depend on everything): `view.js`, `saveLoadEngine`, `controller`, `pedigree`

### D6: `$super` → `super()` / `super.method()` conversion

PrototypeJS passes the parent method as the first argument (`$super`). Pattern:
```js
// Before
initialize: function($super, x, y) { $super(x, y); }
someMethod: function($super) { return $super() + 'extra'; }
```
```ts
// After
constructor(x: any, y: any) { super(x, y); }
someMethod(): any { return super.someMethod() + 'extra'; }
```

The method name for `super.method()` is always the same as the containing method name. This is mechanical and safe.

### D7: Static properties defined on the constructor function

PrototypeJS pattern `MyClass.CONSTANT = ...` after `Class.create()` becomes `static CONSTANT = ...` inside the class body, or remains as `MyClass.CONSTANT = ...` after the class declaration (both are valid TypeScript).

## Risks / Trade-offs

- **Risk: missed `$super` call** — if `$super` is called with different arguments than the parent `constructor` expects, the conversion is subtly wrong. Mitigation: unit tests run after each layer's migration; E2E tests catch runtime regressions.
- **Risk: PrototypeJS method augmentation** — PrototypeJS extends native DOM objects (e.g., `Element.extend()`). TypeScript may complain about methods not in `lib.dom.d.ts`. Mitigation: ambient declarations extend the `HTMLElement` interface in `prototype.d.ts`.
- **Risk: `terserOptions.reserved: ['$super']`** — currently in `webpack.config.js` to protect the PrototypeJS calling convention. Once all `.js` files using `$super` are converted, this can be removed. During migration, keep it to avoid mangling any unconverted files.
- **Risk: ts-loader + babel-loader coexistence** — `.ts` files go through `ts-loader` only; `.js` files through `babel-loader` only. The regex rules must be mutually exclusive (`/\.tsx?$/` for ts-loader, `/\.jsx?$/` for babel-loader, both excluding node_modules). Verify with `npm run build` after toolchain step.

## Migration Plan

1. Toolchain commit: `tsconfig.json`, `src/types/`, webpack + vitest config changes, `typescript` + `ts-loader` devDeps. Build and tests must pass before any class migration.
2. Per-layer commits following D5 order. Each commit: rename `.js` → `.ts`, convert classes, verify `npm test` passes.
3. Final commit: remove `$super` from terser reserved list; run `npm run typecheck` and fix any remaining type errors.
4. **Rollback**: each commit is self-contained; reverting a layer commit restores the `.js` files.

## Open Questions

- None blocking. `noImplicitAny: false` defers all type annotation work to a future change.
