import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// Guards the e2e harness itself: after replacing localEditor.html's editor with a test's own,
// each property change must be handled once. The probe is a strictly compared date (as a
// linked-record refresh sends): with two live Controllers the second pass compares the string
// with the Date the first stored, applies it again, and adds a second undo step.
async function loadOwnEditor(page, { retire }) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  if (retire) {
    await retireAutoCreatedEditor(page);
  }
  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({});
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(300);
}

async function undoStepsForOneChange(page) {
  return page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const id = parseInt(Object.keys(map).find((k) => map[k].getType && map[k].getType() === 'Person'), 10);
    const before = window.editor.getActionStack()._size();
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
      detail: { nodeID: id, properties: { setBirthDate: '2000-01-01' }, linkedRecordRefresh: true },
    }));
    return window.editor.getActionStack()._size() - before;
  });
}

test('after retireAutoCreatedEditor, one property change adds exactly one undo step', async ({ page }) => {
  await loadOwnEditor(page, { retire: true });
  expect(await undoStepsForOneChange(page)).toBe(1);
});

test('without it, localEditor.html\'s own Controller also handles the change (why the helper exists)', async ({ page }) => {
  await loadOwnEditor(page, { retire: false });
  expect(await undoStepsForOneChange(page)).toBe(2);
});
