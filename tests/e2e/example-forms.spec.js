import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// The website's form examples (pedigree-questionnaire-launcher): each example with its own
// questionnaire.json opens with that form, has nothing checkQuestionnaire would report, and its
// people's answers - custom legend terms and a fixed-code Observation included - are as its
// source gives them, and still are after the editor saves the pedigree as GA4GH FHIR and loads it.

const EXAMPLES = path.join(__dirname, '..', '..', 'examples');
const forms = fs.readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(EXAMPLES, d.name, 'questionnaire.json')))
  .map((d) => d.name).sort();

// An answer as a comparable value: a legend's terms as their codes, anything else as given.
const comparable = (value) => (Array.isArray(value) ? value.map((t) => t.id || t.code).sort() : value);

// The source's answers, by person name (else comment, else '?').
function sourceAnswers(name) {
  const people = JSON.parse(fs.readFileSync(path.join(EXAMPLES, name, 'example.json'), 'utf8')).people;
  return Object.fromEntries(people.filter((p) => p.answers).map((p) => [p.name || p.comment || '?',
    Object.fromEntries(Object.entries(p.answers).map(([k, v]) => [k, comparable(v)]))]));
}

// The answers the editor holds, by person name (else comment, else '?'), for the given linkIds.
const editorAnswers = (page, linkIds) => page.evaluate((ids) => {
  const GG = window.editor.getGraph().DG.GG;
  const out = {};
  for (let v = 0; v < GG.v.length; v++) {
    if (!GG.isPerson(v)) continue;
    const answers = window.editor.getView().getNode(v).getQuestionnaireAnswers() || {};
    const mine = {};
    ids.forEach((id) => {
      if (answers[id] !== undefined) {
        const value = answers[id];
        mine[id] = Array.isArray(value) ? value.map((t) => t.code).sort() : value;
      }
    });
    if (Object.keys(mine).length) out[GG.properties[v].fName || GG.properties[v].comments || '?'] = mine;
  }
  return out;
}, linkIds);

async function open(page, name) {
  page.on('dialog', (dialog) => (dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()));
  await page.route(/ontoserver|\/fhir\/(ValueSet|CodeSystem)/, (route) => route.abort());
  const stored = {
    ['example-' + name]: JSON.stringify({ value: fs.readFileSync(path.join(EXAMPLES, name, 'pedigree.json'), 'utf8') }),
    ['questionnaire-' + name]: fs.readFileSync(path.join(EXAMPLES, name, 'questionnaire.json'), 'utf8'),
  };
  await page.addInitScript((entries) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, value));
    }
  }, stored);
  await page.goto('/localEditor.html?example=' + name);
  await expect.poll(() => page.evaluate(() => !!window.editor && !window.editor.isAwaitingFirstLoad()), { timeout: 15000 }).toBe(true);
}

for (const name of forms) {
  test(`${name}: opens with its own form, which has nothing to report`, async ({ page }) => {
    await open(page, name);
    const form = JSON.parse(fs.readFileSync(path.join(EXAMPLES, name, 'questionnaire.json'), 'utf8'));
    expect(await page.evaluate((q) => window.OpenPedigree.checkQuestionnaire(q).problems, form)).toEqual([]);
    const tab = form.item[form.item.length - 1];
    const items = await page.evaluate(() => window.editor.getQuestionnaireConfig().items.map((i) => i.linkId));
    tab.item.forEach((item) => expect(items).toContain(item.linkId));
  });

  test(`${name}: everyone's answers are the source's, and still are after a GA4GH save and load`, async ({ page }) => {
    await open(page, name);
    const expected = sourceAnswers(name);
    const linkIds = [...new Set(Object.values(expected).flatMap((a) => Object.keys(a)))];
    await expect.poll(() => editorAnswers(page, linkIds)).toEqual(expected);

    // saved by the editor as GA4GH FHIR, and opened again
    await page.evaluate((key) => {
      localStorage.removeItem(key);
      document.getElementById('action-save').click();
    }, 'example-' + name);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), 'example-' + name)).not.toBeNull();
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!window.editor && !window.editor.isAwaitingFirstLoad()), { timeout: 15000 }).toBe(true);
    await expect.poll(() => editorAnswers(page, linkIds)).toEqual(expected);
  });
}
