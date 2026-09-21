## Context

Verified on `open-pedigree-upgrade` (2026-09-11):

- `develop` (159 commits, last touched 2026-07-15) and `master` (63 commits, last touched 2026-05-26) share a common ancestor from 2020-06-19. Both independently removed PrototypeJS and migrated to TypeScript — `develop` reached 81 `.ts` files on typescript `^6.0.3` with the full feature set (GA4GH FHIR converter, SMART-on-FHIR `fhirclient` dependency, patient-provider, questionnaire-fields); `master` reached only 44 `.ts` files on typescript `^5.9.3` and is missing GA4GH entirely.
- `develop_redcap_em` contains zero commits `develop` lacks, plus 12 (mostly merge commits) `develop` lacks — three of which are real, generic (non-REDCap-specific) bug fixes: `b1ae71a` (export dialog CSS class collision), `a9ed472` (GA4GH `resolveNodeRef` backport), `90b117c` (TDZ crash in `app.ts`). These three are out of scope for *this* change — they're tracked in the workspace-level `pedigree-editor-redcap-extension-extraction` change, which upstreams them into `develop`/`main` directly rather than via `develop_redcap_em`.
- `feature/backport` carries the exact same commit set as `master`'s exclusive history (it's the working branch `master`'s tip was assembled from) — it should be treated identically to `master`, not as separate work.
- `feature/generalize-patient-provider-import`, `feature/patient-provider`, `feature/questionnaire-fields`, `feature/redcap_em_0.4_upgrade`, `feature/smart-on-fhir` are all fully merged into `develop` (`git merge-base --is-ancestor <branch> develop` confirmed true for each) — safe to delete once `develop` is promoted.
- `feature/unknown-parent-node` (last commit 2026-07-10) is **NOT** merged into `develop` — it has 2 real unmerged commits (a placeholder-node feature plus a gitignore fix). This is genuine unfinished work, not stale housekeeping — it is explicitly **out of scope** for this change and must not be deleted; whoever owns it needs to rebase and PR it against the new `main` separately.
- `feature/questionnaire-resource-extraction` is the currently-checked-out, actively-developed branch for unrelated future work — untouched by this change.
- This repo is public (`private: false`), so nothing about repository visibility needs to change for any of this.

## Goals / Non-Goals

**Goals:**
- Establish `main` (promoted from `develop`) as the repository's single long-lived branch, with the small set of genuinely-independent `master`-only fixes ported forward first.
- Stand up the same CI/release tooling already proven on `redcap_fhir_ontology_provider`/`advanced_fhir_ontology_provider`/`simple_ontology_provider`, adapted for a JS/TS project instead of PHP.
- Leave the repository able to cut its first tagged release immediately after this change merges, since `pedigree-editor-github-release-embed` depends on a real tag/release existing.

**Non-Goals:**
- Re-running or redoing `master`'s TypeScript migration on `develop` — not needed; `develop` already independently reached an equivalent-or-better modernized state.
- Resolving `feature/unknown-parent-node` — tracked separately, not blocking this change.
- Any application/`src/` behavior change beyond the six cherry-picked commits below.
- Deciding open-pedigree's long-term relationship to its own upstream (`phenotips/open-pedigree`) — unaffected by this change.

## Decisions

### D1 — Promote `develop`, not `master`, to `main`

`develop` is feature-complete and already modernized (see Context); `master` is a smaller, dormant, independently-modernized line missing real features. Promoting `master` would mean either losing GA4GH/SMART-on-FHIR/patient-provider entirely or re-doing years of feature work on top of it. Promoting `develop` loses nothing — see D2 for what actually needs porting from `master`.

*Alternative considered:* merge `master` and `develop` via `git merge`. Rejected — their post-2020 histories are architecturally incompatible (independent PrototypeJS→TypeScript rewrites of the same files); a real merge would produce extensive, meaningless conflicts on files that are already equivalent in intent. Cherry-picking the small independent delta (D2) achieves the same outcome without that noise.

### D2 — Cherry-pick six specific commits from `master`/`feature/backport` onto `develop` before promotion

Only these are genuinely independent, not a re-implementation of something `develop` already has: `739600e`, `519a10c`, `0799320`, `c1fcda3`, `6f50b9c`, `870eac0` (see proposal.md for what each does). All six hashes were confirmed to still resolve in this checkout as of 2026-09-11. Apply as `git cherry-pick` in commit order onto a branch cut from `develop`; resolve any conflicts by keeping `develop`'s TypeScript equivalents and applying only the *behavioral* fix (e.g. the jQuery-bundling and Node-24 changes may need re-expressing against `develop`'s current `webpack.config.js`/`Dockerfile` rather than applying verbatim).

*Alternative considered:* leave `master` unpromoted-from but still alive as a long-term parallel branch for these fixes. Rejected — defeats the purpose of trunk-based single-`main`; nothing on `master` needs preserving once these six are ported.

### D3 — `release-please` with `release-type: node`

