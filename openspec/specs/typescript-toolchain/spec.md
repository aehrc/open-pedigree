# typescript-toolchain Specification

## Purpose
TBD - created by archiving change migrate-to-typescript. Update Purpose after archive.
## Requirements
### Requirement: TypeScript compiler and ts-loader are installed
The project SHALL have `typescript` and `ts-loader` as devDependencies so that `.ts` source files can be compiled and bundled.

#### Scenario: Dependencies present after install
- **WHEN** `npm install` is run
- **THEN** `node_modules/typescript` and `node_modules/ts-loader` exist

---

### Requirement: tsconfig.json exists with lenient settings
A `tsconfig.json` SHALL exist at the project root, configured with `allowJs: true`, `strict: false`, `noImplicitAny: false`, `skipLibCheck: true`, and path aliases matching the webpack aliases (`pedigree/*` → `src/script/*`, `vendor/*` → `public/vendor/*`).

#### Scenario: tsconfig present and parseable
- **WHEN** `npx tsc --version` is run in the project root
- **THEN** it exits 0 and `tsconfig.json` is valid JSON

#### Scenario: Path aliases resolve during type-check
- **WHEN** `npx tsc --noEmit` is run
- **THEN** imports like `import X from 'pedigree/model/baseGraph'` resolve without "module not found" errors

---

### Requirement: Webpack handles .ts files via ts-loader
The webpack config SHALL include a `ts-loader` rule for `*.ts` files (mutually exclusive with the existing `babel-loader` rule for `*.js` files) and SHALL add `.ts` to `resolve.extensions`.

#### Scenario: Production build succeeds after toolchain addition
- **WHEN** `npm run build` is run with no `.ts` files yet migrated
- **THEN** `dist/pedigree.min.js` is produced and the command exits 0

#### Scenario: TypeScript file is resolved without extension in import
- **WHEN** a `.ts` file imports `from 'pedigree/model/baseGraph'` and `baseGraph.ts` exists
- **THEN** webpack resolves it correctly without requiring a `.ts` extension in the import statement

---

### Requirement: Vitest resolves .ts source files
The `vitest.config.js` SHALL include `.ts` in `resolve.extensions` so that unit tests can import from renamed `.ts` files without changing the test imports.

#### Scenario: Unit tests pass after toolchain addition
- **WHEN** `npm test` is run
- **THEN** all 27 unit tests pass (no regressions from config changes alone)

---

### Requirement: Ambient type declarations exist for PrototypeJS globals
A `src/types/prototype.d.ts` file SHALL declare the PrototypeJS globals used in source files (`$$`, `$`, `$F`, `Ajax`, `Element` constructor extensions, `document.observe`, `document.fire`) as ambient globals so `.ts` files can use them without TypeScript errors.

#### Scenario: PrototypeJS globals usable in .ts file without type error
- **WHEN** a `.ts` source file references `$$('selector')` or `document.observe('event', fn)`
- **THEN** `tsc --noEmit` does not report an error for those usages

---

### Requirement: Ambient type declarations exist for Raphaël
A `src/types/raphael.d.ts` file SHALL declare the `Raphael` constructor and the subset of Raphaël methods used in visuals files as ambient globals so `.ts` files can use them without TypeScript errors.

#### Scenario: Raphaël usage in .ts file does not produce type error
- **WHEN** a `.ts` visuals file uses `Raphael(container, width, height)` or calls `.paper.path(...)`
- **THEN** `tsc --noEmit` does not report an error for those usages

---

### Requirement: typecheck npm script runs tsc --noEmit
A `typecheck` script SHALL be added to `package.json` that runs `tsc --noEmit`, enabling explicit type checking independent of the webpack build.

#### Scenario: typecheck script is runnable
- **WHEN** `npm run typecheck` is run after the toolchain is set up
- **THEN** it exits 0 (no type errors with the initial lenient tsconfig)

