## ADDED Requirements

### Requirement: Single long-lived default branch
The repository SHALL have exactly one long-lived branch, `main`, promoted from `develop`. `master` and `develop_redcap_em` SHALL NOT exist once this change is complete.

#### Scenario: Repository has no git-flow branches
- **WHEN** listing the repository's branches after this change is complete
- **THEN** neither `master` nor `develop_redcap_em` SHALL be present
- **AND** `main` SHALL be the repository's default branch

#### Scenario: Feature work branches from and merges to main
- **WHEN** a contributor starts new work
- **THEN** they SHALL branch from `main` using a `<type>/<description>` name (`feature/`, `fix/`, `chore/`, `docs/`, `test/`, `ci/`), matching the Conventional Commits type the PR will eventually use
- **AND** the resulting PR SHALL target `main` and be squash-merged

---

### Requirement: Pre-promotion parity commits are preserved
Before `develop` is promoted to `main`, the six commits identified as genuinely independent of `develop`'s own history (not a redundant re-implementation of work `develop` already has) SHALL be present in `main`'s history: the `pedigree:graph:clear` TypeError fix, the jQuery-bundling/CJS-interop fix, the Node 24 Dockerfile and CI pin, the GitHub Pages demo workflow, and the pan-home icon swap.

#### Scenario: master-only fixes are not lost
- **WHEN** `main` exists after this change
- **THEN** its history SHALL include equivalents of all six identified `master`-only commits
- **AND** no other `master`-only content (the independent, smaller TypeScript migration) SHALL be reintroduced
