import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// The website's example pedigrees as layout tests (pedigree-example-pedigrees-site): each published
// examples/<name>/pedigree.json is loaded the way the site opens it (localEditor.html?example=<name>)
// and its drawing checked: everyone imported with the right parents, no line through anyone's
// symbol, each generation level, and every couple who share an ancestor drawn as consanguineous.
// A check that fails on today's layout is marked with test.fail() and the problem it shows.

const EXAMPLES = path.join(__dirname, '..', '..', 'examples');
const names = fs.readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(EXAMPLES, d.name, 'pedigree.json')))
  .map((d) => d.name).sort();

// Checks known to fail on today's layout: { '<example>': { '<check>': 'the problem' } }.
const KNOWN_PROBLEMS = {};

// The example's source: each person's label, and the [child, father, mother] triples. A label is
// what the drawing shows: name, else comment, else (in an example with id labels) the id, else '?'.
function sourceOf(name) {
  const example = JSON.parse(fs.readFileSync(path.join(EXAMPLES, name, 'example.json'), 'utf8'));
  const people = example.people;
  const labelOf = (p) => p.name || p.comment || (example.idLabels ? p.id : '?');
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const triples = people.filter((p) => p.father)
    .map((p) => [labelOf(p), labelOf(byId[p.father]), labelOf(byId[p.mother])].join(' | ')).sort();
  // couples who share an ancestor (or one is the other's ancestor): the consanguineous ones
  const ancestors = (id, seen = new Set()) => {
    const p = byId[id];
    [p.father, p.mother].filter(Boolean).forEach((a) => {
      if (!seen.has(a)) {
        seen.add(a);
        ancestors(a, seen);
      }
    });
    return seen;
  };
  const couples = new Map();
  people.filter((p) => p.father).forEach((p) => couples.set(p.father + '+' + p.mother, [p.father, p.mother]));
  const consanguineous = [...couples.values()].filter(([f, m]) => {
    const af = ancestors(f);
    const am = ancestors(m);
    return af.has(m) || am.has(f) || [...af].some((a) => am.has(a));
  }).map(([f, m]) => [labelOf(byId[f]), labelOf(byId[m])].sort().join(' + ')).sort();
  return { count: people.length, triples, consanguineous };
}

async function open(page, name) {
  const value = fs.readFileSync(path.join(EXAMPLES, name, 'pedigree.json'), 'utf8');
  page.on('dialog', (dialog) => dialog.dismiss());
  // no terminology server: the file carries its terms' names
  await page.route(/ontoserver|\/fhir\//, (route) => route.abort());
  await page.addInitScript(({ key, stored }) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(key, JSON.stringify({ value: stored }));
    }
  }, { key: 'example-' + name, stored: value });
  await page.goto('/localEditor.html?example=' + name);
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => window.editor && !window.editor.isAwaitingFirstLoad())).toBe(true);
}

// What the drawing holds: people (label, rank, y, symbol box), each relationship's partners,
// children and whether its partner lines are drawn double, and every line segment with its owner.
const drawing = (page) => page.evaluate(() => {
  const editor = window.editor;
  const DG = editor.getGraph().DG;
  const GG = DG.GG;
  const view = editor.getView();
  const people = {};
  const relationships = {};
  for (let v = 0; v < GG.v.length; v++) {
    if (GG.isPerson(v)) {
      const props = GG.properties[v];
      const box = view.getNode(v).getGraphics().getGenderShape().getBBox();
      people[v] = {
        label: props.fName || props.comments || props.externalID || '?',
        rank: DG.ranks[v],
        y: view.getNode(v).getY(),
        box: { x: box.x, y: box.y, x2: box.x2, y2: box.y2 },
        gender: GG.getGender(v),
        parents: GG.getParents(v),
      };
    } else if (GG.isRelationship(v)) {
      // the partner lines: a path is "doubled" when another runs alongside it, 5 px away
      const paths = [];
      view.getNode(v).getGraphics()._partnerConnections.forEach((el) => {
        if (el.type === 'path') {
          const b = el.getBBox();
          if (b.width > 12 || b.height > 12) paths.push(b);
        }
      });
      // (the second line is drawn about 5 px off the first, sideways and/or up or down; corners too)
      const twin = (a) => paths.some((b) => {
        const offset = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        return b !== a && offset > 3.5 && offset < 8 && Math.abs(a.width - b.width) < 12 && Math.abs(a.height - b.height) < 12;
      });
      relationships[v] = {
        partners: GG.getParents(v),
        children: GG.getOutEdges(GG.getRelationshipChildhub(v)),
        doubled: paths.length > 0 && paths.every(twin),
      };
    }
  }
  const lines = view._lineSet._lines.map((l) => ({ owner: l.owner, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }));
  return { people, relationships, lines };
});

// Whether segment (x1,y1)-(x2,y2) passes through the box (Liang-Barsky clipping).
function crosses(l, box) {
  let t0 = 0;
  let t1 = 1;
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  for (const [p, q] of [[-dx, l.x1 - box.x], [dx, box.x2 - l.x1], [-dy, l.y1 - box.y], [dy, box.y2 - l.y1]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}

const checks = {
  'everyone is imported with their parents': (d, source) => {
    const people = Object.values(d.people);
    expect(people).toHaveLength(source.count);
    const byId = d.people;
    const triples = people.filter((p) => p.parents.length).map((p) => {
      const [a, b] = p.parents.map((id) => byId[id]);
      const [father, mother] = a.gender === 'M' ? [a, b] : [b, a];
      return [p.label, father.label, mother.label].join(' | ');
    }).sort();
    expect(triples).toEqual(source.triples);
  },
  'no line runs through anyone\'s symbol': (d) => {
    const through = [];
    d.lines.forEach((l) => {
      const rel = d.relationships[l.owner];
      // a relationship's own lines end at its partners and children
      const own = rel ? new Set([...rel.partners, ...rel.children].map(String)) : new Set();
      Object.entries(d.people).forEach(([id, p]) => {
        if (own.has(id)) return;
        // (2 px in from the symbol's edge: a line passing alongside isn't through it)
        const box = { x: p.box.x + 2, y: p.box.y + 2, x2: p.box.x2 - 2, y2: p.box.y2 - 2 };
        if (crosses(l, box)) through.push(`${p.label}: a line of ${rel ? rel.partners.map((q) => d.people[q].label).join(' + ') : l.owner}`);
      });
    });
    expect(through).toEqual([]);
  },
  'each generation is level': (d) => {
    const ys = {};
    Object.values(d.people).forEach((p) => {
      (ys[p.rank] = ys[p.rank] || new Set()).add(Math.round(p.y));
    });
    const uneven = Object.entries(ys).filter(([, set]) => set.size > 1).map(([rank, set]) => `rank ${rank}: y ${[...set].join(', ')}`);
    expect(uneven).toEqual([]);
  },
  'couples who share an ancestor are drawn as consanguineous, and only they': (d, source) => {
    const drawnDouble = Object.values(d.relationships).filter((r) => r.doubled)
      .map((r) => r.partners.map((id) => d.people[id].label).sort().join(' + ')).sort();
    expect(drawnDouble).toEqual(source.consanguineous);
  },
};

for (const name of names) {
  test.describe(`example ${name}`, () => {
    for (const [check, run] of Object.entries(checks)) {
      test(check, async ({ page }) => {
        const known = (KNOWN_PROBLEMS[name] || {})[check];
        test.fail(Boolean(known), known);
        await open(page, name);
        run(await drawing(page), sourceOf(name));
      });
    }
  });
}
