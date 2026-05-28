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

```
master                  — stable releases only; tagged v<major>.<minor>
  ├── develop           — generic open-pedigree (upstream-compatible, SMART on FHIR target)
  └── develop_redcap_em — REDCap EM layer; stays in sync with develop

feature/<name>          — branched from develop; merged into BOTH develop and develop_redcap_em
```

### Rules

- **Always branch from `develop`**, not from `develop_redcap_em` or `master`.
- **Merge feature branches into both** `develop` and `develop_redcap_em` to keep them in sync. The library contains no hard REDCap dependencies in the JS — REDCap-specific behaviour is wired at runtime via options (`backend`, `patientProvider`, terminology options). A feature that works generically belongs in both.
- **`develop_redcap_em` only diverges** if JS code is genuinely REDCap-only with no generic use case. This has not occurred yet.
- **`master`** only receives PRs from `develop` or `develop_redcap_em` at release time.
- See `docs/branch-delta.md` for the full history of what exists on each branch and upcoming features.

### Day-to-day

```bash
# Start a new feature
git checkout develop && git pull
git checkout -b feature/my-feature

# ... implement, commit ...

# Merge into develop
git checkout develop
git merge --no-ff feature/my-feature

# Merge into develop_redcap_em to keep in sync
git checkout develop_redcap_em
git merge --no-ff feature/my-feature
```

## Commands

```bash
npm install          # Install dependencies
npm start            # Dev server at http://localhost:9000/ (webpack-dev-server, hot reload)
npm run build        # Production build → dist/pedigree.min.js
```

There is no test suite. Linting uses ESLint (`.eslintrc`):
```bash
npx eslint src/
```

## Architecture

Open Pedigree is a browser-based genetics pedigree editor. It bundles to a single JS file (`dist/pedigree.min.js`) that exposes `window.OpenPedigree`. The host page calls `OpenPedigree.initialiseEditor(options)`.

### Module alias
Webpack aliases `pedigree` → `src/script/` and `vendor` → `public/vendor/`. All internal imports use `import X from 'pedigree/...'`.

### Core components (`src/script/`)

**`pedigree.ts` — `PedigreeEditor`** (the root)  
Instantiates and wires every subsystem. Sets `window.editor` as the global singleton. Key options: `patientDataUrl`, `returnUrl`, `DEBUG_MODE`, `backend: { save, load }`, `patientProvider`, terminology options (`disorderOptions`, `phenotypeOptions`, `geneOptions`).

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

### OOP conventions
- New code uses TypeScript ES6 classes. Inter-component calls go through `window.editor.getXxx()` accessors or DOM custom events (`pedigree:node:setproperty` etc.).
- `$super` is reserved in the Terser minifier config — do not use it as a variable name.
