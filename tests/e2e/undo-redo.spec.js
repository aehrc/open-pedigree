import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// The Controller records the DOM CustomEvent it handled (payload in .detail, name in .type), while
// the ActionStack replays and combines events by their Prototype-era .memo and .eventName: redoing
// anything threw, and edits to a name never combined into one undo step.
async function loadOneMan(page, { patientProvider } = {}) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate((withPatientProvider) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    // (a provider that finds every linked patient's name, after a moment as a server would - or,
    // 'once', only the first time it is asked, then can't be reached; 'secondTime', straight away
    // but not the first time, as a cache would; 'byHand', when the test answers the lookups queued
    // in window.lookups)
    let lookups = 0;
    window.lookups = [];
    const patientProvider = withPatientProvider ? {
      isConfigured: () => true,
      canImportClinicalData: () => false,
      canLinkProband: () => true,
      canSearchFamilyMembers: () => true,
      lookupPatient: (_ref, onSuccess, onError) => {
        if (withPatientProvider === 'byHand') {
          window.lookups.push(onSuccess);
        } else if (withPatientProvider === 'secondTime') {
          lookups++ > 0 ? onSuccess('Test Person') : onError('unreachable');
        } else {
          setTimeout(() => (withPatientProvider === 'once' && lookups++ > 0
            ? onError('unreachable') : onSuccess('Test Person')), 0);
        }
      },
      openPatientPickerModal: () => {},
      openClinicalImportModal: () => {},
    } : undefined;
    window.editor = window.OpenPedigree.initialiseEditor(patientProvider ? { patientProvider } : {});
    // (loaded as an undo state, so there is one to undo back to)
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, false, true);
  }, patientProvider || false);
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

test('the name found for a linked patient when an undo reloads the pedigree leaves the redo in place', async ({ page }) => {
  const { id, errors } = await loadOneMan(page, { patientProvider: true });
  await setProperty(page, id, { setLinkedPatientRef: 'Patient/1' });
  await addSister(page, id);
  const withSister = await personCount(page);

  await undo(page);
  await expect.poll(() => firstName(page, id)).toBe('Test Person');
  await redo(page);
  expect(await personCount(page)).toBe(withSister);
  expect(errors).toEqual([]);
});

test('a linked patient\'s name found when a pedigree is opened is not an undo step, so typing over it undoes back to it', async ({ page }) => {
  const { id, errors } = await loadOneMan(page, { patientProvider: true });
  await setProperty(page, id, { setLinkedPatientRef: 'Patient/1' });
  await page.evaluate(() => {
    const saved = window.editor.getSaveLoadEngine().serialize();
    window.editor.getSaveLoadEngine().createGraphFromSerializedData(saved, false);
  });
  await expect.poll(() => firstName(page, id)).toBe('Test Person');
  const size = await page.evaluate(() => window.editor.getActionStack()._size());
  await setProperty(page, id, { setFirstName: 'Tess' });
  expect(await page.evaluate(() => window.editor.getActionStack()._size())).toBe(size + 1);

  await undo(page);
  expect(await firstName(page, id)).toBe('Test Person');
  expect(errors).toEqual([]);
});

test('a name typed again after the menu is closed and opened is a new undo step', async ({ page }) => {
  const { id, errors } = await loadOneMan(page);
  const openMenu = () => page.evaluate((nodeID) => window.editor.getNodeMenu().show(window.editor.getView().getNode(nodeID), 0, 0), id);
  const closeMenu = () => page.evaluate(() => window.editor.getNodeMenu().hide());
  await openMenu();
  for (const typed of ['A', 'An', 'Ann']) {
    await setProperty(page, id, { setFirstName: typed });
  }
  await closeMenu();
  await openMenu();
  await setProperty(page, id, { setFirstName: 'Anne' });
  await closeMenu();

  await undo(page);
  expect(await firstName(page, id)).toBe('Ann');
  await undo(page);
  expect(await firstName(page, id)).toBe('');
  expect(errors).toEqual([]);
});

test('a linked patient\'s name found when a pedigree is opened stays after an undo, when it can\'t be looked up again', async ({ page }) => {
  const { id, errors } = await loadOneMan(page, { patientProvider: 'once' });
  await setProperty(page, id, { setLinkedPatientRef: 'Patient/1' });
  await page.evaluate(() => {
    const saved = window.editor.getSaveLoadEngine().serialize();
    window.editor.getSaveLoadEngine().createGraphFromSerializedData(saved, false);
  });
  await expect.poll(() => firstName(page, id)).toBe('Test Person');
  await addSister(page, id);

  await undo(page);
  await page.waitForTimeout(100);
  expect(await firstName(page, id)).toBe('Test Person');
  expect(errors).toEqual([]);
});

test('a linked record\'s refresh is not combined with a name typed before it', async ({ page }) => {
  const { id, errors } = await loadOneMan(page);
  await setProperty(page, id, { setFirstName: 'Ann' });
  const size = await page.evaluate(() => window.editor.getActionStack()._size());
  await page.evaluate((nodeID) => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty',
    { detail: { nodeID, properties: { setFirstName: 'Anna' }, linkedRecordRefresh: true } })), id);
  expect(await page.evaluate(() => window.editor.getActionStack()._size())).toBe(size + 1);

  await undo(page);
  expect(await firstName(page, id)).toBe('Ann');
  expect(errors).toEqual([]);
});

// Opens the pedigree as it is, with node `id` linked to a patient, as a load (an undo step).
async function reopenLinked(page, id) {
  await setProperty(page, id, { setLinkedPatientRef: 'Patient/1' });
  await page.evaluate(() => {
    const saved = window.editor.getSaveLoadEngine().serialize();
    window.editor.getSaveLoadEngine().createGraphFromSerializedData(saved, false);
  });
}

test('a name found straight away while an undo reloads the pedigree goes into the step undone to, not the one left', async ({ page }) => {
  const { id, errors } = await loadOneMan(page, { patientProvider: 'secondTime' });
  await reopenLinked(page, id);
  expect(await firstName(page, id)).toBe('');
  await addSister(page, id);
  await addSister(page, id);
  const withTwo = await personCount(page);

  await undo(page);
  expect(await firstName(page, id)).toBe('Test Person');
  await redo(page);
  expect(await personCount(page)).toBe(withTwo);
  await addSister(page, id);
  await undo(page);
  expect(await personCount(page)).toBe(withTwo);
  expect(errors).toEqual([]);
});

test('a name found after the pedigree was reloaded again is left to the newer lookup', async ({ page }) => {
  const { id, errors } = await loadOneMan(page, { patientProvider: 'byHand' });
  await reopenLinked(page, id);
  await addSister(page, id);
  await undo(page);
  expect(await page.evaluate(() => window.lookups.length)).toBe(2);

  // (the first lookup was for the pedigree as first opened, since reloaded)
  await page.evaluate(() => window.lookups[0]('Stale Person'));
  await page.evaluate(() => window.lookups[1]('Test Person'));
  expect(await firstName(page, id)).toBe('Test Person');
  expect(errors).toEqual([]);
});
