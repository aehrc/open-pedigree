# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

Use **OpenSpec** for all non-trivial changes:

- `/opsx:ff` — propose + design + specs + tasks in one go (recommended for most changes)
- `/opsx:new` — step-by-step artifact creation
- `/opsx:apply` — implement tasks from a change
- `/opsx:verify` — check implementation before archiving
- `/opsx:archive` — finalise a completed change

## Branch Model

Trunk-based, matching the pattern the workspace's other module repos have adopted:

```
main                     — the only long-lived branch
<type>/<description>     — branched from main, PR back to main; <type> matches
                            the PR's eventual Conventional Commits type
                            (feature/, fix/, chore/, docs/, test/, ci/, ...)
```

### Rules

- **Always branch from `main`.** There's no `develop` or `develop_redcap_em` to choose between any more — the library has no hard REDCap dependencies in the JS (REDCap-specific behaviour is wired at runtime via options: `backend`, `patientProvider`, terminology options), and `redcap_pedigree_editor` consumes a pinned, versioned GitHub Release build of this repo rather than a REDCap-specific branch. A feature branch that works generically is the only kind there is now.
- **PRs into `main` are squash-merge only**, commit message = PR title + description, so `main` has exactly one clean commit per PR.
- **PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/)** (`feat:`, `fix:`, `chore:`, etc.) — enforced by `.github/workflows/pr-title-lint.yml`, since `release-please` parses these off `main` to compute the next version and changelog.
- **Releasing is automated by `release-please`** (`.github/workflows/release-please.yml`, `release-type: node` since `package.json` has a real version field): it maintains a standing release PR batching everything merged since the last release, and merging that PR bumps the version, tags `main` (`open-pedigree-v<version>`), and creates a GitHub Release — whose auto-generated source zip is what downstream consumers (e.g. `pedigree-editor-github-release-embed`) pull.
- **Branch protection on `main`**: requires the `build` status check and one approving review; repo admins can bypass both to merge solo (`enforce_admins: false`) — deliberate, since GitHub never allows self-approval regardless of admin status, and this repo doesn't reliably have a second reviewer.
- `docs/branch-delta.md` documents the retired git-flow-era `master`/`develop`/`develop_redcap_em` split for historical reference only — it isn't maintained under this model and shouldn't be treated as current.

### Day-to-day

```bash
# Start new work
git checkout main && git pull
git checkout -b fix/my-thing

# ... make changes, commit ...

git push -u origin fix/my-thing
# Open PR → main on GitHub, titled per Conventional Commits
```

## Commands

```bash
npm install          # Install dependencies
npm start            # Dev server at http://localhost:9000/ (webpack-dev-server, hot reload)
npm run build        # Production build → dist/pedigree.min.js
```

```bash
npm test             # Unit tests (vitest, tests/unit/**/*.test.js, jsdom)
npm run test:e2e     # End-to-end tests (Playwright, tests/e2e/; starts the dev server if needed)
npm run typecheck    # tsc --noEmit (has known pre-existing errors; compare before/after rather than expecting zero)
npx eslint src/      # Lint
```

e2e tests that build their own editor over `localEditor.html`'s must call `retireAutoCreatedEditor(page)` (`tests/e2e/helpers/singleEditor.js`) first, or the page's original Controller also handles every property change.

## Architecture

Open Pedigree is a browser-based genetics pedigree editor. It bundles to a single JS file (`dist/pedigree.min.js`) that exposes `window.OpenPedigree`. The host page calls `OpenPedigree.initialiseEditor(options)`.

### Module alias
Webpack aliases `pedigree` → `src/script/` and `vendor` → `public/vendor/`. All internal imports use `import X from 'pedigree/...'`.

### Core components (`src/script/`)

**`pedigree.ts` — `PedigreeEditor`** (the root)  
Instantiates and wires every subsystem. Sets `window.editor` as the global singleton. Key options: `patientDataUrl`, `returnUrl`, `DEBUG_MODE`, `backend: { save, load }`, `patientProvider`, terminology options (`disorderOptions`, `phenotypeOptions`, `geneOptions`), `questionnaireUrl`/`questionnaireLocal` (see Questionnaire subsystem below). `generateNodeMenu()` builds the node-edit form's field descriptors and tabs entirely from the resolved Questionnaire — there is no hardcoded field list.

**`controller.ts` — `Controller`**  
Listens to custom DOM events (e.g. `pedigree:node:setproperty`, `pedigree:person:drag:newpartner`) fired by the view layer and mutates the graph model accordingly. All inter-component communication flows through these DOM events.

**Model layer (`src/script/model/`)**  
Three-layer graph stack, built bottom-up at startup:
- `BaseGraph` — raw adjacency structure (persons and relationships as vertices)
- `PositionedGraph` — adds x/y layout and ordering algorithms
- `DynamicPositionedGraph` — top-level API used by the rest of the app; supports live edits

`import.js` handles PED, LINKAGE, GEDCOM (Cyrillic), and BOADICEA parsing into `BaseGraph`.  
`export.js` handles PED, BOADICEA, and JSON serialisation.  
`GA4GHFHIRConverter.js` handles GA4GH FHIR pedigree format (Composition + Patient + FamilyMemberHistory + Condition + Observation) — the primary FHIR format.

