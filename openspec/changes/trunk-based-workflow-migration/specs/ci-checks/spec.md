## ADDED Requirements

### Requirement: PR titles are enforced as Conventional Commits
A `pr-title-lint` workflow SHALL run on every pull request targeting `main` and fail the check if the PR title does not conform to the Conventional Commits format, since `release-please` parses PR titles to compute version bumps and changelog entries.

#### Scenario: Non-conforming PR title fails the check
- **WHEN** a PR is opened or edited with a title that does not start with a valid Conventional Commits type (e.g. missing a type prefix entirely)
- **THEN** the `pr-title-lint` check SHALL fail on that PR

#### Scenario: Conforming PR title passes the check
- **WHEN** a PR title starts with a valid Conventional Commits type (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`, etc.)
- **THEN** the `pr-title-lint` check SHALL pass

---

### Requirement: Automated JavaScript/TypeScript security scanning
A CI workflow SHALL run `npm audit` (or equivalent) and CodeQL's JavaScript/TypeScript analysis on pushes to `main` and on pull requests, appropriate to this repo's JS/TS stack rather than the PHP-oriented Psalm taint-analysis used by other modules in the org.

#### Scenario: High/critical npm vulnerability fails the check
- **WHEN** `npm audit` reports a high or critical severity advisory in the dependency tree
- **THEN** the security-scan check SHALL fail

#### Scenario: CodeQL flags a JS/TS issue
- **WHEN** CodeQL's default JavaScript/TypeScript query pack identifies a finding on a PR's changed code
- **THEN** the finding SHALL appear as a CodeQL check annotation on that PR

---

### Requirement: Dependabot monitors the npm ecosystem
A `dependabot.yml` configuration SHALL request updates for the `npm` package ecosystem (and `github-actions` for workflow files), matching the pattern used by the org's other modules but scoped to npm instead of composer.

#### Scenario: Dependabot opens a PR for an outdated npm dependency
- **WHEN** a direct npm dependency has a newer version available
- **THEN** Dependabot SHALL open a PR updating that dependency, titled per Conventional Commits so it passes `pr-title-lint`