Unlike the PHP modules (`release-type: simple`, chosen there for lack of any machine-readable version field), this repo's `package.json` already has a real `"version"` field — `release-type: node` lets release-please bump it directly as part of each release commit, which is the more correct/idiomatic choice for a real npm-shaped project.

*Alternative considered:* `release-type: simple`, matching the PHP modules exactly for consistency. Rejected — would leave `package.json`'s version permanently stale/manually-maintained for no reason, when release-please's Node support handles this correctly out of the box.

### D4 — JS-appropriate security scanning instead of Psalm

Psalm's taint analysis (used by the PHP modules) has no equivalent applicability here — this is a JavaScript/TypeScript project. Use `npm audit` in CI (fails the build on high/critical advisories) plus GitHub's CodeQL default JS/TS query pack, and `dependabot.yml` scoped to `package-ecosystem: npm` rather than `composer`.

### D5 — Branch retirement order

Retire branches only after the `main` promotion is confirmed working (first successful release-please run, first tag cut): delete `master`, `feature/backport` (D1/D2 supersede both), `develop_redcap_em` (see Context — nothing left on it that isn't either already in `develop` or tracked separately), and the five confirmed-merged feature branches. Do **not** touch `feature/unknown-parent-node` or `feature/questionnaire-resource-extraction`.

## Risks / Trade-offs

- **[Risk] Cherry-picking `master`'s Node-24/Docker/CI commits onto `develop` may not apply cleanly**, since `develop`'s webpack/build config has diverged independently. Mitigation: treat these as "port the intent, not the diff" rather than a mechanical `git cherry-pick --continue` — re-express against `develop`'s current build files where the automatic cherry-pick conflicts.
- **[Risk] Default-branch rename (`develop`→`main`) breaks any external references** (CI badges, existing open PRs targeting `develop`, local clones with a stale default branch). Mitigation: this repo currently has no open PRs against `develop` other than internal feature work already accounted for above; announce the rename and rely on GitHub's automatic redirect for the renamed branch.
- **[Trade-off] `feature/unknown-parent-node` is left stranded** on the old branch name space after `develop` is renamed — it will need a manual rebase onto `main` by its owner. Accepted, since resolving that work is out of scope here and forcing it into this change would block an otherwise-ready migration on unrelated feature work.

## Migration Plan

1. Branch from `develop`, cherry-pick the six `master`-only commits (D2), resolve conflicts, verify `npm run build` and full test suite pass.
2. PR and merge that branch into `develop`.
3. Rename `develop` to `main` on GitHub (this carries all existing PRs/protections targeting `develop` forward automatically per GitHub's rename behavior); update branch protection rules to match the trunk-based modules (require PR review, require status checks, squash-merge only).
4. Add the four workflow/config files (`pr-title-lint.yml`, `release-please.yml`, security scan workflow, `dependabot.yml`) plus `release-please-config.json`/`.release-please-manifest.json`, targeting `main`.
5. Confirm release-please opens its first release PR against `main`; merge it to confirm the first tag/GitHub Release is cut successfully.
6. Delete `master`, `feature/backport`, `develop_redcap_em`, and the five confirmed-merged feature branches (D5).

No rollback beyond standard git branch/tag operations is needed — nothing here is destructive to `develop`'s own content until step 6, which only deletes branches already fully superseded.

## Amendments

Two pieces of work landed during implementation that this design didn't originally scope, both raised as deliberate mid-flight decisions rather than silent scope creep — recorded here since the Non-Goals above ("Any application/`src/` behavior change beyond the six cherry-picked commits") are technically no longer accurate without this note.

**npm package identity rename (`tasks.md` group 4a).** Once `release-please`/GitHub Releases (D3) made this repo cut independent, tagged releases, keeping `package.json`'s `name` as `@phenotips/open-pedigree` risked reading as an official PhenoTips release, and would be invalid if ever published to the npm registry (that scope isn't ours). Renamed to `@aehrc/open-pedigree`, along with `repository`/`bugs`/`homepage` URLs, two cosmetic UI links (`pedigree.ts`'s default `returnUrl`, `workspace.ts`'s title-link `href`), and — the one genuine behavioral change — the GA4GH FHIR export/import identifier `system` URI in `GA4GHFHIRConverter.ts`, with the importer accepting both the old and new URI so already-exported pedigrees still round-trip. `description`/`author` deliberately left alone (accurate PhenoTips lineage, not a stale pointer).

**Resolving the remaining `npm audit` findings (`tasks.md` group 8).** D4 shipped `security-scan.yml` deliberately red (9 vulnerabilities, none force-fixed without investigation). Follow-up work resolved all 9 to 0: a non-major `vitest` patch bump, and `package.json` `overrides` forcing `image-size`/`csv-parse` to patched versions tree-wide for two transitively-pulled, confirmed-unreachable-at-runtime chains (React Native's `metro` toolchain via `fhirclient`→`isomorphic-webcrypto`; `sifter`'s CLI-only `csv-parse` usage, never its library entry point). No `src/` change; `package.json`/`package-lock.json` only.

Both are covered in detail, PR-by-PR, in `tasks.md`.
