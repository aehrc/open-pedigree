<p align="center">
  <img src="https://repository-images.githubusercontent.com/212736090/2759df80-fe9e-11e9-8fa0-8237e35cbaf7" width="400px" alt="Open Pedigree logo"/>
</p>

<p align="center">
  <a href="https://github.com/phenotips/open-pedigree/actions/workflows/ci.yml">
    <img src="https://github.com/phenotips/open-pedigree/actions/workflows/ci.yml/badge.svg?branch=master" alt="Build status">
  </a>
  <a href="https://opensource.org/licenses/LGPL-2.1" target="_blank">
    <img src="https://img.shields.io/badge/license-LGPL--2.1-blue.svg" alt="LGPL-2.1">
  </a>
  <a href="https://aehrc.github.io/open-pedigree/" target="_blank">
    <img src="https://img.shields.io/badge/demo-live-brightgreen.svg" alt="Live demo">
  </a>
  <img src="https://img.shields.io/badge/made%20in-australia-green.svg" alt="Made in Australia">
</p>


## A free and open-source pedigree tool powered by PhenoTips®

**[Try the live demo](https://aehrc.github.io/open-pedigree/)**

Open Pedigree is a robust browser-based genomic pedigree drawing solution using [Raphaël](https://dmitrybaranovskiy.github.io/raphael/) and [PhenoTips](https://phenotips.org).

<img width="983" alt="image" src="https://user-images.githubusercontent.com/4251264/68103796-e1048080-fe9d-11e9-9353-6b491aae588d.png">


## Features

✔ Robust support for complex families, intergenerational linkages, and consanguinity

✔ Shade nodes with disorders and/or candidate genes

✔ Quickly start with family templates

✔ Automatic consanguinity detection

✔ Import from PED, LINKAGE, GEDCOM (Cyrillic), BOADICEA, or GA4GH Pedigree (FHIR)

✔ Configurable per-person fields via a FHIR Questionnaire, with answers round-tripped through GA4GH FHIR export/import


## Getting started

### Command line

Quickly get started with open pedigree on your computer:
```
git clone git@github.com:phenotips/open-pedigree.git
cd open-pedigree
npm install
npm start
```
Open a browser to http://localhost:9000/

### Docker

You can also use the supplied Docker image to run the application. To get started:

```
git clone git@github.com:aehrc/open-pedigree.git
cd open-pedigree
docker build . -t open-pedigree
docker run -p 9000:9000 -d open-pedigree
```

## Questionnaire-driven custom fields

Implementers can add extra per-person fields to the node editor's "Custom" tab by pointing the editor at a FHIR `Questionnaire`, instead of forking the editor to add hardcoded fields:

```js
OpenPedigree.initialiseEditor({
  // one of:
  questionnaireLocal: myQuestionnaireResource,       // inline Questionnaire resource, no network fetch
  questionnaireUrl: 'https://fhir.example.org/Questionnaire/123', // fetched at construction time

  // required only if any item uses answerValueSet:
  questionnaireTerminologyBaseUrl: 'https://fhir.example.org',
});
```

`questionnaireUrl` is fetched asynchronously — the editor renders immediately and the Custom tab's fields appear once the fetch resolves (a brief delay, not a race the caller needs to handle). `questionnaireLocal` is available synchronously from the first render.

### Supported item types

A flat-plus-groups subset of the FHIR Questionnaire/SDC item model:

| `item.type` | Rendered as |
|---|---|
| `string`, `text` | text field / textarea |
| `boolean` | checkbox |
| `date` | date picker |
| `integer`, `decimal` | numeric field |
| `choice`, `open-choice` with `answerValueSet` | searchable picker, backed by the editor's terminology subsystem (`questionnaireTerminologyBaseUrl` + a `ValueSet/$expand` call) |
| `choice` with inline `answerOption` | plain dropdown |
| `group` | a non-interactive section heading; children render below it in document order (one level of nesting only — no collapsing) |

`item.enableWhen` (with `enableBehavior: all`/`any`) controls conditional visibility, evaluated against **other items in the same Questionnaire only** — it cannot reference built-in pedigree fields like gender. `enableWhenExpression` (FHIRPath) is not supported.

### Mapping items onto existing FHIR data

An item can optionally map onto something the editor already knows how to export. The mapping extension itself just names the *kind* — the actual target/code comes from core FHIR `Questionnaire.item` fields (`item.definition`, `item.code`), not a bespoke extension, so a Questionnaire built for this stays as portable as possible to other SDC-aware tooling:

```jsonc
{
  "linkId": "carrier",
  "type": "boolean",
  "definition": "https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.carrierStatus",
  "extension": [{ "url": "https://github.com/aehrc/open-pedigree/questionnaire-field-mapping", "valueCode": "mapsToField" }]
}
```

Two mapping kinds:
- **`mapsToField`** — `item.definition` (standard `<canonical-url>#<element-id>` syntax) names the target: one of the editor's existing scalar properties. Six correspond to real Patient elements (`Patient.gender`, `Patient.name.given`/`.family`, `Patient.identifier`, `Patient.birthDate`, `Patient.deceasedDateTime`); four don't map to a single real Patient element (`lifeStatus`, `gestationAge`, `carrierStatus`, `comments` — these become fixed-code Observations, not Patient fields), so they use a self-hosted `PedigreeIndividual` logical model instead (FHIR permits `item.definition` to point at a non-published model just as readily as a real one). Only the *terminal* segment of the fragment is matched, so either canonical base works. The item does **not** render on the Custom tab (the editor already shows that field elsewhere) — the mapping only affects export.
- **`mapsToCondition` / `mapsToObservation`** — `item.code` (a plain `Coding[]`, the same field SDC's own Observation-based extraction uses) gives the code for a genuinely new clinical fact with no existing hardcoded home. The item **does** render on the Custom tab (there's no other UI for it). A `boolean` item mapped to `mapsToCondition` produces a `Condition` when answered `true` (nothing when `false`); any item mapped to `mapsToObservation` produces an `Observation` whenever answered. Derivation happens by walking the already-built `QuestionnaireResponse`'s own `item[]` — the same input/output shape as FHIR SDC's [`QuestionnaireResponse/$extract`](https://build.fhir.org/ig/HL7/sdc/en/OperationDefinition-QuestionnaireResponse-extract.html) operation, just implemented client-side rather than exposed as a server operation (we have no guaranteed FHIR server at export time, e.g. the local storage backend).

Both kinds are **dual-write**: the mapped FHIR element is what a generic FHIR consumer sees and is authoritative on import; a `QuestionnaireResponse` entry is also kept alongside it as a record of what was asked/answered via the Questionnaire, but never overrides the mapped value.

See [`tests/unit/fixtures/current-forms-questionnaire.json`](tests/unit/fixtures/current-forms-questionnaire.json) for a worked example: a Questionnaire that `mapsToField`-maps every eligible scalar property already on the Personal/Clinical tabs.

### Known limitations

- Per-node only — there's no equivalent mechanism for relationship/partnership-level fields.
- `mapsToCondition`/`mapsToObservation` codes should be chosen to not collide with codes your disorder/phenotype terminology might independently produce — a collision causes the generic disorders/phenotypes extraction to route that fact to the mapped item instead of the disorders list.
- PED/BOADICEA/GEDCOM/DADA2 import/export do not carry Questionnaire answers — only GA4GH FHIR does.

## Testing

### Unit tests

```bash
npm test
```

Runs all Vitest unit tests, including tests for `SmartFhirBackend`, `SmartPatientProvider`, and `FHIRPatientProvider`.

### Playwright E2E tests (stub mode)

The E2E suite uses a stub SMART client — no real FHIR server required. Start the dev server first, then run the tests:

```bash
npm start &
npx playwright test
```

The stub helper (`tests/e2e/helpers/smartStub.ts`) intercepts `FHIR.oauth2.ready()` and returns a pre-configured mock client so tests run without OAuth redirects.

### Full-stack SMART on FHIR environment (Docker Compose)

For end-to-end testing against a real SMART OAuth + FHIR server, use the included Docker Compose setup:

```bash
docker compose -f docker-compose.smart.yml up
```

This starts:
- **smart-launcher** at `http://localhost:8080` — a local SMART on FHIR launcher with a built-in FHIR R4 server (HAPI)
- **fhir-seeder** — seeds two test patients and a demo `Questionnaire` on startup, then exits
- **dev-server** at `http://localhost:9000` — the Open Pedigree webpack dev server

**Pre-seeded test patients:**

| Patient ID | Name | Purpose |
|---|---|---|
| `test-patient-a` | Alice Anderson | No prior pedigree; has 2 Conditions (Diabetes, Huntington) — tests new pedigree creation and clinical import |
| `test-patient-b` | Bob Brown | Has an existing GA4GH pedigree Composition (proband + 2 parents + sibling) — tests load/round-trip |

**Pre-seeded Questionnaire:** [`tests/fixtures/smart/questionnaire.json`](tests/fixtures/smart/questionnaire.json) is seeded as `Questionnaire/demo-questionnaire`, and `smartEditor.ts` is configured to launch with `questionnaireUrl` pointing at it — so the node editor's Custom tab is populated automatically. It demonstrates every questionnaire-fields mechanism: a `mapsToField` item (clinical notes → the existing Comments field), a `group` heading, a `mapsToCondition` item (diabetes), a `mapsToObservation` item (smoking status), a plain custom field, and an `enableWhen`-gated field (consent notes, shown only when research consent is checked).

To launch the editor for a test patient, open the smart-launcher's EHR simulation at:

```
http://localhost:8080/launcher?launch_uri=http://localhost:9000/launch.html&patient=test-patient-a&fhir_ver=4
```

Replace `test-patient-a` with `test-patient-b` to test the saved-pedigree load path. Open the node editor's Custom tab to see the seeded Questionnaire's fields.

## Contributing

Contributions welcome! Fork the repository and create a pull request to share your improvements with the community.

In order to ensure that the licensing is clear and stays open, you'll be asked to sign a CLA with your first pull request.


## Support

This is free software! Create an issue in GitHub to ask others for help, or try fixing the issue yourself and then make a pull request to contribute it back to the core.

If you are interested in the Enterprise/commercial version, please contact [PhenoTips](https://phenotips.com/).


## License

Copyright (c) 2019-2022 Gene42 Inc. o/a PhenoTips

Open Pedigree is distributed under the [LGPL-2.1](https://opensource.org/licenses/LGPL-2.1) (GNU Lesser General Public License).

You can easily comply with this license by:
* including prominent notice of the use of Open Pedigree in your software
* retaining all copyright notices in the software
* ensuring that any and all changes you make to the software are published and open-sourced under the LGPL
