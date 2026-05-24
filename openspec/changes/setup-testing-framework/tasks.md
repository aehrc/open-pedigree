## 1. Vitest Setup

- [ ] 1.1 Run `npm install --save-dev vitest @vitest/coverage-v8 jsdom` to add Vitest and coverage dependencies
- [ ] 1.2 Create `vitest.config.js` with: `environment: 'jsdom'`, `resolve.alias` mapping `pedigree` → `src/script/`, test glob `tests/unit/**/*.test.js`, coverage provider `v8` over `src/script/model/`
- [ ] 1.3 Add `"test": "vitest run"` and `"test:coverage": "vitest run --coverage"` scripts to `package.json`
- [ ] 1.4 Create `tests/unit/` directory structure (`tests/unit/model/`)
- [ ] 1.5 Run `npm test` with no test files present and confirm Vitest starts without config errors

## 2. helpers.js Unit Tests

- [ ] 2.1 Create `tests/unit/model/helpers.test.js` with tests for: `isInt` (valid integers, floats, strings, null), `replaceInArray` (replaces first occurrence only), `removeFirstOccurrenceByValue`, `filterUnique`, `arrayContains`, `clone2DArray` (deep copy check)
- [ ] 2.2 Run `npm test` and confirm all helpers tests pass

## 3. BaseGraph Unit Tests

- [ ] 3.1 Create `tests/unit/model/baseGraph.test.js` testing: empty graph construction (`getNumNodes() === 0`), adding a person node (count increases, retrievable by ID), adding a relationship node, adding edges between nodes, removing a node
- [ ] 3.2 Run `npm test` and confirm all baseGraph tests pass

## 4. Import/Export Round-Trip Tests

- [ ] 4.1 Create a fixture file `tests/unit/fixtures/simple-pedigree.json` — a minimal valid internal JSON pedigree (can be captured from `localEditor.html` by saving a simple pedigree)
- [ ] 4.2 Create `tests/unit/model/import-export.test.js` testing: `PedigreeImport.initializeFromJSON` on the fixture produces the correct node count, `PedigreeExport.exportAsJSON` on the resulting graph round-trips back to the same structure
- [ ] 4.3 Run `npm test` and confirm import/export tests pass

## 5. GA4GH FHIR Converter Tests

- [ ] 5.1 Create a fixture file `tests/unit/fixtures/simple-ga4gh-fhir.json` — a minimal GA4GH FHIR bundle (can be captured from `localEditor.html` by exporting GA4GH format)
- [ ] 5.2 Create `tests/unit/model/GA4GHFHIRConverter.test.js` using `vi.mock()` to stub `TerminologyManager` with minimal implementations
- [ ] 5.3 Add tests for: GA4GH export of a simple BaseGraph produces a valid FHIR JSON object
- [ ] 5.4 Run `npm test` and confirm GA4GH converter tests pass
- [ ] 5.5 Run `npm run test:coverage` and confirm a `coverage/` directory is generated with model layer coverage data

## 6. Playwright Setup

- [ ] 6.1 Run `npm install --save-dev @playwright/test` and then `npx playwright install chromium` to install Playwright and the Chromium browser
- [ ] 6.2 Create `playwright.config.js` with: `baseURL: 'http://localhost:9000'`, `webServer: { command: 'npm start', url: 'http://localhost:9000', reuseExistingServer: true, timeout: 60000 }`, `use: { screenshot: 'only-on-failure' }`, test dir `tests/e2e/`
- [ ] 6.3 Add `"test:e2e": "playwright test"` script to `package.json`
- [ ] 6.4 Create `tests/e2e/` directory

## 7. E2E Test Scenarios

- [ ] 7.1 Create `tests/e2e/editor-load.spec.js`: navigate to `/localEditor.html`, wait for the SVG canvas element to be visible, assert no console errors, take screenshot with `toHaveScreenshot('editor-load.png', { maxDiffPixelRatio: 0.02 })`
- [ ] 7.2 Create `tests/e2e/add-node.spec.js`: load the editor, click the action to add a new person node, assert the SVG node count increases, take screenshot with `toHaveScreenshot('add-node.png', { maxDiffPixelRatio: 0.02 })`
- [ ] 7.3 Create `tests/e2e/save-load.spec.js`: load the editor with a pre-saved pedigree URL parameter or inject via the page API, trigger JSON export, assert the result contains a `GG` key
- [ ] 7.4 Create `tests/e2e/export-formats.spec.js`: open export dialog and verify PED, DADA2, and GA4GH FHIR exports each trigger a download without JavaScript errors (intercept the download event rather than checking the file system)
- [ ] 7.5 Run `npm run test:e2e -- --update-snapshots` to generate the initial baseline screenshots
- [ ] 7.6 Commit baseline screenshots in `tests/e2e/` to git
- [ ] 7.7 Run `npm run test:e2e` (without `--update-snapshots`) to confirm tests pass against the baselines

## 8. CI Smoke Check

- [ ] 8.1 Run `npm test` and `npm run test:e2e` together in sequence to confirm both suites pass cleanly from a fresh terminal
- [ ] 8.2 Verify `npm run test:coverage` produces output without error
