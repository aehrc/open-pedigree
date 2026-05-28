## Why

The TypeScript migration converted the view layer and most entry-point files to `.ts`, but the model layer and several utility files remain as `.js`. This creates an inconsistent codebase where the core graph algorithms — the most complex and bug-prone code — receive no type checking. Completing the migration brings the full codebase under TypeScript's safety net and eliminates the mixed-language anomaly.

## What Changes

- Rename 17 remaining `.js` source files to `.ts` (no logic changes, no type annotation additions beyond what TypeScript infers automatically)
- Remove `.js` files after rename; all imports use extension-free aliases so no import sites change
- `app.js` → `app.ts` last, as the webpack entry point

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `typescript-toolchain`: the full source tree is now `.ts`; the existing spec's statement that migration is in progress becomes "complete"

## Impact

- All 17 files in `src/script/model/`, `src/script/view/` (remaining), `src/script/`, and `src/` entry point
- No API or runtime behaviour changes — rename-only
- Build must remain clean after each file converted
- Webpack entry point (`app.js` → `app.ts`) requires updating `webpack.config.js`
