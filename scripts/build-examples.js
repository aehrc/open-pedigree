#!/usr/bin/env node
/**
 * Draws each example pedigree (examples/<name>/example.json) in the built editor and saves what the
 * website publishes: examples/<name>/pedigree.json (the GA4GH FHIR pedigree, as the editor saves it)
 * and examples/<name>/pedigree.svg (the editor's picture). See examples/README.md.
 *
 * The editor does the drawing, through its own paths: the people are imported as PED, then each
 * person's properties are set with `pedigree:node:setproperty`, and the pedigree is saved as GA4GH.
 * Disorder names come from example.json, so no terminology server is needed.
 *
 * Usage (after `npm run build`):
 *   node scripts/build-examples.js [name ...]           regenerate (all, or the named examples)
 *   node scripts/build-examples.js --check [name ...]   fail if a committed pedigree.json differs
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLES = path.join(ROOT, 'examples');
const SEXES = { M: 1, F: 2, U: 0 };
const STATUSES = ['alive', 'deceased', 'stillborn', 'miscarriage', 'aborted', 'unborn'];
const CARRIERS = ['carrier', 'affected', 'presymptomatic'];
const ID = /^[A-Za-z0-9-]+$/;
// the storage key the drawing is saved under (localEditor.html's `example` parameter)
const KEY = 'example-build';

/**
 * The example names: every examples/<name>/ with an example.json. A name must be what
 * localEditor.html accepts in ?example= (else the site would open the visitor's own pedigree).
 */
function exampleNames() {
  const names = fs.readdirSync(EXAMPLES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(EXAMPLES, d.name, 'example.json')))
    .map((d) => d.name).sort();
  const bad = names.filter((n) => !/^[a-z0-9-]+$/.test(n));
  if (bad.length) {
    throw new Error('example folder names must be lower-case letters, digits and dashes: ' + bad.join(', '));
  }
  return names;
}

/** example.json, checked: every problem is reported, by person. */
function readExample(name) {
  const example = JSON.parse(fs.readFileSync(path.join(EXAMPLES, name, 'example.json'), 'utf8'));
  const problems = [];
  const people = example.people || [];
  const ids = new Set();
  people.forEach((p, i) => {
    const who = p.id ? `"${p.id}"` : `person ${i + 1}`;
    if (!p.id || !ID.test(p.id)) problems.push(`${who}: id must be letters, digits and dashes`);
    if (ids.has(p.id)) problems.push(`${who}: id used twice`);
    ids.add(p.id);
    if (!(p.sex in SEXES)) problems.push(`${who}: sex must be M, F or U`);
    if (!p.father !== !p.mother) problems.push(`${who}: give both parents or neither`);
    if (p.status && !STATUSES.includes(p.status)) problems.push(`${who}: status must be one of ${STATUSES.join(', ')}`);
    if (p.carrier && !CARRIERS.includes(p.carrier)) problems.push(`${who}: carrier must be one of ${CARRIERS.join(', ')}`);
    (p.disorders || []).forEach((d) => {
      if (!d.id || !d.name) problems.push(`${who}: each disorder needs an id and a name`);
    });
  });
  people.forEach((p) => {
    ['father', 'mother'].forEach((role) => {
      if (p[role] && !ids.has(p[role])) problems.push(`"${p.id}": ${role} "${p[role]}" isn't in the example`);
    });
  });
  if (!people.length) problems.push('no people');
  if (people.filter((p) => p.proband).length > 1) problems.push('only one person can be the proband');
  // an example with its own form: questionnaire.json beside it, and answers by linkId
  const formFile = path.join(EXAMPLES, name, 'questionnaire.json');
  if (fs.existsSync(formFile)) {
    example.questionnaire = JSON.parse(fs.readFileSync(formFile, 'utf8'));
  }
  const linkIds = new Set();
  const collect = (items) => (items || []).forEach((item) => {
    linkIds.add(item.linkId);
    collect(item.item);
  });
  collect(example.questionnaire && example.questionnaire.item);
  people.filter((p) => p.answers).forEach((p) => {
    if (!example.questionnaire) {
      problems.push(`"${p.id}": answers need a questionnaire.json beside example.json`);
      return;
    }
    Object.keys(p.answers).filter((linkId) => !linkIds.has(linkId))
      .forEach((linkId) => problems.push(`"${p.id}": no item in questionnaire.json has the linkId ${linkId}`));
  });
  if (problems.length) {
    throw new Error(`examples/${name}/example.json:\n  ` + problems.join('\n  '));
  }
  return example;
}

