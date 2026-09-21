# release-automation Specification

## Purpose
Automate versioning, changelog generation, and GitHub Releases from `main`
using `release-please` (`release-type: node`, since the repo has a
machine-readable `package.json` version field), producing a downloadable
tagged zip that `redcap_pedigree_editor` can pin its embedded snapshot
against.

## Requirements

### Requirement: release-please manages versioning and changelog from main
A `release-please` GitHub Actions workflow SHALL run on every push to `main`, maintaining a standing release pull request that batches all Conventional Commit-titled PRs merged since the last release, using `release-type: node`.

#### Scenario: Merging a feature PR updates the standing release PR
- **WHEN** a PR titled per Conventional Commits (e.g. `feat: ...`, `fix: ...`) is squash-merged to `main`
- **THEN** release-please SHALL update (or open, if none exists) a standing release PR reflecting that change in its changelog

#### Scenario: Merging the release PR cuts a version and tag
- **WHEN** the standing release PR is merged
- **THEN** `package.json`'s `"version"` field SHALL be bumped according to semver rules derived from the batched commits' Conventional Commit types
- **AND** a git tag matching that version SHALL be created on `main`
- **AND** a corresponding GitHub Release SHALL be created with an auto-generated changelog and source zip

### Requirement: Released zip is suitable for downstream consumption
The GitHub Release created by `release-please` SHALL provide a downloadable, versioned artifact that a downstream consumer (`redcap_pedigree_editor`) can pin a build against by tag.

#### Scenario: A downstream project can fetch a specific version
- **WHEN** a downstream build process requests the release tagged `vX.Y.Z`
- **THEN** GitHub's Releases API SHALL serve that tag's release metadata and asset zip without authentication, since the repository is public
