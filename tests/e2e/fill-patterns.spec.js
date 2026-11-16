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
  await page.evaluate(() => document.querySelectorAll('.msdialog-modal-container').forEach((el) => el.remove()));
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
  expect(await page.evaluate(() => document.querySelectorAll('#canvas svg defs pattern').length)).toBe(10);

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
