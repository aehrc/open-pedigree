# Design: Setup Testing Framework

## Unit Test Architecture

**Framework**: Vitest (native ESM, no babel-jest needed; compatible with the existing babel-loader setup)

**Environment**: jsdom (allows DOM API usage in tests without a browser)

**Alias**: `vitest.config.js` mirrors the webpack `resolve.alias` — `pedigree` → `src/script/` — so test imports match source imports exactly.

**Coverage**: `@vitest/coverage-v8` provider; scoped to `src/script/model/` for the initial pass.

**Test files**:
- `tests/unit/model/helpers.test.js`
- `tests/unit/model/baseGraph.test.js`
- `tests/unit/model/import-export.test.js`
- `tests/unit/model/GA4GHFHIRConverter.test.js`

PrototypeJS (`Class.create`, `$`, `$$`, etc.) is only used in the view and controller layers, not in the model layer. Unit tests can import model files directly without mocking PrototypeJS.

## E2E Test Architecture

**Framework**: Playwright with Chromium

**Dev server**: `playwright.config.js` `webServer` block starts `npm start` automatically and reuses an already-running instance (`reuseExistingServer: true`).

**Screenshot baseline**: Stored in `tests/e2e/screenshots/` and committed to git. Generated on first run with `--update-snapshots`, then compared on subsequent runs with a 2% pixel tolerance.

**Download testing**: Export format tests use Playwright's `page.waitForEvent('download')` to intercept the browser's download event. The `download.suggestedFilename()` method returns the intended filename (e.g. `open-pedigree.ped`) regardless of any `(1)` suffix the browser may append when saving to disk — making tests portable across machines that may have pre-existing files.

**Test files**:
- `tests/e2e/editor-load.spec.js`
- `tests/e2e/add-node.spec.js`
- `tests/e2e/save-load.spec.js`
- `tests/e2e/export-formats.spec.js` — covers PED, DADA2, and GA4GH FHIR exports

## npm Scripts

```json
"test":          "vitest run"
"test:coverage": "vitest run --coverage"
"test:e2e":      "playwright test"
```
