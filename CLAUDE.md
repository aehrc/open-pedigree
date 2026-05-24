# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

Use **OpenSpec** for all non-trivial changes:

- `/opsx:ff` — propose + design + specs + tasks in one go (recommended for most changes)
- `/opsx:new` — step-by-step artifact creation
- `/opsx:apply` — implement tasks from a change
- `/opsx:verify` — check implementation before archiving
- `/opsx:archive` — finalise a completed change

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

Open Pedigree is a browser-based genetics pedigree editor. It bundles to a single JS file (`dist/pedigree.min.js`) that exposes `window.OpenPedigree`. The host page loads Prototype.js and other vendor libraries separately (they are webpack externals), then calls `OpenPedigree.initialiseEditor(options)`.

### Module alias
Webpack aliases `pedigree` → `src/script/` and `vendor` → `public/vendor/`. All internal imports use `import X from 'pedigree/...'`.

### Core components (`src/script/`)

**`pedigree.js` — `PedigreeEditor`** (the root)  
Instantiates and wires every subsystem. Sets `window.editor` as the global singleton. Options accepted: `patientDataUrl`, `returnUrl`, `DEBUG_MODE`.

**`controller.js` — `Controller`**  
Listens to custom DOM events (e.g. `pedigree:node:setproperty`, `pedigree:person:drag:newpartner`) fired by the view layer and mutates the graph model accordingly. All inter-component communication flows through these DOM events.

**Model layer (`src/script/model/`)**  
Three-layer graph stack, built bottom-up at startup:
- `BaseGraph` — raw adjacency structure (persons and relationships as vertices)
- `PositionedGraph` — adds x/y layout and ordering algorithms
- `DynamicPositionedGraph` — top-level API used by the rest of the app; supports live edits

`import.js` handles PED, LINKAGE, GEDCOM (Cyrillic), and BOADICEA parsing into `BaseGraph`.  
`export.js` handles PED, BOADICEA, and JSON serialisation.  
`FHIRConverter.js` handles FHIR Composition/List import and export (non-standard; see README for mapping limitations).  
`GA4GHFHIRConverter.js` handles GA4GH FHIR export.

**View layer (`src/script/view/` + `view.js`)**  
Uses the [Raphaël](https://dmitrybaranovskiy.github.io/raphael/) SVG library (loaded via npm, not a vendor script). `View` maintains a `_nodeMap` of node IDs to visual node objects. Node types: `Person`, `PersonGroup`, `Partnership`. Each has a `*Visuals` class (SVG drawing) and a `*Hoverbox` class (interactive handles).

Legends (`disorderLegend.js`, `phenotypeLegend.js`, `geneLegend.js`) track which disorders/phenotypes/genes are in use and display a colour key.

**`saveLoadEngine.js` — `SaveLoadEngine`**  
Loads/saves pedigree data via AJAX to the `patientDataUrl` passed at init. Serialises to the internal JSON format via `DynamicPositionedGraph.toJSON()`. Also supports `localStorageBackend` for standalone use.

**`undoRedo.js` — `ActionStack`**  
Captures graph state snapshots on each mutating event for undo/redo.

**Terminology subsystem (`src/script/terminology/`)**  
Pluggable terminology backends for disorders, phenotypes, and genes.  
- Terminology type is configured via options passed to `initialiseEditor` (not hardcoded).
- `FHIRTerminology` queries a FHIR R4 server: `ValueSet/$expand` for search, `CodeSystem/$lookup` for label resolution. Default server: `https://tx.ontoserver.csiro.au/fhir/`.
- `StaticTerminology` provides client-side fuzzy search over a fixed term list (uses `sifter`).
- `DelegatingTerminology` forwards requests to a custom URL function (used by REDCap module).
- `FhirTerminologyHelper` / `DefaultFhirTerminologyHelper` handle FHIR resource coding during import/export.

### External (vendor) dependencies
Loaded by the host HTML, **not** bundled — declared as webpack externals:
- **PrototypeJS 1.7.3** — `Class.create()`, `$()`, `$$()`, Ajax, DOM events (`document.observe`, `document.fire`)
- **Scriptaculous** — drag-and-drop, visual effects
- jQuery, XWiki REST API helpers, PhenoTips widgets, Selectize (autocomplete)

All classes use `Class.create()` from PrototypeJS. The global `editor` variable is the `PedigreeEditor` instance.

### OOP conventions
- Use PrototypeJS `Class.create({ initialize: function(){...}, ... })` for new classes.
- `$super` is reserved in the Terser minifier config — do not rename it.
- Inter-component calls go through `window.editor.getXxx()` accessors or DOM custom events.
