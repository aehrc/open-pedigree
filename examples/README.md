# Example pedigrees

The pedigrees on open-pedigree's website (`https://aehrc.github.io/open-pedigree/examples/<name>/`). They are also e2e layout tests (`tests/e2e/example-layouts.spec.js`). Each folder holds:

| File | What it is |
| --- | --- |
| `example.json` | The pedigree's source: its people and their properties (below). Hand-written. |
| `about.json` | What the page says about it (below). Hand-written. |
| `pedigree.json` | The GA4GH FHIR pedigree, as the editor saves it: the download, and what *Open in the editor* loads. Generated. |
| `pedigree.svg` | The picture on the page, as the editor draws it. Generated. |
| `questionnaire.json` | Only for a *form* example: its own FHIR Questionnaire, the node form it is drawn and opened with. Hand-written. |

`npm run build` and then `npm run examples:build` regenerate every example's `pedigree.json` and `pedigree.svg` by drawing its `example.json` in the built editor. `npm run examples:check` (in CI) fails if a committed `pedigree.json` no longer matches its source.

## `example.json`

```json
{
  "people": [
    { "id": "mother", "sex": "F", "name": "Ada", "comment": "1850-1921", "status": "deceased", "carrier": "carrier",
      "disorders": [{ "id": "http://purl.bioontology.org/ontology/OMIM/306900", "name": "Hemophilia B" }] },
    { "id": "father", "sex": "M", "name": "Tom", "status": "deceased" },
    { "id": "son", "sex": "M", "father": "father", "mother": "mother", "name": "Leo", "proband": true,
      "disorders": [{ "id": "http://purl.bioontology.org/ontology/OMIM/306900", "name": "Hemophilia B" }] }
  ]
}
```

- `id`: unique in the example. Letters, digits and dashes. Not shown, unless the example sets `"idLabels": true` (beside `people`): then it is the label (e.g. `II-3`) of anyone with neither a `name` nor a `comment`.
- `proband`: `true` for the proband (at most one; the arrow). Without one, the first person listed is the proband.
- `sex`: `M`, `F` or `U`.
- `father`, `mother`: ids of people in the example, or absent for someone whose parents aren't drawn. A person has both parents or neither.
- `name`: a first name (optional); `surname` (optional).
- `comment`: shown under the symbol; `\n` starts a new line. Years go here (`1819-1901`), since the editor's dates are full dates.
- `status`: `alive` (default), `deceased`, `stillborn`, `miscarriage`, `aborted` or `unborn`.
- `disorders`: each disorder's code as the demo's terminology gives it (OMIM, as `http://purl.bioontology.org/ontology/OMIM/<number>` - look it up in the `http://www.omim.org/vs` value set on `tx.ontoserver.csiro.au`), with the name to show.
- `carrier`: `carrier` or `presymptomatic` for a person with `disorders` who isn't affected by them (a carrier is drawn with the disorder's colour and a dot). An affected person needs none.

- `answers`: only in a *form* example, the person's answers to its own form, by linkId: a value as the form stores it (`true`, a number, text, or a choice's code such as `"LA6576-8"`), or for a custom legend item a list of `{ "id": <code>, "name": <display> }` like `disorders`. Every linkId must be an item of `questionnaire.json`.

Partnerships are the couples who have a child together; there are no others.

## `about.json`

```json
{
  "title": "Queen Victoria and haemophilia B",
  "kind": "historic",
  "order": 12,
  "summary": "One sentence for the landing page.",
  "shows": ["What the drawing shows, a paragraph each."],
  "hard": ["Why it is hard to draw, a paragraph each."],
  "source": { "citation": "Rogaev EI et al. (2009) ...", "doi": "10.1126/science.1180660", "figure": "Fig. S1" },
  "simplified": ["What was left out or left open, one item each."]
}
```

`kind` is `classic` (no `source` or `simplified`), `historic` (both required) or `form`. `order` places it in its list on the landing page.

A `form` example has a `questionnaire.json`, and `about.json` adds `"questionnaire": [{ "linkId": ..., "what": ... }]`: the notable items, each shown on the page with what it does. Its form must pass `OpenPedigree.checkQuestionnaire` with no problems (the build refuses it otherwise). Start it from `dist/defaultQuestionnaire.json` and add a tab, so the rest of the form stays as the editor's own. Historic families are drawn from the cited figure only: never from another editor's files or from uncited genealogy. Anything the figure leaves open is left unset here, and listed under `simplified`.
