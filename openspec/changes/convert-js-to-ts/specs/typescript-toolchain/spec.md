# Delta: typescript-toolchain

## Modified Requirements

### Requirement: All source files are TypeScript
REPLACE the requirement "Webpack handles .ts files via ts-loader" with the following:

All source files under `src/` SHALL be `.ts`. No `.js` source files SHALL remain (excluding `node_modules` and generated output). The webpack entry point SHALL be `src/app.ts`.

#### Scenario: No .js source files remain
- **WHEN** `find src/ -name "*.js"` is run
- **THEN** it returns no results

#### Scenario: Build succeeds with .ts entry point
- **WHEN** `npm run build` is run after all renames are complete
- **THEN** `dist/pedigree.min.js` is produced and the command exits 0 with no errors (warnings permitted)
