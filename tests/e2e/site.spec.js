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
  await page.goto(BASE);
  for (const name of exampleNames()) {
    await expect(page.locator(`a[href="examples/${name}/"]`)).toBeVisible();
  }
  await expect(page.locator('a[href="fhir/"]').first()).toBeVisible();
  await page.getByRole('link', { name: 'Open the editor' }).click();
  await expect(page).toHaveURL(BASE + 'editor/');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await editorReady(page);
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
