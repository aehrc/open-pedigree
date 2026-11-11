/* global Buffer */
import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// Generation numbering (pedigree-editor-generation-numbering): the Numbers toggle shows I, II, III at
// the left of the rows and II-3 under each person; view state only.

const FAMILY = ['f 1 0 0 1 1', 'f 2 0 0 2 1', 'f 3 1 2 1 1', 'f 4 1 2 2 1', 'f 5 0 0 2 1', 'f 6 0 0 1 1', 'f 7 3 5 1 1', 'f 8 6 4 2 1'].join('\n');

async function open(page, dataUrl, ped) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate((url) => {
    // (the page's own editor's toolbar goes too, so the toolbar clicked is this editor's)
    document.querySelectorAll('#work-area, #editor-menu').forEach((el) => el.remove());
    document.querySelectorAll('.pedigree-template-chooser, .pedigree-export-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove());
    window.localStorage.removeItem(url.split(':')[1].split('?')[0]);
    window.editor = window.OpenPedigree.initialiseEditor({ backend: window.OpenPedigree.localStorageBackend, patientDataUrl: url });
  }, dataUrl);
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  await page.evaluate(() => document.querySelectorAll('.pedigree-template-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove()));
  if (ped) {
    await page.evaluate((text) => window.editor.getSaveLoadEngine().createGraphFromImportData(text, 'ped', { externalIdMark: true }, false, true), ped);
  }
}

// The numbering on the canvas: the row numerals, and each person's label by PED id.
const numbering = (page) => page.evaluate(() => {
  const view = window.editor.getView();
  const graph = window.editor.getGraph();
  const people = {};
  for (let v = 0; v <= graph.getMaxNodeId(); v++) {
    if (graph.isPerson(v) && !graph.isPlaceholder(v)) {
      const label = view.getNode(v).getGraphics().getGenerationLabel();
      people[graph.getProperties(v).externalID || ('#' + v)] = label ? label.attr('text') : null;
    }
  }
  const numerals = [...document.querySelectorAll('#canvas svg text')].map((t) => t.textContent).filter((t) => /^[IVX]+$/.test(t)).sort();
  return { people, numerals };
});

const byExt = '(ext) => { const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) if (g.isPerson(v) && g.getProperties(v).externalID === ext) return v; return null; }';

test('the Numbers toggle shows and hides generation numbering', async ({ page }) => {
  await open(page, 'local:gn1?format=GA4GH', FAMILY);
  expect(await numbering(page)).toEqual({ people: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null }, numerals: [] });

  await expect(page.locator('#action-numbering')).toHaveAttribute('aria-pressed', 'false');
  await page.click('#action-numbering');
  await expect(page.locator('#action-numbering')).toHaveAttribute('aria-pressed', 'true');
  const on = await numbering(page);
  expect(on.numerals).toEqual(['I', 'II', 'III']);
  expect([on.people[1], on.people[2]].sort()).toEqual(['I-1', 'I-2']);
  expect(Object.values(on.people).filter((l) => l.startsWith('II-')).sort()).toEqual(['II-1', 'II-2', 'II-3', 'II-4']);
  expect([on.people[7], on.people[8]].sort()).toEqual(['III-1', 'III-2']);
  await expect(page.locator('#action-numbering')).toHaveClass(/active/);
  // the numerals sit in one column, left of everyone
  const columns = await page.evaluate(() => [...document.querySelectorAll('#canvas svg text')].filter((t) => /^[IVX]+$/.test(t.textContent)).map((t) => Math.round(t.getBBox().x + t.getBBox().width / 2)));
  expect(new Set(columns).size).toBe(1);

  // from the keyboard too
  await page.focus('#action-numbering');
  await page.keyboard.press('Enter');
  expect((await numbering(page)).numerals).toEqual([]);
  await expect(page.locator('#action-numbering')).not.toHaveClass(/active/);
  await expect(page.locator('#action-numbering')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press(' ');
  expect((await numbering(page)).numerals).toEqual(['I', 'II', 'III']);
});

test('the toggle shows numbering however it is switched on', async ({ page }) => {
  await open(page, 'local:gn6?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate(() => window.editor.getView().setGenerationNumbering(true));
  await expect(page.locator('#action-numbering')).toHaveClass(/active/);
  await expect(page.locator('#action-numbering')).toHaveAttribute('aria-pressed', 'true');
});

test('numbers follow an edit', async ({ page }) => {
  await open(page, 'local:gn2?format=GA4GH', 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
  await page.click('#action-numbering');
  expect((await numbering(page)).people[3]).toBe('II-1');
  const rel = await page.evaluate((src) => {
    const find = eval(src); return window.editor.getGraph().DG.GG.getRelationshipNode(find('1'), find('2')); 
  }, byExt);
  await page.evaluate((rel) => document.dispatchEvent(new window.CustomEvent('pedigree:partnership:newchild', { detail: { partnershipID: rel, childParams: { gender: 'F' } } })), rel);
  const after = await numbering(page);
  expect(Object.values(after.people).filter((l) => l && l.startsWith('II-')).sort()).toEqual(['II-1', 'II-2']);
  expect(after.numerals).toEqual(['I', 'II']);
});

test('a couple with no children has nothing numbered below them', async ({ page }) => {
  await open(page, 'local:gn3?format=GA4GH', 'f 1 0 0 1 1');
  await page.click('#action-numbering');
  await page.evaluate((src) => window.editor.getView().getNode(eval(src)('1')).getGraphics().getHoverBox().handleAction('partnerR', false, null), byExt);
  const after = await numbering(page);
  expect(after.numerals).toEqual(['I']);
  expect(Object.values(after.people).sort()).toEqual(['I-1', 'I-2']);
});

test('numbering is off when the editor opens, and isn\'t saved', async ({ page }) => {
  const url = 'local:gn4?format=GA4GH';
  await open(page, url, 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
  await page.evaluate((u) => window.editor.getSaveLoadEngine().save(u), url);
  const withoutNumbering = await page.evaluate(() => JSON.parse(window.localStorage.getItem('gn4')).value);
  await page.click('#action-numbering');
  await page.evaluate((u) => window.editor.getSaveLoadEngine().save(u), url);
  const withNumbering = await page.evaluate(() => JSON.parse(window.localStorage.getItem('gn4')).value);
  // the same pedigree (apart from when it was saved and the diagram image, which a toolbar click's
  // hover can touch), and no numbering in its image
  const parts = (saved) => {
    const bundle = JSON.parse(saved);
    let image = null;
    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'DocumentReference') {
        image = Buffer.from(entry.resource.content.attachment.data, 'base64').toString('utf8');
        delete entry.resource.content.attachment.data;
      }
    }
    const rest = JSON.stringify(bundle).replace(/"date":"[^"]*"/g, '').replace(/urn:uuid:[0-9a-f-]+/g, 'urn:uuid');
    return { rest, image };
  };
  const off = parts(withoutNumbering);
  const on = parts(withNumbering);
  expect(on.rest).toEqual(off.rest);
  for (const label of ['>I<', '>II<', '>I-1<', '>II-1<']) {
    expect(on.image, label).not.toContain(label);
  }
  // and the labels are where they'd be without numbering (no gap left where a number was)
  const labels = (image) => page.evaluate((svg) => [...new window.DOMParser().parseFromString(svg, 'image/svg+xml').getElementsByTagName('text')]
    .map((t) => t.textContent + ' @' + t.getAttribute('x') + ',' + t.getAttribute('y')).sort(), image);
  expect(await labels(on.image)).toEqual(await labels(off.image));
  // reopened, numbering is off
  await retireAutoCreatedEditor(page);
  await page.evaluate((u) => {
    document.querySelectorAll('#work-area, #editor-menu').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({ backend: window.OpenPedigree.localStorageBackend, patientDataUrl: u });
  }, url);
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  expect(await page.evaluate(() => window.editor.getView().isGenerationNumberingOn())).toBe(false);
  expect((await numbering(page)).numerals).toEqual([]);
});

test('the PED export can use generation numbers as IDs', async ({ page }) => {
  await open(page, 'local:gn5?format=GA4GH', 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1\nf 4 1 2 2 1');
  await page.evaluate(() => document.querySelectorAll('.pedigree-template-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove()));
  await page.evaluate(() => window.editor.getExportSelector().show());
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.evaluate(() => {
      const ped = document.querySelector('input[type=radio][name="export-type"][value="ped"]');
      ped.checked = true;
      ped.click();
      document.querySelector('input[type=radio][name="ped-options"][value="generation"]').checked = true;
      document.getElementById('export_button').click();
    }),
  ]);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) {
    chunks.push(chunk);
  }
  const rows = Buffer.concat(chunks).toString('utf8').trim().split('\n').map((line) => line.split(' '));
  expect(rows.map((r) => r[1]).sort()).toEqual(['I-1', 'I-2', 'II-1', 'II-2']);
  for (const child of rows.filter((r) => r[1].startsWith('II-'))) {
    expect([child[2], child[3]].sort()).toEqual(['I-1', 'I-2']);
  }
});
