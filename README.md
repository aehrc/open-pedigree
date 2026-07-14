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
- **fhir-seeder** — seeds two test patients on startup, then exits
- **dev-server** at `http://localhost:9000` — the Open Pedigree webpack dev server

**Pre-seeded test patients:**

| Patient ID | Name | Purpose |
|---|---|---|
| `test-patient-a` | Alice Anderson | No prior pedigree; has 2 Conditions (Diabetes, Huntington) — tests new pedigree creation and clinical import |
| `test-patient-b` | Bob Brown | Has an existing GA4GH pedigree Composition (proband + 2 parents + sibling) — tests load/round-trip |

To launch the editor for a test patient, open the smart-launcher's EHR simulation at:

```
http://localhost:8080/launcher?launch_uri=http://localhost:9000/launch.html&patient=test-patient-a
```

Replace `test-patient-a` with `test-patient-b` to test the saved-pedigree load path.

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
