# Proposal: Setup Testing Framework

## Problem
The project currently has no automated test suite, making it difficult to verify that changes
don't introduce regressions — particularly important for the REDCap external module submission.

## Solution
Add two complementary test layers:

1. **Vitest unit tests** — fast, headless tests for the model layer (BaseGraph, import/export,
   GA4GH FHIR converter, helpers). These can run in CI without a browser.

2. **Playwright E2E visual regression tests** — full browser tests that load `localEditor.html`,
   exercise the editor UI, and compare screenshots against committed baselines. Covers the
   additional export formats present in this branch (PED, DADA2, GA4GH FHIR, SVG).

## Key Differences from master-lineage
This branch (`feature/redcap_em_0.4_upgrade`) includes GA4GHFHIRConverter, DADA2 export,
localStorageBackend, StaticTerminology, and a configurable terminology system — all of which
need test coverage not present in the base testing plan.

## Scope
- Vitest + jsdom for unit tests (`tests/unit/`)
- Playwright + Chromium for E2E tests (`tests/e2e/`)
- Baseline screenshots committed to the repository
- `npm test`, `npm run test:coverage`, and `npm run test:e2e` scripts added to `package.json`