**View layer (`src/script/view/` + `view.ts`)**  
Uses the [Raphaël](https://dmitrybaranovskiy.github.io/raphael/) SVG library. `View` maintains a `_nodeMap` of node IDs to visual node objects. Node types: `Person`, `PersonGroup`, `Partnership`. Each has a `*Visuals` class (SVG drawing) and a `*Hoverbox` class (interactive handles).

**`saveLoadEngine.ts` — `SaveLoadEngine`**  
Delegates save/load to an injected `backend: { save, load }` object. Serialises to the internal JSON format via `DynamicPositionedGraph.toJSON()`.

**`undoRedo.ts` — `ActionStack`**  
Captures graph state snapshots on each mutating event for undo/redo.

**Terminology subsystem (`src/script/terminology/`)**  
Pluggable terminology backends for disorders, phenotypes, and genes, configured via options passed to `initialiseEditor`.
- `FHIRTerminology` — queries a FHIR R4 ValueSet/$expand endpoint.
- `StaticTerminology` — client-side fuzzy search over a fixed term list (sifter).
- `DelegatingTerminology` — forwards to caller-supplied URL functions.
- `EmptyTerminology` — no-op; prevents null checks when no terminology configured.
- `FhirTerminologyHelper` / `DefaultFhirTerminologyHelper` — FHIR CodeableConcept mapping during GA4GH export.

**Patient provider subsystem (`src/script/patientProvider/`)**  
Pluggable provider for FHIR Patient sourcing, configured via `patientProvider` option.
- `EmptyPatientProvider` — default no-op (hides patient-related UI).
- `FHIRPatientProvider` — FHIR R4 Patient search and Condition import via native `fetch`. Exported as `OpenPedigree.FHIRPatientProvider`.
- Person nodes carry a `linkedPatientRef` property (e.g. `"Patient/123"`) persisted in the JSON serialisation and used as a stable ID in GA4GH export.

**Questionnaire subsystem (`src/script/questionnaire/`)** — the node-edit form's source of truth  
A FHIR `Questionnaire` (configured via `questionnaireUrl`/`questionnaireLocal`, or `defaultQuestionnaire.ts`'s `DEFAULT_QUESTIONNAIRE` when neither is supplied) drives the *entire* node-edit form — there is always an effective Questionnaire; a supplied one fully replaces the default rather than merging with it.
- `questionnaireParser.ts` — `parseQuestionnaire()` walks `Questionnaire.item[]` into flat field descriptors. Each top-level `group` becomes a node-menu tab (keyed by `linkId`, labelled by `text`); nested groups become heading pseudo-fields. Exports `MAPS_TO_FIELD_TARGETS` (scalar properties an item can bind to via `mapsToField`, e.g. `gender`/`carrierStatus`/`monozygotic`) and `RESERVED_LEGEND_TARGETS` (the three well-known linkIds — `disorders`/`candidate_genes`/`hpo_positive` — that bind to the existing `DisorderLegend`/`GeneLegend`/`PhenotypeLegend` and their real `Person` setters, rather than the generic per-linkId legend mechanism below).
- A single non-standard extension, `.../questionnaire-field-mapping`, gives each item a mapping *kind*: `mapsToField` (existing scalar property), `mapsToCondition`/`mapsToObservation` (a fixed-code Condition/Observation, keyed off `item.code`), `mapsToLegendCondition`/`mapsToLegendObservation` (a repeating, terminology-backed, colour-legend-tracked field — e.g. disorders, or a new implementer-defined one), or `invokesAction` (a button invoking a built-in named action — `linkPatient`/`importClinicalData` — via a second `.../questionnaire-action` extension).
- `enableWhenEvaluator.ts` / `graphPredicateEvaluator.ts` — evaluates `enableWhen` (visibility) and a second, non-standard `disabledWhen` (enabled/disabled) condition list per item. A condition normally compares another item's answer, but may instead reference a named graph/app-state predicate (via `.../questionnaire-enable-predicate`, e.g. `isFetus`, `isTwinWithConsistentGender`, `canLinkPatient`) — the closed vocabulary needed for rules with no FHIR equivalent. A `radio`/`select` item can additionally declare `disablingPredicate`/`disablingPredicateTarget` to grey out (not hide) *specific option values* (e.g. `possibleGenders` disabling one gender option) rather than the whole item.
- `Person.getSummary()` (`view/person.ts`) evaluates every item generically each time the node menu opens, producing `{value, inactive, disabled}` per `linkId` — there is no per-field bespoke logic left in `Person`.
- `defaultQuestionnaire.ts` — `DEFAULT_QUESTIONNAIRE`, exported as `OpenPedigree.defaultQuestionnaire` (and, via `dist/defaultQuestionnaire.json`, generated at build time for non-JS consumers) so implementers can spread it (`{ ...OpenPedigree.defaultQuestionnaire, item: [...] }`) rather than reproduce it.
- `view/legend.ts`'s `Legend` base class is directly usable (given an `idPrefix`) for any `mapsToLegendCondition`/`mapsToLegendObservation` item, not just the three built-in subclasses.
- GA4GH export/import: `GA4GHFHIRConverter.ts` derives `Condition`/`Observation` resources from a node's `QuestionnaireResponse` for `mapsToCondition`/`mapsToObservation`/`mapsToLegendCondition`/`mapsToLegendObservation` items — except the three `RESERVED_LEGEND_TARGETS` linkIds, whose resources are still built directly from `nodeProperties` (the existing, non-lossy `addConditions`/`addObservations` path) to avoid regenerating already-correct FHIR from a lossy single-`valueCoding` round-trip.

### OOP conventions
- New code uses TypeScript ES6 classes. Inter-component calls go through `window.editor.getXxx()` accessors or DOM custom events (`pedigree:node:setproperty` etc.).
- `$super` is reserved in the Terser minifier config — do not use it as a variable name.
