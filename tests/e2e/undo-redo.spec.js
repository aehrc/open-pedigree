import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// The Controller records the DOM CustomEvent it handled (payload in .detail, name in .type), while
// the ActionStack replays and combines events by their Prototype-era .memo and .eventName: redoing
// anything threw, and edits to a name never combined into one undo step.
async function loadOneMan(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({});
    // (loaded as an undo state, so there is one to undo back to)
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, false, true);
  });
  const id = await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    return parseInt(Object.keys(map).find((k) => map[k].getType && map[k].getType() === 'Person'), 10);
  });
  expect(id).not.toBeNaN();
  return { id, errors };
}

function setProperty(page, nodeID, properties) {
  return page.evaluate(([id, props]) => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty',
    { detail: { nodeID: id, properties: props } })), [nodeID, properties]);
}

const firstName = (page, id) => page.evaluate((nodeID) => window.editor.getView().getNode(nodeID).getFirstName(), id);
const lastName = (page, id) => page.evaluate((nodeID) => window.editor.getView().getNode(nodeID).getLastName(), id);
const gender = (page, id) => page.evaluate((nodeID) => window.editor.getView().getNode(nodeID).getGender(), id);
const sisterOf = (page, brother) => page.evaluate((id) => {
  const map = window.editor.getView().getNodeMap();
  return parseInt(Object.keys(map).find((k) => map[k].getType && map[k].getType() === 'Person' &&
    parseInt(k, 10) !== id && window.editor.getGraph().getParentRelationship(parseInt(k, 10)) !== null), 10);
}, brother);
const addSister = (page, personID) => page.evaluate((id) => document.dispatchEvent(new CustomEvent('pedigree:person:newsibling',
  { detail: { personID: id, childParams: { gender: 'F' } } })), personID);
const personCount = (page) => page.evaluate(() => Object.values(window.editor.getView().getNodeMap())
  .filter((n) => n.getType && n.getType() === 'Person').length);
const undo = (page) => page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
const redo = (page) => page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:redo')));

test('a property change can be undone and redone', async ({ page }) => {
  const { id, errors } = await loadOneMan(page);
  await setProperty(page, id, { setFirstName: 'Ann' });

  await undo(page);
  expect(await firstName(page, id)).toBe('');
  await redo(page);
  expect(await firstName(page, id)).toBe('Ann');
  expect(errors).toEqual([]);

  // and undone again after the redo
  await undo(page);
  expect(await firstName(page, id)).toBe('');
  expect(errors).toEqual([]);
});

test('adding a sibling can be undone and redone', async ({ page }) => {
  const { id, errors } = await loadOneMan(page);
  const before = await personCount(page);
  await addSister(page, id);
  const after = await personCount(page);
  expect(after).toBeGreaterThan(before);

  await undo(page);
  expect(await personCount(page)).toBe(before);
  await redo(page);
  expect(await personCount(page)).toBe(after);
  expect(errors).toEqual([]);
});

test('typing a name is one undo step, as the name field sends a change on every key', async ({ page }) => {
  const { id, errors } = await loadOneMan(page);
  const size = () => page.evaluate(() => window.editor.getActionStack()._size());
  const before = await size();
  for (const typed of ['A', 'An', 'Ann']) {
    await setProperty(page, id, { setFirstName: typed });
  }
  expect(await size()).toBe(before + 1);

  await undo(page);
  expect(await firstName(page, id)).toBe('');
  await redo(page);
  expect(await firstName(page, id)).toBe('Ann');
  expect(errors).toEqual([]);
});

test('removing a person straight after renaming them is its own undo step', async ({ page }) => {
  const { id, errors } = await loadOneMan(page);
  await addSister(page, id);
  const withSister = await personCount(page);
  const sister = await sisterOf(page, id);
  await setProperty(page, sister, { setFirstName: 'Sue' });
  await page.evaluate((nodeID) => document.dispatchEvent(new CustomEvent('pedigree:node:remove',
    { detail: { nodeID } })), sister);
  expect(errors).toEqual([]);
  expect(await personCount(page)).toBe(withSister - 1);

  await undo(page);
  expect(await personCount(page)).toBe(withSister);
  expect(await firstName(page, sister)).toBe('Sue');
  await undo(page);
  expect(await firstName(page, sister)).toBe('');
  expect(errors).toEqual([]);
});

test('a key typed after a change to several properties is its own step, so undo and redo keep them all', async ({ page }) => {
  // (as linking a patient sets the name with the rest)
  const { id, errors } = await loadOneMan(page);
  await setProperty(page, id, { setFirstName: 'Ann', setLastName: 'Lee', setGender: 'F' });
  await setProperty(page, id, { setFirstName: 'Anna' });

  await undo(page);
  expect([await firstName(page, id), await lastName(page, id), await gender(page, id)]).toEqual(['Ann', 'Lee', 'F']);
  await undo(page);
  expect([await firstName(page, id), await lastName(page, id), await gender(page, id)]).toEqual(['', '', 'M']);
  await redo(page);
  expect([await firstName(page, id), await lastName(page, id), await gender(page, id)]).toEqual(['Ann', 'Lee', 'F']);
  await redo(page);
  expect(await firstName(page, id)).toBe('Anna');
  expect(errors).toEqual([]);
});

test('a name typed after an undo is a step of its own, so undo goes back to the name before it', async ({ page }) => {
  const { id, errors } = await loadOneMan(page);
  await setProperty(page, id, { setFirstName: 'Ann' });
  await setProperty(page, id, { setLastName: 'Lee' });
  await undo(page);
  await setProperty(page, id, { setFirstName: 'Bob' });

  await undo(page);
  expect(await firstName(page, id)).toBe('Ann');
  await undo(page);
  expect(await firstName(page, id)).toBe('');
  expect(errors).toEqual([]);
});

test('a new sibling and then her name are both redone', async ({ page }) => {
  const { id, errors } = await loadOneMan(page);
  await addSister(page, id);
  const sister = await sisterOf(page, id);
  const withSister = await personCount(page);
  await setProperty(page, sister, { setFirstName: 'Sue' });

  await undo(page);
  await undo(page);
  expect(await personCount(page)).toBe(1);
  await redo(page);
  await redo(page);
  expect(await personCount(page)).toBe(withSister);
  expect(await firstName(page, sister)).toBe('Sue');
  expect(errors).toEqual([]);
});
