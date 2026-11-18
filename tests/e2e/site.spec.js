import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The website (pedigree-example-pedigrees-site), as scripts/build-site.js builds it with the built
// dist/, served at http://site.test/open-pedigree/ as GitHub Pages serves it: the landing page's
// links, each example's Open in the editor (a fresh copy under example-<name>, the visitor's own
// pedigree untouched), and what an example page says when its file can't be loaded.

const ROOT = path.join(__dirname, '..', '..');
const BASE = 'http://site.test/open-pedigree/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' };
let SITE;

test.beforeAll(() => {
  SITE = fs.mkdtempSync(path.join(os.tmpdir(), 'op-site-'));
  // eslint-disable-next-line global-require
  require(path.join(ROOT, 'scripts', 'build-site.js')).build(SITE);
  fs.cpSync(path.join(ROOT, 'dist'), path.join(SITE, 'dist'), { recursive: true });
});

test.afterAll(() => fs.rmSync(SITE, { recursive: true, force: true }));

const exampleNames = () => fs.readdirSync(path.join(ROOT, 'examples'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'examples', d.name, 'about.json'))).map((d) => d.name).sort();
const peopleIn = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', name, 'example.json'), 'utf8')).people.length;

async function serveSite(page) {
  page.on('dialog', (dialog) => (dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()));
  // no terminology server
  await page.route(/ontoserver|tx\.|\/fhir\/(ValueSet|CodeSystem)/, (route) => route.abort());
  await page.route(BASE + '**', (route) => {
    let rel = decodeURIComponent(new URL(route.request().url()).pathname.slice('/open-pedigree/'.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(SITE, rel);
    if (!file.startsWith(SITE) || !fs.existsSync(file)) {
      return route.fulfill({ status: 404, body: 'not found' });
    }
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
}

const editorReady = (page) => expect.poll(() => page.evaluate(() => !!window.editor && !window.editor.isAwaitingFirstLoad()), { timeout: 15000 }).toBe(true);
const personCount = (page) => page.evaluate(() => {
  const GG = window.editor.getGraph().DG.GG;
  let n = 0;
  for (let v = 0; v < GG.v.length; v++) if (GG.isPerson(v)) n++;
  return n;
});

test('the landing page opens the editor and lists every example', async ({ page }) => {
  await serveSite(page);
  // (everything the site's pages ask for is there: the editor's own assets included)
  const missing = [];
  page.on('response', (response) => response.url().startsWith(BASE) && response.status() === 404 && missing.push(response.url()));
  await page.goto(BASE);
  for (const name of exampleNames()) {
    await expect(page.locator(`a[href="examples/${name}/"]`)).toBeVisible();
  }
  await expect(page.locator('a[href="fhir/"]').first()).toBeVisible();
  await page.getByRole('link', { name: 'Open the editor' }).click();
  await expect(page).toHaveURL(BASE + 'editor/');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await editorReady(page);
  await page.waitForLoadState('networkidle');
  expect(missing).toEqual([]);
});

for (const name of exampleNames()) {
  test(`${name}: Open in the editor shows the example`, async ({ page }) => {
    await serveSite(page);
    await page.goto(BASE + `examples/${name}/`);
    await expect(page.locator('figure img')).toHaveJSProperty('complete', true);
    expect(await page.locator('figure img').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Open in the editor' }).click();
    await expect(page).toHaveURL(BASE + `editor/?example=${name}`);
    await editorReady(page);
    await expect.poll(() => personCount(page)).toBe(peopleIn(name));
  });
}

test('the visitor\'s own pedigree survives an example, and opening the example again starts fresh', async ({ page }) => {
  await serveSite(page);
  // the visitor's own pedigree, drawn and saved in the editor
  await page.goto(BASE + 'editor/');
  await editorReady(page);
  await page.evaluate(() => {
    document.querySelectorAll('.pedigree-template-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove());
    window.editor.getSaveLoadEngine().createGraphFromImportData('f Mine 0 0 1 1', 'ped', { externalIdMark: true }, false, true);
    document.getElementById('action-save').click();
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pedigreeData'))).not.toBeNull();
  const own = await page.evaluate(() => localStorage.getItem('pedigreeData'));

  // an example opened, edited and saved
  await page.goto(BASE + 'examples/full-sib-mating/');
  await page.getByRole('button', { name: 'Open in the editor' }).click();
  // (the page fetches the example before it goes to the editor)
  await page.waitForURL(BASE + 'editor/?example=full-sib-mating');
  await editorReady(page);
  await expect.poll(() => personCount(page)).toBe(peopleIn('full-sib-mating'));
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: 0, properties: { setFirstName: 'Edited' } } }));
    document.getElementById('action-save').click();
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('example-full-sib-mating')).value)).toContain('Edited');
  expect(await page.evaluate(() => localStorage.getItem('pedigreeData'))).toBe(own);

  // the editor on its own: the visitor's pedigree
  await page.goto(BASE + 'editor/');
  await editorReady(page);
  await expect.poll(() => page.evaluate(() => Object.values(window.editor.getGraph().DG.GG.properties).map((p) => p.externalID))).toContain('Mine');

  // the example again, from its page: as published
  await page.goto(BASE + 'examples/full-sib-mating/');
  await page.getByRole('button', { name: 'Open in the editor' }).click();
  // (the page fetches the example before it goes to the editor)
  await page.waitForURL(BASE + 'editor/?example=full-sib-mating');
  await editorReady(page);
  await expect.poll(() => personCount(page)).toBe(peopleIn('full-sib-mating'));
  expect(await page.evaluate(() => Object.values(window.editor.getGraph().DG.GG.properties).map((p) => p.fName))).not.toContain('Edited');
});

test('opening an example clears any other example\'s copy, so the large ones can\'t fill the browser\'s storage', async ({ page }) => {
  await serveSite(page);
  await page.goto(BASE + 'examples/full-sib-mating/');
  await page.evaluate(() => {
    localStorage.setItem('example-queen-victoria', JSON.stringify({ value: '{"edited":true}' }));
    localStorage.setItem('pedigreeData', JSON.stringify({ value: 'mine' }));
  });
  await page.getByRole('button', { name: 'Open in the editor' }).click();
  await page.waitForURL(BASE + 'editor/?example=full-sib-mating');
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys.filter((k) => k.startsWith('example-'))).toEqual(['example-full-sib-mating']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pedigreeData')).value)).toBe('mine');
});

test('an example whose file can\'t be loaded says so and stays on its page', async ({ page }) => {
  await serveSite(page);
  await page.route(BASE + 'examples/full-sib-mating/pedigree.json', (route) => route.fulfill({ status: 404, body: 'not found' }));
  await page.goto(BASE + 'examples/full-sib-mating/');
  await page.getByRole('button', { name: 'Open in the editor' }).click();
  await expect(page.locator('#open-problem')).toBeVisible();
  await expect(page.locator('#open-problem')).toContainText('404');
  await expect(page).toHaveURL(BASE + 'examples/full-sib-mating/');
  expect(await page.evaluate(() => localStorage.getItem('example-full-sib-mating'))).toBeNull();
});

// --- Try your own form (pedigree-questionnaire-launcher) ---

const formItems = (page) => page.evaluate(() => window.editor.getQuestionnaireConfig().items.map((i) => i.linkId));
const builtIn = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'defaultQuestionnaire.json'), 'utf8'));
// The built-in form with one more tab, holding `items`.
const withTab = (items) => ({ ...builtIn(), item: [...builtIn().item, { linkId: 'mine', type: 'group', text: 'Mine', item: items }] });
const MY_FORM = withTab([{ linkId: 'my_item', type: 'string', text: 'My item' }]);

