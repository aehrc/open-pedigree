import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// Black-and-white fill patterns (pedigree-patterns-and-png-export): the toolbar's Patterns toggle
// draws each disorder, gene and custom legend entry's sector with a pattern instead of a colour,
// and the legend's swatches the same; view state only.

async function open(page) {
  page.on('dialog', (dialog) => dialog.accept());
  // (no terminology server: names stay IDs)
  await page.route(/ontoserver|\/fhir\//, (route) => route.abort());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate(() => {
    document.querySelectorAll('#work-area, #editor-menu').forEach((el) => el.remove());
    document.querySelectorAll('.msdialog-modal-container').forEach((el) => el.remove());
    window.localStorage.removeItem('fillPatterns');
    window.editor = window.OpenPedigree.initialiseEditor({ backend: window.OpenPedigree.localStorageBackend, patientDataUrl: 'local:fillPatterns' });
  });
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  // (only the template chooser: the export dialog's container is needed)
  await page.evaluate(() => document.querySelectorAll('.pedigree-template-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove()));
  // a couple and their child
  await page.evaluate(() => window.editor.getSaveLoadEngine().createGraphFromImportData('f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 2 1', 'ped', {}, false, true));
}

const people = (page) => page.evaluate(() => {
  const map = window.editor.getView().getNodeMap();
  return Object.keys(map).filter((k) => map[k].getType && map[k].getType() === 'Person').map(Number);
});
const setProperties = (page, nodeID, properties) => page.evaluate(({ id, props }) => document.dispatchEvent(
  new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: id, properties: props } })), { id: nodeID, props: properties });
// The fill each of a person's sector elements has, as the SVG holds it.
const sectorFills = (page, nodeID) => page.evaluate((id) => {
  const graphics = window.editor.getView().getNode(id).getGraphics();
  const shapes = graphics._disorderShapes;
  if (!shapes) {
    return [];
  }
  const items = shapes.type === 'set' ? shapes.items : [shapes];
  return items.flatMap((el) => (el.type === 'set' ? el.items : [el])).map((el) => el.node.getAttribute('fill'));
}, nodeID);
const swatchPatterns = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#legend-box .disorder-color'))
  .map((el) => (el.dataset.fillPattern === undefined ? 'colour:' + el.style.backgroundColor : 'pattern:' + el.dataset.fillPattern)));
const toggle = (page) => page.locator('#action-patterns').click();

