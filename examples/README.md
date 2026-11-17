# Example pedigrees

The pedigrees on open-pedigree's website (`https://aehrc.github.io/open-pedigree/examples/<name>/`). They are also e2e layout tests (`tests/e2e/example-layouts.spec.js`). Each folder holds:

| File | What it is |
| --- | --- |
| `example.json` | The pedigree's source: its people and their properties (below). Hand-written. |
| `about.json` | What the page says about it (below). Hand-written. |
| `pedigree.json` | The GA4GH FHIR pedigree, as the editor saves it: the download, and what *Open in the editor* loads. Generated. |
| `pedigree.svg` | The picture on the page, as the editor draws it. Generated. |

`npm run build` and then `npm run examples:build` regenerate every example's `pedigree.json` and `pedigree.svg` by drawing its `example.json` in the built editor. `npm run examples:check` (in CI) fails if a committed `pedigree.json` no longer matches its source.

## `example.json`

```json
{
  "people": [
    { "id": "victoria", "sex": "F", "father": "edward", "mother": "victoria-saxe", "name": "Victoria",
      "comment": "1819-1901", "status": "deceased", "carrier": "carrier" },
    { "id": "leopold", "sex": "M", "father": "albert", "mother": "victoria", "name": "Leopold",
      "comment": "1853-1884", "status": "deceased", "disorders": [{ "id": "306900", "name": "Hemophilia B" }] }
  ]
}
```

- `id`: unique in the example. Letters, digits and dashes. Shown as the person's label (e.g. `II-3`) only when they have neither a `name` nor a `comment`.
- `proband`: `true` for the proband (at most one; the arrow). Without one, the first person listed is the proband.
- `sex`: `M`, `F` or `U`.
- `father`, `mother`: ids of people in the example, or absent for someone whose parents aren't drawn. A person has both parents or neither.
- `name`: a first name (optional); `surname` (optional).
- `comment`: shown under the symbol; `\n` starts a new line. Years go here (`1819-1901`), since the editor's dates are full dates.
- `status`: `alive` (default), `deceased`, `stillborn`, `miscarriage`, `aborted` or `unborn`.
- `disorders`: OMIM codes, as the demo's terminology codes them, each with the name to show.
- `carrier`: `carrier`, `affected` or `presymptomatic`. An affected person with disorders needs none.

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

`kind` is `classic` (no `source` or `simplified`) or `historic` (both required). `order` places it in its list on the landing page. Historic families are drawn from the cited figure only: never from another editor's files or from uncited genealogy. Anything the figure leaves open is left unset here, and listed under `simplified`.