async function openTry(page) {
  await serveSite(page);
  await page.goto(BASE + 'try/');
  await expect(page.locator('#questionnaire')).not.toHaveValue('');
}
async function pasteOwn(page, text) {
  await page.check('input[name=form][value=own]');
  await page.fill('#questionnaire', typeof text === 'string' ? text : JSON.stringify(text));
}
async function openFromTry(page) {
  await page.click('#open');
  await page.waitForURL(BASE + 'editor/?example=try');
  await editorReady(page);
}

test('try: the text area starts as the built-in form, which has nothing to report', async ({ page }) => {
  await openTry(page);
  expect(JSON.parse(await page.inputValue('#questionnaire'))).toEqual(builtIn());
  await pasteOwn(page, await page.inputValue('#questionnaire'));
  await page.click('#check');
  await expect(page.locator('#check-summary')).toContainText('No problems');
});

test('try: a form example opens with its own form and pedigree', async ({ page }) => {
  await openTry(page);
  await page.check('input[name=form][value=form-logic]');
  await expect(page.locator('#pedigree')).toHaveValue('form-logic');
  await openFromTry(page);
  expect(await formItems(page)).toContain('interpretation');
  await expect.poll(() => personCount(page)).toBe(peopleIn('form-logic'));
});

test('try: a pasted form on one of the examples', async ({ page }) => {
  await openTry(page);
  await pasteOwn(page, MY_FORM);
  await page.selectOption('#pedigree', 'double-first-cousins');
  await openFromTry(page);
  expect(await formItems(page)).toContain('my_item');
  await expect.poll(() => personCount(page)).toBe(peopleIn('double-first-cousins'));
  await expect(page.locator('.pedigree-template-chooser:visible')).toHaveCount(0);
});