/**
 * The PED text for an example's structure (family, id, father, mother, sex, phenotype). The
 * proband comes first: open-pedigree takes the first person imported as the proband.
 */
function pedOf(example) {
  const proband = example.people.filter((p) => p.proband);
  const others = example.people.filter((p) => !p.proband);
  return proband.concat(others).map((p) => ['f', p.id, p.father || '0', p.mother || '0', SEXES[p.sex], 1].join(' ')).join('\n');
}

/** Serves the repository (localEditor.html and the built dist/) on a free local port. */
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Draws one example in the editor: its GA4GH pedigree (text) and its picture (SVG text). */
async function draw(browser, base, example) {
  const page = await browser.newPage();
  // no terminology server: the names come from the example
  await page.route(/ontoserver|\/fhir\//, (route) => route.abort());
  page.on('dialog', (dialog) => dialog.dismiss());
  // (an example's own form is given to the editor as the website gives it: questionnaire-<name>)
  await page.addInitScript(({ key, form }) => {
    localStorage.removeItem(key);
    if (form) {
      localStorage.setItem('questionnaire-build', form);
    } else {
      localStorage.removeItem('questionnaire-build');
    }
  }, { key: KEY, form: example.questionnaire ? JSON.stringify(example.questionnaire) : null });
  await page.goto(`${base}/localEditor.html?example=build`);
  await page.waitForFunction(() => window.editor && !window.editor.isAwaitingFirstLoad(), null, { timeout: 20000 });
  const result = await page.evaluate(({ example, ped, key }) => {
    const editor = window.editor;
    if (example.questionnaire) {
      // a published form has nothing the editor would ignore
      const checked = window.OpenPedigree.checkQuestionnaire(example.questionnaire);
      if (checked.problems.length) {
        return { error: 'questionnaire.json:\n' + checked.toString() };
      }
      // (and the editor took it as its form: every item the example answers is on it)
      const onForm = editor.getQuestionnaireConfig().items.map((i) => i.linkId);
      const answered = new Set();
      example.people.forEach((p) => Object.keys(p.answers || {}).forEach((linkId) => answered.add(linkId)));
      const missing = [...answered].filter((linkId) => onForm.indexOf(linkId) === -1);
      if (missing.length) {
        return { error: "the editor's form has no item " + missing.join(', ') + ': it didn\'t take questionnaire.json' };
      }
    }
    document.querySelectorAll('.pedigree-template-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove());
    editor.getSaveLoadEngine().createGraphFromImportData(ped, 'ped', { acceptUnknownPhenotypes: true, externalIdMark: true }, false, true);
    const nodes = {};
    const properties = editor.getGraph().DG.GG.properties;
    Object.keys(properties).forEach((id) => {
      if (properties[id].externalID) nodes[properties[id].externalID] = Number(id);
    });
    const missing = example.people.filter((p) => nodes[p.id] === undefined).map((p) => p.id);
    if (missing.length) {
      return { error: 'not imported: ' + missing.join(', ') };
    }
    const legend = editor.getDisorderLegend();
    example.people.forEach((p) => {
      const set = {};
      if (p.name) set.setFirstName = p.name;
      if (p.surname) set.setLastName = p.surname;
      if (p.comment) set.setComments = p.comment;
      if (p.status && p.status !== 'alive') set.setLifeStatus = p.status;
      if (p.disorders && p.disorders.length) {
        p.disorders.forEach((d) => legend.seedTermName(d.id, d.name));
        set.setDisorders = p.disorders.map((d) => d.id);
      }
      if (p.carrier) set.setCarrierStatus = p.carrier;
      // the id is a label only in an example that asks for it (II-3 in a textbook figure), and
      // there only for someone with neither a name nor a comment
      if (!example.idLabels || p.name || p.comment) set.setExternalID = '';
      if (Object.keys(set).length) {
        document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: nodes[p.id], properties: set } }));
      }
    });
    // answers to the example's own form, through the form's own setters (a custom legend's answer
    // is its terms as {code, display}, as the form gives them, so no terminology server is needed)
    example.people.filter((p) => p.answers).forEach((p) => {
      const set = {};
      Object.entries(p.answers).forEach(([linkId, value]) => {
        if (editor.getQuestionnaireLegend(linkId) && Array.isArray(value)) {
          set['setQuestionnaireAnswer_' + linkId] = value.map((term) => ({ code: term.id, display: term.name }));
        } else {
          set['setQuestionnaireAnswer_' + linkId] = value;
        }
      });
      document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: nodes[p.id], properties: set } }));
    });
    localStorage.removeItem(key);
    editor.getSaveLoadEngine().save('local:' + key + '?format=fhir');
    return { ok: true };
  }, { example, ped: pedOf(example), key: KEY });
  if (result.error) {
    await page.close();
    throw new Error(result.error);
  }
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, KEY, { timeout: 20000 });
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  await page.close();
  return { pedigree: JSON.stringify(JSON.parse(saved.value), null, 2) + '\n', svg: saved.svg };
}