test('the Patterns toggle draws each entry with its own pattern, solid first, and back in colour', async ({ page }) => {
  await open(page);
  const [father, , child] = await people(page);
  await setProperties(page, child, { setGenes: ['BRCA1'] });
  await setProperties(page, child, { setDisorders: ['Disorder A'] });
  await setProperties(page, father, { setDisorders: ['Disorder A'] });
  const colourFills = await sectorFills(page, child);
  expect(colourFills.every((f) => !/url\(#op-fill-/.test(f))).toBe(true);

  await toggle(page);
  await expect(page.locator('#action-patterns')).toHaveAttribute('aria-pressed', 'true');
  const fills = await sectorFills(page, child);
  expect(fills).toHaveLength(2);
  expect(new Set(fills).size).toBe(2);
  const registry = await page.evaluate(() => {
    const r = window.editor.getView().getFillPatternRegistry();
    return { solid: 'url(#' + r.patternId(0) + ')', hatch: 'url(#' + r.patternId(1) + ')' };
  });
  // the disorder (the disorders legend comes first) is solid; the gene hatched
  expect(fills).toEqual([registry.solid, registry.hatch]);
  expect(await sectorFills(page, father)).toEqual([registry.solid]);
  expect((await swatchPatterns(page)).sort()).toEqual(['pattern:0', 'pattern:1']);
  // the patterns are defined in the canvas's SVG, so exports carry them
  // (each pattern, and each turned back for diamonds)
  expect(await page.evaluate(() => document.querySelectorAll('#canvas svg defs pattern').length)).toBe(20);

  await toggle(page);
  await expect(page.locator('#action-patterns')).toHaveAttribute('aria-pressed', 'false');
  // (the same gradients: Raphael names each one afresh when it's drawn)
  const gradientColours = (fills) => fills.map((f) => f.replace(/#[^-]*-/, '#'));
  expect(gradientColours(await sectorFills(page, child))).toEqual(gradientColours(colourFills));
  expect((await swatchPatterns(page)).every((s) => s.startsWith('colour:'))).toBe(true);
});

test('a new entry while patterns are on gets the next pattern, in the drawing and the legend', async ({ page }) => {
  await open(page);
  const [, mother] = await people(page);
  await toggle(page);
  await setProperties(page, mother, { setDisorders: ['Disorder B'] });
  const solid = await page.evaluate(() => 'url(#' + window.editor.getView().getFillPatternRegistry().patternId(0) + ')');
  expect(await sectorFills(page, mother)).toEqual([solid]);
  expect(await swatchPatterns(page)).toEqual(['pattern:0']);
});

test('patterns are view state: not an undo step, not saved', async ({ page }) => {
  await open(page);
  const [father] = await people(page);
  await setProperties(page, father, { setDisorders: ['Disorder A'] });
  await toggle(page);
  // undo takes back the last real step (the disorder), not the toggle
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
  expect(await page.evaluate(() => window.editor.getView().isFillPatternsOn())).toBe(true);
  expect(await page.evaluate((id) => window.editor.getView().getNode(id).getDisorders(), father)).toEqual([]);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:redo')));
  // the saved image is in colour
  await page.evaluate(() => window.editor.getSaveLoadEngine().save('local:fillPatterns'));
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('fillPatterns')));
  expect(saved.svg).toBeTruthy();
  expect(saved.svg).not.toContain('url(#op-fill-');
  // and still patterned on screen afterwards
  expect((await sectorFills(page, father))[0]).toMatch(/url\(#op-fill-/);
});

test('a screenshot of patterned symbols, for a look', async ({ page }) => {
  await open(page);
  const [father, mother, child] = await people(page);
  await setProperties(page, father, { setDisorders: ['A'] });
  await setProperties(page, mother, { setDisorders: ['B', 'C'] });
  await setProperties(page, child, { setDisorders: ['A', 'B', 'C', 'D'] });
  await toggle(page);
  await page.locator('#canvas').screenshot({ path: 'test-results/fill-patterns.png' });
});

// --- exports (pedigree-patterns-and-png-export) ---

// Exports through the dialog: `type` and optional select values; resolves to the download's bytes.
async function exportThroughDialog(page, type, selects = {}) {
  await page.evaluate(() => window.editor.getExportSelector().show());
  await page.locator(`input[name="export-type"][value="${type}"]`).check();
  for (const [name, value] of Object.entries(selects)) {
    await page.locator(`select[name="${name}"]`).selectOption(value);
  }
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export_button').click()]);
  const fs = require('fs');
  return { name: download.suggestedFilename(), bytes: fs.readFileSync(await download.path()) };
}
test('PNG export at 300 DPI: the drawing at 300/96 its size, on white, recording its resolution', async ({ page }) => {
  await open(page);
  const [father] = await people(page);
  await setProperties(page, father, { setDisorders: ['Disorder A'] });
  const { name, bytes } = await exportThroughDialog(page, 'png', { 'png-dpi': '300' });
  expect(name).toBe('open-pedigree.png');
  expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  // IHDR: the size; then the pHYs chunk, 11811 pixels a metre (300 DPI)
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  expect(bytes.toString('latin1', 37, 41)).toBe('pHYs');
  expect(bytes.readUInt32BE(41)).toBe(11811);
  // the drawing's own size, as SVG export (what the PNG is made from) records it
  const svg = (await exportThroughDialog(page, 'svg')).bytes.toString('utf8');
  const svgSize = { width: parseFloat(/<svg[^>]* width="([^"]+)"/.exec(svg)[1]), height: parseFloat(/<svg[^>]* height="([^"]+)"/.exec(svg)[1]) };
  expect(width).toBe(Math.ceil(svgSize.width * 300 / 96));
  expect(height).toBe(Math.ceil(svgSize.height * 300 / 96));
  // a corner pixel is white (the background), read back in the page
  const corner = await page.evaluate(async (b64) => {
    const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  }, bytes.toString('base64'));
  expect(corner).toEqual([255, 255, 255, 255]);
});

test('a de-identified PNG is drawn de-identified', async ({ page }) => {
  await open(page);
  // which privacy level the drawing is rendered at while exporting
  await page.evaluate(() => {
    const view = window.editor.getView();
    const original = view.withDeidentifiedRendering.bind(view);
    window.__renderedAt = [];
    view.withDeidentifiedRendering = (privacy, draw) => { window.__renderedAt.push(privacy); return original(privacy, draw); };
  });
  await page.evaluate(() => window.editor.getExportSelector().show());
  await page.locator('input[name="export-type"][value="png"]').check();
  await page.locator('input[name="privacy-options"][value="nopersonal"]').check();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export_button').click()]);
  expect(download.suggestedFilename()).toBe('open-pedigree.png');
  expect(await page.evaluate(() => window.__renderedAt)).toEqual(['nopersonal']);
});

test('a drawing too large for the chosen resolution is refused with a message, and nothing saved', async ({ page }) => {
  await open(page);
  // 40 siblings: wider than a canvas can be at 600 DPI
  const ped = ['g 1 0 0 1 1', 'g 2 0 0 2 1'].concat(Array.from({ length: 40 }, (_, i) => `g c${i} 1 2 ${1 + (i % 2)} 1`)).join('\n');
  await page.evaluate((text) => window.editor.getSaveLoadEngine().createGraphFromImportData(text, 'ped', {}, false, true), ped);
  const messages = [];
  page.on('dialog', (dialog) => messages.push(dialog.message()));
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.evaluate(() => window.editor.getExportSelector().show());
  await page.locator('input[name="export-type"][value="png"]').check();
  await page.locator('select[name="png-dpi"]').selectOption('600');
  await page.locator('#export_button').click();
  await expect.poll(() => messages.length).toBeGreaterThan(0);
  expect(messages[0]).toMatch(/too large to draw as a 600 DPI PNG .*choose a lower resolution/);
  expect(downloaded).toBe(false);
});

test('with patterns on, SVG and PDF exports carry the patterns', async ({ page }) => {
  await open(page);
  const [father, mother] = await people(page);
  await setProperties(page, father, { setDisorders: ['Disorder A'] });
  await setProperties(page, mother, { setDisorders: ['Disorder B'] });
  await toggle(page);
  const svg = (await exportThroughDialog(page, 'svg')).bytes.toString('utf8');
  expect(svg).toMatch(/<pattern id="op-fill-\d+-0"/);
  expect(svg).toMatch(/fill="url\(#op-fill-\d+-1\)"/);
  const pdf = (await exportThroughDialog(page, 'pdf')).bytes.toString('latin1');
  expect(pdf).toContain('/Pattern');
});

// --- review fixes ---

const fillPatternId = (page, n, rotated = false) => page.evaluate(({ i, r }) =>
  'url(#' + window.editor.getView().getFillPatternRegistry().patternId(i) + (r ? '-r' : '') + ')', { i: n, r: rotated });

test('legend order decides, numeric IDs included: the first entry shown is solid', async ({ page }) => {
  await open(page);
  const [father] = await people(page);
  // (Object.keys would put 113705 before 604370)
  await setProperties(page, father, { setDisorders: ['604370', '113705'] });
  await toggle(page);
  expect(await sectorFills(page, father)).toEqual([await fillPatternId(page, 0), await fillPatternId(page, 1)]);
});

test('phenotypes keep their swatch: they don\'t fill a symbol', async ({ page }) => {
  await open(page);
  const [father] = await people(page);
  // (added with patterns on: the swatch is drawn then)
  await toggle(page);
  await setProperties(page, father, { setDisorders: ['D'], setHPO: ['HP:0001250'] });
  // (the phenotype legend's entries are hpo-<id>)
  const phenotypes = await page.evaluate(() => Array.from(document.querySelectorAll('#legend-box li[id^="hpo-"] .disorder-color'))
    .map((el) => ({ pattern: el.dataset.fillPattern || null })));
  const disorders = await page.evaluate(() => Array.from(document.querySelectorAll('#legend-box li[id^="disorder-"] .disorder-color'))
    .map((el) => el.dataset.fillPattern || null));
  expect(disorders).toEqual(['0']);
  expect(phenotypes.length).toBeGreaterThan(0);
  expect(phenotypes.every((s) => s.pattern === null)).toBe(true);
});

test('an unknown-sex diamond takes the pattern turned back, so it reads as its swatch', async ({ page }) => {
  await open(page);
  const [, , child] = await people(page);
  await setProperties(page, child, { setGender: 'U' });
  await setProperties(page, child, { setDisorders: ['D1', 'D2'] });
  await toggle(page);
  expect(await sectorFills(page, child)).toEqual([await fillPatternId(page, 0, true), await fillPatternId(page, 1, true)]);
});

test('marks inside a solid symbol are drawn white', async ({ page }) => {
  await open(page);
  const [, , child] = await people(page);
  await setProperties(page, child, { setLifeStatus: 'unborn' });
  await setProperties(page, child, { setDisorders: ['D1'] });
  const unborn = () => page.evaluate((id) => {
    const shape = window.editor.getView().getNode(id).getGraphics().getUnbornShape();
    return { fill: String(shape.attr('fill')).toUpperCase(), stroke: String(shape.attr('stroke')).toUpperCase() };
  }, child);
  expect((await unborn()).fill).toBe('#000000');
  await toggle(page);
  // white, outlined in black (it also crosses hatched sectors where several meet)
  expect(await unborn()).toEqual({ fill: '#FFFFFF', stroke: '#000000' });
  await toggle(page);
  expect((await unborn()).fill).toBe('#000000');
  // and back to black once the solid entry is gone
  await toggle(page);
  await setProperties(page, child, { setDisorders: [] });
  expect((await unborn()).fill).toBe('#000000');
});

test('a pedigree loaded with patterns on takes them afresh, its first entry solid', async ({ page }) => {
  await open(page);
  const [father] = await people(page);
  await setProperties(page, father, { setDisorders: ['Old A', 'Old B'] });
  await toggle(page);
  // another pedigree, through the import (the same load the backend uses)
  await page.evaluate(() => window.editor.getSaveLoadEngine().createGraphFromImportData('h 1 0 0 1 1\nh 2 0 0 2 1\nh 3 1 2 1 1', 'ped', {}, false, true));
  const [newFather] = await people(page);
  await setProperties(page, newFather, { setDisorders: ['New A'] });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:load:finish')));
  expect(await sectorFills(page, newFather)).toEqual([await fillPatternId(page, 0)]);
});

test('the node menu\'s swatches show the patterns too', async ({ page }) => {
  await open(page);
  const [father] = await people(page);
  await setProperties(page, father, { setDisorders: ['D1'] });
  await toggle(page);
  await page.evaluate((id) => window.editor.getNodeMenu().show(window.editor.getView().getNode(id), 100, 100), father);
  await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('.menu-box .field-disorders .disorder-color'))
    .map((el) => el.dataset.fillPattern || null))).toEqual(['0']);
});

test('an undo keeps what each entry has, so the shading never changes meaning', async ({ page }) => {
  await open(page);
  const [father, , child] = await people(page);
  await setProperties(page, child, { setDisorders: ['A'] });
  await setProperties(page, father, { setDisorders: ['B'] });
  await toggle(page);
  const solid = await fillPatternId(page, 0);
  const hatched = await fillPatternId(page, 1);
  expect(await sectorFills(page, child)).toEqual([solid]);
  // an unrelated change, undone (an undo reloads the pedigree)
  await setProperties(page, father, { setFirstName: 'Fred' });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
  expect(await sectorFills(page, child)).toEqual([solid]);
  expect(await sectorFills(page, father)).toEqual([hatched]);
});

test('a reload that lists the entries in another order keeps what each has', async ({ page }) => {
  await open(page);
  const [father, , child] = await people(page);
  await setProperties(page, child, { setDisorders: ['A'] });
  await setProperties(page, father, { setDisorders: ['B'] });
  await toggle(page);
  const solid = await fillPatternId(page, 0);
  // the legend now lists B first (as a reload in another node order would), then a load finishes
  await page.evaluate(() => {
    const list = document.querySelector('#legend-box li[id="disorder-B"]').parentElement;
    list.insertBefore(document.querySelector('#legend-box li[id="disorder-B"]'), list.firstChild);
    document.dispatchEvent(new CustomEvent('pedigree:load:finish'));
  });
  expect(await sectorFills(page, child)).toEqual([solid]);
});

test('a mark goes back to black when the person\'s last fill goes, whatever else redraws', async ({ page }) => {
  await open(page);
  const [, , child] = await people(page);
  await setProperties(page, child, { setLifeStatus: 'unborn' });
  await setProperties(page, child, { setDisorders: ['D1'] });
  await toggle(page);
  const fill = await page.evaluate((id) => {
    const node = window.editor.getView().getNode(id);
    node._disorders = [];
    node.getGraphics().updateDisorderShapes();
    return String(node.getGraphics().getUnbornShape().attr('fill')).toUpperCase();
  }, child);
  expect(fill).toBe('#000000');
});