test('try: a form on a blank pedigree opens the template chooser with that form', async ({ page }) => {
  await openTry(page);
  await pasteOwn(page, MY_FORM);
  await openFromTry(page);
  await expect(page.locator('.pedigree-template-chooser:visible')).toHaveCount(1);
  expect(await formItems(page)).toContain('my_item');
  expect(await page.evaluate(() => localStorage.getItem('example-try'))).toBeNull();
});

test('try: the built-in form on a blank pedigree stores no form', async ({ page }) => {
  await openTry(page);
  await openFromTry(page);
  expect(await page.evaluate(() => localStorage.getItem('questionnaire-try'))).toBeNull();
  expect(await formItems(page)).toContain('disorders');
});

for (const [what, text, says] of [
  ['text that isn\'t JSON', '{"resourceType": "Questionnaire", ', 'valid JSON'],
  ['a resource that isn\'t a Questionnaire', { resourceType: 'Patient' }, 'not a Questionnaire'],
]) {
  test(`try: ${what} is reported and doesn't open the editor`, async ({ page }) => {
    await openTry(page);
    await pasteOwn(page, text);
    await page.click('#open');
    await expect(page.locator('#problems li.fatal')).toContainText(says);
    await expect(page.locator('#check-summary')).toContainText('can\'t use this form');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(BASE + 'try/');
  });
}

test('try: problems the editor ignores are listed, and the editor still opens', async ({ page }) => {
  await openTry(page);
  await pasteOwn(page, withTab([{ linkId: 'my_item', type: 'string', enableWhen: [{ question: 'nope', operator: 'exists', answerBoolean: true }] }]));
  await page.click('#check');
  await expect(page.locator('#problems li')).toHaveCount(1);
  await expect(page.locator('#problems li')).toContainText('"nope"');
  await openFromTry(page);
  expect(await formItems(page)).toContain('my_item');
});

test('try: a problem\'s text is shown as text, never as HTML', async ({ page }) => {
  await openTry(page);
  await pasteOwn(page, withTab([{ linkId: '<img src=x onerror="window.hacked=1">', type: 'attachment' }]));
  await page.click('#check');
  await expect(page.locator('#problems li')).toContainText('<img src=x');
  expect(await page.locator('#problems img').count()).toBe(0);
  expect(await page.evaluate(() => window.hacked)).toBeUndefined();
});

test('try: an uploaded file becomes the form', async ({ page }) => {
  await openTry(page);
  await page.setInputFiles('#upload', { name: 'mine.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(MY_FORM)) });
  await expect(page.locator('input[name=form][value=own]')).toBeChecked();
  expect(JSON.parse(await page.inputValue('#questionnaire'))).toEqual(MY_FORM);
});

test('try: a form fetched from a URL, and one that can\'t be', async ({ page }) => {
  await openTry(page);
  await page.route('https://forms.example.org/**', (route) => (route.request().url().endsWith('/ok.json')
    ? route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(MY_FORM) })
    : route.abort()));
  await page.check('input[name=form][value=own]');
  await page.fill('#url', 'https://forms.example.org/ok.json');
  await page.click('#fetch');
  await expect.poll(async () => JSON.parse(await page.inputValue('#questionnaire'))).toEqual(MY_FORM);
  const before = await page.inputValue('#questionnaire');
  await page.fill('#url', 'https://forms.example.org/blocked.json');
  await page.click('#fetch');
  await expect(page.locator('#check-summary')).toContainText('download the file and upload it');
  expect(await page.inputValue('#questionnaire')).toBe(before);
});

