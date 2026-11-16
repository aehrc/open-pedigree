import { test, expect } from '@playwright/test';

// localEditor.html's `example` parameter (pedigree-example-pedigrees-site): the website's example
// pages store a copy of an example under `example-<name>` and open the editor on it, so the
// visitor's own pedigree (`pedigreeData`) is never read or written. Anything but a plain name
// (lower-case letters, digits, dashes) is ignored.

const people = (page) => page.evaluate(() => Object.values(window.editor.getGraph().DG.GG.properties)
  .map((p) => p.externalID).filter(Boolean).sort());

// A GA4GH pedigree of the given people (PED rows: family id name father mother sex affected), as
// the editor saves it.
async function ga4ghOf(browser, ped) {
  const page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  await page.evaluate((text) => {
    document.querySelectorAll('.pedigree-template-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove());
    window.editor.getSaveLoadEngine().createGraphFromImportData(text, 'ped', { acceptUnknownPhenotypes: true, externalIdMark: true }, false, true);
  }, ped);
  await page.evaluate(() => {
    localStorage.removeItem('pedigreeData');
    document.getElementById('action-save').click();
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pedigreeData'))).not.toBeNull();
  const value = await page.evaluate(() => JSON.parse(localStorage.getItem('pedigreeData')).value);
  await page.close();
  return value;
}

// Opens the editor at `query` with `stored` (key -> GA4GH value) in localStorage, once per test.
async function openWith(page, query, stored) {
  // (a reload's "leave the page?" is accepted, so the reload happens)
  page.on('dialog', (dialog) => (dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()));
  await page.addInitScript((entries) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify({ value })));
    }
  }, stored);
  await page.goto('/localEditor.html' + query);
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
}

const FAMILY = 'f Anna 0 0 2 1\nf Ben 0 0 1 1\nf Cara Ben Anna 2 1';
const OWN = 'f Own 0 0 1 1';

test('?example=<name> opens the copy stored under example-<name>, saves there, and leaves pedigreeData alone', async ({ page, browser }) => {
  const example = await ga4ghOf(browser, FAMILY);
  const own = await ga4ghOf(browser, OWN);
  await openWith(page, '?example=three-people', { 'example-three-people': example, pedigreeData: own });
  await expect.poll(() => people(page)).toEqual(['Anna', 'Ben', 'Cara']);

  // an edit, saved
  await page.evaluate(() => {
    const anna = Object.keys(window.editor.getGraph().DG.GG.properties).find((id) => window.editor.getGraph().DG.GG.properties[id].externalID === 'Anna');
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: Number(anna), properties: { setFirstName: 'Annabel' } } }));
  });
  await page.evaluate(() => document.getElementById('action-save').click());
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('example-three-people')).value)).toContain('Annabel');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pedigreeData')).value)).toBe(own);

  // a reload keeps the edited copy
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.editor && !window.editor.isAwaitingFirstLoad())).toBe(true);
  await expect.poll(() => page.evaluate(() => Object.values(window.editor.getGraph().DG.GG.properties).map((p) => p.fName))).toContain('Annabel');
});

test('without ?example the editor opens the visitor\'s own pedigree, as before', async ({ page, browser }) => {
  const example = await ga4ghOf(browser, FAMILY);
  const own = await ga4ghOf(browser, OWN);
  await openWith(page, '', { 'example-three-people': example, pedigreeData: own });
  await expect.poll(() => people(page)).toEqual(['Own']);
});

for (const value of ['../pedigreeData', 'Three-People', 'three people', 'three_people']) {
  test(`?example=${value} isn't a plain name, so the editor uses pedigreeData`, async ({ page, browser }) => {
    const example = await ga4ghOf(browser, FAMILY);
    const own = await ga4ghOf(browser, OWN);
    // (stored under the key the value would make, had it been accepted)
    await openWith(page, '?example=' + encodeURIComponent(value), { ['example-' + value]: example, pedigreeData: own });
    await expect.poll(() => people(page)).toEqual(['Own']);
  });
}