/**
 * A GA4GH pedigree without what changes on every save, for comparing: the bundle's timestamp and
 * the Composition's date, the embedded picture (an attachment's base64 `data`; the picture itself
 * is compared as pedigree.svg), and the resources' urn:uuid ids (fresh on each save, so numbered
 * in order of first appearance).
 */
function normalised(text) {
  const uuids = new Map();
  const renumbered = text.replace(/urn:uuid:[0-9a-f-]{36}/g, (uuid) => {
    if (!uuids.has(uuid)) uuids.set(uuid, 'urn:uuid:' + (uuids.size + 1));
    return uuids.get(uuid);
  });
  return JSON.stringify(JSON.parse(renumbered), (key, value) => (key === 'timestamp' || key === 'date' || (key === 'data' && typeof value === 'string') ? undefined : value), 2);
}

/** A picture without what changes on every drawing: Raphael's random gradient ids, renumbered. */
function normalisedSvg(text) {
  const ids = new Map();
  return text.replace(/\b[a-z0-9]+(?=-_[0-9A-Fa-f]{6}:)/g, (id) => {
    if (!ids.has(id)) ids.set(id, 'g' + (ids.size + 1));
    return ids.get(id);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const names = args.filter((a) => a !== '--check');
  const all = exampleNames();
  const unknown = names.filter((n) => !all.includes(n));
  if (unknown.length) {
    throw new Error('no such example: ' + unknown.join(', '));
  }
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const stale = [];
  try {
    for (const name of names.length ? names : all) {
      const drawn = await draw(browser, base, readExample(name));
      const dir = path.join(EXAMPLES, name);
      if (check) {
        // the pedigree, and the picture (a layout change redraws it without changing the pedigree)
        const json = path.join(dir, 'pedigree.json');
        const svg = path.join(dir, 'pedigree.svg');
        if (!fs.existsSync(json) || normalised(fs.readFileSync(json, 'utf8')) !== normalised(drawn.pedigree)) {
          stale.push(name + ' (pedigree.json)');
        } else if (!fs.existsSync(svg) || normalisedSvg(fs.readFileSync(svg, 'utf8')) !== normalisedSvg(drawn.svg)) {
          stale.push(name + ' (pedigree.svg)');
        }
      } else {
        fs.writeFileSync(path.join(dir, 'pedigree.json'), drawn.pedigree);
        fs.writeFileSync(path.join(dir, 'pedigree.svg'), drawn.svg);
        console.log('drew ' + name);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (stale.length) {
    console.error('no longer drawn as committed (run `npm run examples:build`): ' + stale.join(', '));
    process.exit(1);
  }
  if (check) {
    console.log('every example matches its source');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { readExample, pedOf, normalised, normalisedSvg };