test('try: the visitor\'s own pedigree survives, and earlier copies are cleared', async ({ page }) => {
  await openTry(page);
  await page.evaluate(() => {
    localStorage.setItem('pedigreeData', JSON.stringify({ value: 'mine' }));
    localStorage.setItem('example-queen-victoria', JSON.stringify({ value: '{}' }));
    localStorage.setItem('questionnaire-hearing-loss-study', '{}');
  });
  await pasteOwn(page, MY_FORM);
  await page.selectOption('#pedigree', 'full-sib-mating');
  await openFromTry(page);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys).toEqual(['example-try', 'pedigreeData', 'questionnaire-try']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pedigreeData')).value)).toBe('mine');
});

test('a form example\'s page opens the editor with its own form', async ({ page }) => {
  await serveSite(page);
  await page.goto(BASE + 'examples/hearing-loss-study/');
  await expect(page.locator('pre').first()).toContainText('mapsToLegendCondition');
  await page.getByRole('button', { name: 'Open in the editor' }).click();
  await page.waitForURL(BASE + 'editor/?example=hearing-loss-study');
  await editorReady(page);
  expect(await formItems(page)).toContain('hearing_loss');
  expect(await page.evaluate(() => !!window.editor.getQuestionnaireLegend('hearing_loss'))).toBe(true);
});

test('opening clears only open-pedigree\'s own copies: other sites\' storage on the shared origin is left alone', async ({ page }) => {
  await serveSite(page);
  await page.goto(BASE + 'examples/full-sib-mating/');
  await page.evaluate(() => {
    localStorage.setItem('questionnaire-draft', 'another site');
    localStorage.setItem('example-settings', 'another site');
    localStorage.setItem('questionnaire-form-logic', '{}');
  });
  await page.getByRole('button', { name: 'Open in the editor' }).click();
  await page.waitForURL(BASE + 'editor/?example=full-sib-mating');
  expect(await page.evaluate(() => [localStorage.getItem('questionnaire-draft'), localStorage.getItem('example-settings'), localStorage.getItem('questionnaire-form-logic')]))
    .toEqual(['another site', 'another site', null]);
});

test('try: the pedigree last opened from the page is offered first, with the visitor\'s changes', async ({ page }) => {
  await openTry(page);
  await pasteOwn(page, MY_FORM);
  await page.selectOption('#pedigree', 'full-sib-mating');
  await openFromTry(page);
  // a change, saved
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: 0, properties: { setFirstName: 'Changed' } } }));
    document.getElementById('action-save').click();
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('example-try')).value)).toContain('Changed');

  // back to the page, a corrected form, and open again
  await page.goto(BASE + 'try/');
  await expect(page.locator('#pedigree')).toHaveValue('__last__');
  await expect(page.locator('#last-hint')).toBeVisible();
  await pasteOwn(page, withTab([{ linkId: 'my_item_2', type: 'string' }]));
  await openFromTry(page);
  expect(await formItems(page)).toContain('my_item_2');
  expect(await page.evaluate(() => Object.values(window.editor.getGraph().DG.GG.properties).map((p) => p.fName))).toContain('Changed');
});

test('try: the form last opened from the page comes back too, as Your own, and opening keeps it', async ({ page }) => {
  await openTry(page);
  await pasteOwn(page, MY_FORM);
  await page.selectOption('#pedigree', 'full-sib-mating');
  await openFromTry(page);
  await page.goto(BASE + 'try/');
  await expect(page.locator('input[name=form][value=own]')).toBeChecked();
  expect(JSON.parse(await page.inputValue('#questionnaire'))).toEqual(MY_FORM);
  await openFromTry(page);
  expect(await formItems(page)).toContain('my_item');
});

test('opening an example from its page leaves the Try page\'s copy for it to offer back', async ({ page }) => {
  await openTry(page);
  await pasteOwn(page, MY_FORM);
  await page.selectOption('#pedigree', 'full-sib-mating');
  await openFromTry(page);
  await page.goto(BASE + 'examples/half-sib-mating/');
  await page.getByRole('button', { name: 'Open in the editor' }).click();
  await page.waitForURL(BASE + 'editor/?example=half-sib-mating');
  expect(await page.evaluate(() => [!!localStorage.getItem('example-try'), !!localStorage.getItem('questionnaire-try')])).toEqual([true, true]);
  await page.goto(BASE + 'try/');
  await expect(page.locator('#pedigree')).toHaveValue('__last__');
});
