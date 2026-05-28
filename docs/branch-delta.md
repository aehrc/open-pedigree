# Branch Delta Reference

_Generated 2026-05-28. Updated 2026-05-28 — new branch model established._

---

## Branch Model

```
master                  — stable releases only; tagged v<major>.<minor>
  ├── develop           — generic open-pedigree (upstream-compatible, SMART on FHIR target)
  └── develop_redcap_em — REDCap EM layer on top of develop

feature/<name>          — branched from develop; merged into both develop and develop_redcap_em
                          (or develop_redcap_em only if strictly REDCap-specific)
```

### Key decisions

- **`develop`** is the generic open-pedigree baseline — no hard REDCap dependencies in the JS library. REDCap-specific behaviour is provided by options passed to `initialiseEditor()` at runtime (terminology delegation, backend save/load, patient provider). `develop` is the base for the planned SMART on FHIR standalone editor.

- **`develop_redcap_em`** stays in sync with `develop` by merging feature branches into both. It diverges only if JS code is genuinely REDCap-only (none identified so far — the REDCap-specific integration lives in the EM PHP repo, not here).

- **Feature branches** (e.g. `feature/patient-provider`) target `develop`. They are then also merged into `develop_redcap_em` to keep the branches in sync.

- **`master`** receives stable releases via PR from `develop` or `develop_redcap_em` depending on which line is being released.

### Branch origins

| Branch | Started from | Notes |
|--------|-------------|-------|
| `develop` | `feature/redcap_em_0.4_upgrade` tip | EM branch had the most complete code (TS migration + remove-prototype + FHIR subsystem). Infra commits from `feature/backport` cherry-picked on top (GitHub Pages, CI Node 24, Docker). |
| `develop_redcap_em` | `develop` | Starts identical; diverges only on genuinely REDCap-specific JS additions. |
| `feature/patient-provider` | `develop` | First feature branch under the new model. Merged into both. |

---

## Historical: EM Branch Delta (feature/redcap_em_0.4_upgrade vs master)

This section documents what existed on the EM branch that master lacked. All items were incorporated into `develop` when it was created from the EM branch tip.

### Files that were unique to the EM branch

| File | Classification | Notes |
|------|---------------|-------|
| `src/script/GA4GHFHIRConverter.js` | generic | GA4GH FHIR pedigree format (Composition + Patient + FMH + Condition + Observation). Primary FHIR format for SMART on FHIR work. Replaces old `FHIRConverter.js`. |
| `src/script/localStorageBackend.js` | generic | Extracted backend object; decouples storage from SaveLoadEngine. Pattern for SMART on FHIR backend. |
| `src/script/FhirTerminologyHelper.ts` | generic | Abstract base for FHIR CodeableConcept mapping during GA4GH export. |
| `src/script/DefaultFhirTerminologyHelper.ts` | generic | Default implementation of FhirTerminologyHelper. |
| `src/script/terminology/DelegatingTerminology.ts` | generic | Delegates to caller-supplied URL functions; used in REDCap via options but the class itself is generic. |
| `src/script/terminology/EmptyTerminology.ts` | generic | No-op provider; prevents null checks when no terminology configured. |
| `src/script/terminology/StaticTerminology.ts` | generic | Client-side fuzzy search over a fixed term list (sifter). |
| `src/script/terminology/abstractAjaxTerminology.ts` | generic | Base class for AJAX-backed terminology providers. |
| `src/script/terminology/BioportalTerminology.ts` | generic | NCBO BioPortal backend; useful as a worked example alongside `abstractAjaxTerminology`. |
| `localEditor.html` | generic | Standalone page with configurable terminology and format options. Reference for `smartEditor.html`. |

### Files removed when backporting

| File | Reason |
|------|--------|
| `src/script/model/FHIRConverter.js` | Replaced by `GA4GHFHIRConverter.js` |
| `src/script/terminology/termFactory.js` | Replaced by options-based terminology init |
| `src/script/terminology/terminologyManger.js` | Global TerminologyManager pattern retired |

### Key differences in shared files

#### `src/script/pedigree.ts`

The EM branch introduced an options-based API (`disorderOptions`, `phenotypeOptions`, `geneOptions`, pluggable `backend: { save, load }`) in place of the old static `TerminologyManager` approach. This is the right direction and is the baseline in `develop`.

#### `src/script/saveLoadEngine.ts`

The EM branch refactored `SaveLoadEngine` to accept injected `save`/`load` functions rather than handling HTTP and localStorage inline. This is the pluggable backend pattern that all future backends (SMART on FHIR, REDCap) follow.

---

## Feature Branch Survey (historical)

### `feature/fhirImportExport` — superseded
0 commits ahead of master at time of survey. Superseded by GA4GHFHIRConverter.

### `feature/ga4gh_fhir` — reviewed
Contains consanguinity (`consangr`) extension for partnership export. Verify this is included in GA4GHFHIRConverter on `develop` before finalising GA4GH support.

### `feature/terminology` — superseded
Original customisable terminology system; incorporated into EM branch with better design. Nothing to recover.

### `feature/export_GA4GH_FHIR` — superseded
Original GA4GH implementation; superseded by GA4GHFHIRConverter.

### `feature/export_pdf` — future candidate
Adds PDF export via PDFKit + svg-to-pdfkit. Not yet on develop. Self-contained future feature.

### `feature/questionnaire` — partial review
Notable items:
- `MessageToLocalAdapter.js` — two-window postMessage pattern. Not relevant to SMART on FHIR (single-window), but worth noting for future REDCap EM event streaming.
- `REDCapFHIRTerminology.js` — REDCap-specific; stays on develop_redcap_em if ever ported.
- `QuestionnaireConverter.js` — FHIR Questionnaire format; separate future feature.
- `NameSplitter.js` — utility now superseded by `FHIRPatientProvider.extractPatientNameParts`.

### `replace-suggest`, `dependency-upgrade` — merged
Fully incorporated into master/develop.

---

## Upcoming Features

### SMART on FHIR (Change 2)

Builds on top of `patient-provider`. Key dependencies already on `develop`:
- `GA4GHFHIRConverter.js` — storage format
- `localStorageBackend.js` — backend pattern to follow
- `FhirTerminologyHelper` — terminology mapping
- `localEditor.html` — reference for `smartEditor.html`
- `FHIRPatientProvider` — patient sourcing (via `feature/patient-provider`)

Outstanding: verify `consangr` consanguinity extension from `feature/ga4gh_fhir` is in `GA4GHFHIRConverter.js` on `develop`.

### PDF export

Self-contained; can be a standalone feature branch off `develop` when prioritised.
