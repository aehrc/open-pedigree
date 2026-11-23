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
  // and not adopted takes the brackets away
  await setProperty(page, 'IN', { setAdoption: 'none' });
  expect(await adoption(page, 'IN')).toEqual({ code: '', brackets: false });
});

test('an adopted-in child who becomes a fetus loses the dashed line with the adoption', async ({ page }) => {
  await open(page, 'local:adoptInOut8?format=GA4GH', FAMILY);
  await setProperty(page, 'IN', { setAdoption: 'in' });
  expect((await dashedLineEnds(page)).length).toBeGreaterThan(0);
  await setProperty(page, 'IN', { setLifeStatus: 'unborn' });
  expect(await adoption(page, 'IN')).toEqual({ code: '', brackets: false });
  expect(await dashedLineEnds(page)).toEqual([]);
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
  // nor "not adopted", however it comes (a linked row's "0", a yes/no's no)
  await setProperty(page, 'KID', { setAdoption: '' });
  await setProperty(page, 'KID', { setAdopted: false });
  expect((await adoption(page, 'KID')).code).toBe('in');
});

test('a fetus is never adopted, directly or through a twin', async ({ page }) => {
  await open(page, 'local:adoptInOut5?format=GA4GH', FAMILY);
  await setProperty(page, 'NOT', { setLifeStatus: 'unborn' });
  await setProperty(page, 'NOT', { setAdoption: 'out' });
  await setProperty(page, 'NOT', { setAdopted: true });
  expect(await adoption(page, 'NOT')).toEqual({ code: '', brackets: false });

  // a twin of the fetus set adopted out: the fetus stays not adopted
  await page.evaluate((src) => document.dispatchEvent(new window.CustomEvent('pedigree:node:modify', { detail: { nodeID: eval(src)('NOT'), modifications: { addTwin: 2 } } })), personByExt);
  const twin = await page.evaluate((src) => window.editor.getGraph().getAllTwinsSortedByOrder(eval(src)('NOT')).find((v) => v !== eval(src)('NOT')), personByExt);
  await page.evaluate((v) => {
    document.dispatchEvent(new window.CustomEvent('pedigree:node:setproperty', { detail: { nodeID: v, properties: { setLifeStatus: 'alive' } } }));
    document.dispatchEvent(new window.CustomEvent('pedigree:node:setproperty', { detail: { nodeID: v, properties: { setAdoption: 'out' } } }));
  }, twin);
  expect(await page.evaluate((v) => window.editor.getView().getNode(v).getAdoption(), twin)).toBe('out');
  expect((await adoption(page, 'NOT')).code).toBe('');
});

test('a twin added to an adopted child shares the adoption', async ({ page }) => {
  await open(page, 'local:adoptInOut6?format=GA4GH', FAMILY);
  await setProperty(page, 'IN', { setAdoption: 'in' });
  await page.evaluate((src) => document.dispatchEvent(new window.CustomEvent('pedigree:node:modify', { detail: { nodeID: eval(src)('IN'), modifications: { addTwin: 2 } } })), personByExt);
  const codes = await page.evaluate((src) => window.editor.getGraph().getAllTwinsSortedByOrder(eval(src)('IN')).map((v) => window.editor.getView().getNode(v).getAdoption()), personByExt);
  expect(codes).toEqual(['in', 'in']);
});

test('picking "Not adopted" for someone who isn\'t adopted is no change (no undo step)', async ({ page }) => {
  await open(page, 'local:adoptInOut7?format=GA4GH', FAMILY);
  const steps = () => page.evaluate(() => window.editor.getActionStack()._stack.length);
  const before = await steps();
  await setProperty(page, 'NOT', { setAdoption: 'none' });
  expect(await steps()).toBe(before);
});

const twinsOf = (page, ext) => page.evaluate((src) => window.editor.getGraph().getAllTwinsSortedByOrder(eval(src)), `(${personByExt})('${ext}')`);
const setOn = (page, v, properties) => page.evaluate(([id, p]) => document.dispatchEvent(new window.CustomEvent('pedigree:node:setproperty', { detail: { nodeID: id, properties: p } })), [v, properties]);
const adoptionOf = (page, v) => page.evaluate((id) => window.editor.getView().getNode(id).getAdoption(), v);
const addTwin = (page, v) => page.evaluate((id) => document.dispatchEvent(new window.CustomEvent('pedigree:node:modify', { detail: { nodeID: id, modifications: { addTwin: 2 } } })), v);

test('a fetal twin, once born, takes the adoption its twins share', async ({ page }) => {
  await open(page, 'local:adoptInOut9?format=GA4GH', FAMILY);
  const [first] = await twinsOf(page, 'IN');
  await addTwin(page, first);
  const twins = await twinsOf(page, 'IN');
  const other = twins.find((v) => v !== first);
  await setOn(page, other, { setLifeStatus: 'unborn' });
  await setOn(page, first, { setAdoption: 'in' });
  expect(await adoptionOf(page, other)).toBe('');
  await setOn(page, other, { setLifeStatus: 'alive' });
  expect(await adoptionOf(page, other)).toBe('in');
  // every twin's line, the shared piece included, is dashed: all end at one of the twins
  const xs = await Promise.all(twins.map((v) => page.evaluate((id) => Math.round(window.editor.getView().getNode(id).getX()), v)));
  // (a line can be drawn either way: both its ends count)
  const ends = await page.evaluate(() => [...document.querySelectorAll('#canvas svg path')]
    .filter((p) => p.getAttribute('stroke-dasharray') && p.getAttribute('stroke-dasharray') !== 'none')
    .flatMap((p) => {
      const n = (p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
      return [Math.round(n[0]), Math.round(n[n.length - 2])];
    }));
  xs.forEach((x) => expect(ends).toContain(x));
  // the shared piece, which ends at the twins' middle
  const middle = Math.round((xs[0] + xs[1]) / 2);
  expect(ends.some((x) => Math.abs(x - middle) <= 1)).toBe(true);
});

test('a twin added from a fetal twin shares the born twins\' adoption', async ({ page }) => {
  await open(page, 'local:adoptInOut10?format=GA4GH', FAMILY);
  const [first] = await twinsOf(page, 'IN');
  await setOn(page, first, { setAdoption: 'in' });
  await addTwin(page, first);
  const fetal = (await twinsOf(page, 'IN')).find((v) => v !== first);
  await setOn(page, fetal, { setLifeStatus: 'unborn' });
  expect(await adoptionOf(page, fetal)).toBe('');
  await page.evaluate((id) => document.dispatchEvent(new window.CustomEvent('pedigree:node:modify', { detail: { nodeID: id, modifications: { addTwin: 2 } } })), fetal);
  const added = (await twinsOf(page, 'IN')).filter((v) => v !== first && v !== fetal);
  expect(added.length).toBe(1);
  expect(await adoptionOf(page, added[0])).toBe('in');
});

test('one change that has a fetus born and adopted keeps the adoption, whatever the order', async ({ page }) => {
  await open(page, 'local:adoptInOut11?format=GA4GH', FAMILY);
  await setProperty(page, 'NOT', { setLifeStatus: 'unborn' });
  await setProperty(page, 'NOT', { setAdoption: 'in', setLifeStatus: 'alive' });
  expect(await adoption(page, 'NOT')).toEqual({ code: 'in', brackets: true });
});
