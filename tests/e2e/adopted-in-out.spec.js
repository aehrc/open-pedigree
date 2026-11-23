import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// Adopted in vs adopted out (pedigree-adopted-in-out): brackets on both, a dashed line of descent
// for adopted in only, the node menu's three-way choice with undo, and a childless couple's child
// locked to adopted in.

async function open(page, dataUrl, ped) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await page.evaluate((key) => window.localStorage.removeItem(key), dataUrl.split(':')[1].split('?')[0]);
  await retireAutoCreatedEditor(page);
  await page.evaluate((url) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({ backend: window.OpenPedigree.localStorageBackend, patientDataUrl: url });
  }, dataUrl);
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  await page.evaluate(() => document.querySelectorAll('.msdialog-modal-container, .msdialog-screen').forEach((el) => el.remove()));
  // (an undo step, as the editor's own load is)
  await page.evaluate((text) => window.editor.getSaveLoadEngine().createGraphFromImportData(text, 'ped', { externalIdMark: true }, false, true), ped);
}

const personByExt = '(ext) => { const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) if (g.isPerson(v) && g.getProperties(v).externalID === ext) return v; return null; }';

const setProperty = (page, ext, properties) => page.evaluate(([src, e, p]) => {
  document.dispatchEvent(new window.CustomEvent('pedigree:node:setproperty', { detail: { nodeID: eval(src)(e), properties: p } }));
}, [personByExt, ext, properties]);

const adoption = (page, ext) => page.evaluate(([src, e]) => {
  const v = eval(src)(e);
  return { code: window.editor.getView().getNode(v).getAdoption(), brackets: !!window.editor.getView().getNode(v).getGraphics().getAdoptedShape() };
}, [personByExt, ext]);

// The x coordinates where dashed lines end (an adopted-in child's line of descent ends at the child).
const dashedLineEnds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas svg path')]
  .filter((p) => p.getAttribute('stroke-dasharray') && p.getAttribute('stroke-dasharray') !== 'none')
  .map((p) => {
    const numbers = (p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
    return Math.round(numbers[numbers.length - 2]);
  }));

const childX = (page, ext) => page.evaluate(([src, e]) => Math.round(window.editor.getView().getNode(eval(src)(e)).getX()), [personByExt, ext]);

// The shown node menu's adoption radios (the person-group menu, hidden, has its own).
const adoptionRadios = (page) => page.$$eval('.menu-box .field-adoption input[type=radio]', (rs) => rs
  .filter((r) => r.offsetParent !== null)
  .map((r) => ({ value: r.value, checked: r.checked, disabled: r.disabled })));

const undo = (page) => page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));

const FAMILY = 'f 1 0 0 1 1\nf 2 0 0 2 1\nf IN 1 2 1 1\nf OUT 1 2 2 1\nf NOT 1 2 1 1';

test('an adopted-in child\'s line is dashed; adopted out and not adopted are solid; both adopted have brackets', async ({ page }) => {
  await open(page, 'local:adoptInOut1?format=GA4GH', FAMILY);
  expect(await dashedLineEnds(page)).toEqual([]);
  await setProperty(page, 'IN', { setAdoption: 'in' });
  await setProperty(page, 'OUT', { setAdoption: 'out' });

  expect(await adoption(page, 'IN')).toEqual({ code: 'in', brackets: true });
  expect(await adoption(page, 'OUT')).toEqual({ code: 'out', brackets: true });
  expect(await adoption(page, 'NOT')).toEqual({ code: '', brackets: false });
  const ends = await dashedLineEnds(page);
  expect(ends.length).toBeGreaterThan(0);
  const inX = await childX(page, 'IN');
  ends.forEach((x) => expect(x).toBe(inX));

  // switching the adopted-in child to adopted out makes its line solid
  await setProperty(page, 'IN', { setAdoption: 'out' });
  expect(await dashedLineEnds(page)).toEqual([]);
  expect(await adoption(page, 'IN')).toEqual({ code: 'out', brackets: true });
});

test('the node menu sets adopted out, and undo brings back the choice before', async ({ page }) => {
  await open(page, 'local:adoptInOut2?format=GA4GH', FAMILY);
  await setProperty(page, 'NOT', { setAdoption: 'in' });
  await page.evaluate((src) => window.editor.getNodeMenu().show(window.editor.getView().getNode(eval(src)('NOT')), 100, 100), personByExt);
  const radios = await adoptionRadios(page);
  expect(radios.map((r) => r.value)).toEqual(['none', 'in', 'out']);
  expect(radios.find((r) => r.checked).value).toBe('in');

  await page.evaluate(() => [...document.querySelectorAll('.menu-box .field-adoption input[value="out"]')].find((r) => r.offsetParent !== null).click());
  expect(await adoption(page, 'NOT')).toEqual({ code: 'out', brackets: true });
  await undo(page);
  expect((await adoption(page, 'NOT')).code).toBe('in');
});

test('a yes/no "adopted" answer that replaces adopted out is undone back to adopted out', async ({ page }) => {
  await open(page, 'local:adoptInOut4?format=GA4GH', FAMILY);
  await setProperty(page, 'OUT', { setAdoption: 'out' });
  await setProperty(page, 'OUT', { setAdopted: true });
  expect((await adoption(page, 'OUT')).code).toBe('in');
  await undo(page);
  expect(await adoption(page, 'OUT')).toEqual({ code: 'out', brackets: true });
});

test('a childless couple\'s child is adopted in, shown and not changeable, and can\'t be set adopted out', async ({ page }) => {
  await open(page, 'local:adoptInOut3?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate((src) => {
    const id = eval(src)('1');
    document.dispatchEvent(new window.CustomEvent('pedigree:node:setproperty', { detail: { nodeID: id, properties: { setChildlessStatus: 'infertile' } } }));
    window.editor.getView().getNode(id).getGraphics().getHoverBox().handleAction('partnerR', false, null);
  }, personByExt);
  await page.evaluate(() => {
    const g = window.editor.getGraph();
    let rel = null;
    for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isRelationship(v)) {
        rel = v;
      }
    }
    document.dispatchEvent(new window.CustomEvent('pedigree:partnership:newchild', { detail: { partnershipID: rel, childParams: { gender: 'F', externalID: 'KID' } } }));
  });
  expect((await adoption(page, 'KID')).code).toBe('in');

  await page.evaluate((src) => window.editor.getNodeMenu().show(window.editor.getView().getNode(eval(src)('KID')), 100, 100), personByExt);
  const radios = await adoptionRadios(page);
  expect(radios.find((r) => r.checked).value).toBe('in');
  radios.forEach((r) => expect(r.disabled, r.value).toBe(true));

  await setProperty(page, 'KID', { setAdoption: 'out' });
  expect((await adoption(page, 'KID')).code).toBe('in');
});
