import { test, expect } from '@playwright/test';

// Imports list every problem in the file in one message, and tell the user who imported a file what
// it left out - but loading a stored pedigree never shows those notes (pedigree-import-problem-report).

const FAMILY = ['fam 1 0 0 1 1', 'fam 2 0 0 2 1', 'fam 3 1 2 1 1'];
// A sound family in a GEDCOM file declaring a version the importer doesn't support: imported, with a note.
const GEDCOM_7 = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 CHAR UTF-8',
  '0 @I1@ INDI', '1 NAME John /Smith/', '1 SEX M',
  '0 @I2@ INDI', '1 NAME Jane /Smith/', '1 SEX F',
  '0 @I3@ INDI', '1 NAME Kid /Smith/', '1 SEX F',
  '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@',
  '0 TRLR'].join('\n');

// Every alert shown from here on, accepted.
function collectAlerts(page) {
  const alerts = [];
  page.on('dialog', (dialog) => {
    alerts.push(dialog.message());
    dialog.accept();
  });
  return alerts;
}

async function openEditor(page) {
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  // (the template chooser, if shown, would sit over the import dialog)
  await page.evaluate(() => document.querySelectorAll('.pedigree-template-chooser').forEach((el) => {
    const container = el.closest('.msdialog-modal-container') || el;
    container.remove();
  }));
}

async function importThroughDialog(page, type, text) {
  await page.evaluate(() => window.editor.getImportSelector().show());
  await page.locator('textarea#import').fill(text);
  await page.locator(`input[name="select-type"][value="${type}"]`).check();
  await page.locator('#import_button').click();
}

const people = (page) => page.evaluate(() => {
  const graph = window.editor.getGraph().DG.GG;
  return graph.properties.filter((p, v) => graph.isPerson(v) && !p.placeholder).length;
});

test('a file with several problems is refused with all of them in one message', async ({ page }) => {
  await openEditor(page);
  const alerts = collectAlerts(page);
  const before = await page.evaluate(() => JSON.stringify(window.editor.getGraph().toJSON()));
  await importThroughDialog(page, 'ped', [...FAMILY, 'fam 4 1', 'fam 3 1 2 2 1', 'fam 5 0'].join('\n'));
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toBe('Unable to import pedigree: 3 problems found:\n'
    + '1. Input line has not enough columns: [fam 4 1]\n'
    + '2. Multiple persons with the same ID [3]\n'
    + '3. Input line has not enough columns: [fam 5 0]');
  // nothing imported
  expect(await page.evaluate(() => JSON.stringify(window.editor.getGraph().toJSON()))).toBe(before);
});

test('a file with one problem is refused as before', async ({ page }) => {
  await openEditor(page);
  const alerts = collectAlerts(page);
  await importThroughDialog(page, 'ped', [...FAMILY, 'fam 4 1'].join('\n'));
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toBe('Error importing pedigree: Input line has not enough columns: [fam 4 1]');
});

test('a dialog import that left something out says so, after importing', async ({ page }) => {
  await openEditor(page);
  const alerts = collectAlerts(page);
  await importThroughDialog(page, 'gedcom', GEDCOM_7);
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toMatch(/^Imported, with 1 note:\n1\. Unsupported GEDCOM version detected: \[7\.0\]/);
  expect(await people(page)).toBe(3);
});

test('a file with one problem and a note is refused as before, then the note', async ({ page }) => {
  await openEditor(page);
  const alerts = collectAlerts(page);
  await importThroughDialog(page, 'gedcom', GEDCOM_7.replace('1 CHIL @I3@', '1 CHIL @I9@'));
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toMatch(/^Error importing pedigree: Unable to import pedigree: child link does not point to an existing individual: \[@I9@\]\n\nAlso noted:\n1\. Unsupported GEDCOM version detected: \[7\.0\]/);
});

test('loading a pedigree the way a host does shows no notes', async ({ page }) => {
  await openEditor(page);
  const alerts = collectAlerts(page);
  // (as transportBackend loads a stored pedigree: no showNotes)
  const loaded = await page.evaluate((text) => window.editor.getSaveLoadEngine().createGraphFromImportData(text, 'gedcom', {}, false, true), GEDCOM_7);
  expect(loaded).toBe(true);
  expect(await people(page)).toBe(3);
  await page.waitForTimeout(300);
  expect(alerts).toEqual([]);
});

test('a clean import shows nothing extra', async ({ page }) => {
  await openEditor(page);
  const alerts = collectAlerts(page);
  await importThroughDialog(page, 'ped', FAMILY.join('\n'));
  await expect.poll(() => people(page)).toBe(3);
  await page.waitForTimeout(300);
  expect(alerts).toEqual([]);
});
