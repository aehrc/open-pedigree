## Why

`redcap_pedigree_editor` (the REDCap external module that embeds this library) needs a releasable version, and that release plan depends on pulling a versioned, tagged GitHub Release of open-pedigree rather than a hand-copied `dist/` snapshot — but this repo has no tags, no releases, and no CI at all today. Its git-flow-shaped branch model has also drifted badly: `master` and `develop` share a June-2020 common ancestor and have been independently modernized since (`develop` reaching TypeScript 6/Vitest/Playwright with 81 `.ts` files and the full feature set including GA4GH FHIR export and SMART-on-FHIR; `master` reaching an independent, smaller TypeScript migration with only 44 `.ts` files, missing GA4GH entirely, and dormant since 2026-05-26). `develop_redcap_em` — the branch actually embedded in the module today — is just `develop` plus three small, non-REDCap-specific bug fixes. None of this can support a tagged release process as-is. Three other modules in the `aehrc` org (`redcap_fhir_ontology_provider`, `advanced_fhir_ontology_provider`, `simple_ontology_provider`) have already migrated to a trunk-based model with `release-please`-driven releases; this change brings open-pedigree in line with that same pattern.

## What Changes

- Cherry-pick the handful of commits on `master` that are genuinely independent of `develop`'s own modernization and not just a redundant re-implementation of it: `739600e` (TypeError fix for `pedigree:graph:clear` firing without `event.detail`), `519a10c` (bundle jQuery into `pedigree.min.js`, fix CJS default-import interop), `0799320`+`c1fcda3` (Dockerfile + CI pinned to Node 24), `6f50b9c` (GitHub Pages demo deployment workflow), `870eac0` (pan-home icon swap).
- **BREAKING (process)**: Promote `develop` — not `master` — to become the repository's sole long-lived branch, renamed `main` on GitHub. `master` is retired once the commits above are ported.
- Retire `develop_redcap_em` and any feature branches already fully merged into `develop` (`feature/backport`, `feature/generalize-patient-provider-import`, `feature/patient-provider`, `feature/questionnaire-fields`, and `feature/redcap_em_0.4_upgrade` if superseded — verified merged, not just assumed, before deletion).
- Add `pr-title-lint.yml`: enforce Conventional Commits on PR titles, matching the other `aehrc` modules.
- Add `release-please.yml` with `release-type: node` (not `simple` — this repo's `package.json` already carries a real `"version"` field, so release-please bumps it directly rather than tracking version only in a manifest).
- Add a JS-appropriate security workflow (`npm audit` / CodeQL for JavaScript/TypeScript) — **not** Psalm/taint-analysis, which is PHP-specific and not applicable here.
- Add `dependabot.yml` targeting the npm ecosystem.
- Configure GitHub branch protection and repository settings (squash-merge only, PR title = commit message) to match the trunk-based modules.

## Capabilities

### New Capabilities
- `branch-model`: Single long-lived `main` branch (promoted from `develop`); `<type>/<description>` branches PR'd back to `main` with squash-merge; no `develop`/`develop_redcap_em`/git-flow branches.
- `release-automation`: `release-please` (Node release type) maintains a standing release PR from Conventional Commit-titled PRs merged to `main`, and produces tagged GitHub Releases with semver versions.
- `ci-checks`: PR title linting (Conventional Commits), npm/CodeQL-based JS security scanning, and dependabot for the npm ecosystem, gating merges to `main`.

### Modified Capabilities
- none

## Impact

- Git history: `master`, `develop`, `develop_redcap_em` branch topology on GitHub; `develop` becomes `main` (default branch rename).
- New files: `.github/workflows/pr-title-lint.yml`, `.github/workflows/release-please.yml`, `.github/workflows/security-scan.yml` (or equivalent CodeQL config), `.github/dependabot.yml`, `.release-please-manifest.json`, `release-please-config.json`.
- `package.json`: no dependency changes, but becomes the file release-please bumps on each release.
- Downstream: `redcap_pedigree_editor`'s planned GitHub-Release-based embed mechanism (tracked in the workspace-level `pedigree-editor-github-release-embed` change) depends on this change landing first — there is nothing to pull a release asset from until `main` exists and cuts its first tagged release.
- No `src/` application code changes in this change beyond the cherry-picked `master`-only commits listed above, **except** two amendments made during implementation and detailed in `design.md`'s Amendments section: an npm package identity rename (`@phenotips/open-pedigree` → `@aehrc/open-pedigree`, plus matching URL/link updates and one real behavioral change — the GA4GH FHIR export/import identifier URI) once this repo started cutting independent releases, and resolving the remaining `npm audit` findings the security-scan workflow (deliberately) shipped red with.
