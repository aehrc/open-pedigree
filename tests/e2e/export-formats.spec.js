import { test, expect } from '@playwright/test';

async function loadEditor(page) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
}

async function loadEditorWithTemplate(page) {
  await loadEditor(page);
  // Select the first template (Proband) so the pedigree graph has valid node data
  const pictureBox = page.locator('.picture-box').first();
  if (await pictureBox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pictureBox.click();
    await page.waitForTimeout(500);
  }
}

test('export dialog opens and shows PED and FHIR format options', async ({ page }) => {
  await loadEditorWithTemplate(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-import-chooser')).toBeVisible({ timeout: 5000 });

  await expect(page.locator('input[value="ped"]')).toBeAttached();
  await expect(page.locator('input[value="fhir"]')).toBeAttached();
});

test('PED export triggers a download with correct filename', async ({ page }) => {
  await loadEditorWithTemplate(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-import-chooser')).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    (async () => {
      await page.check('input[value="ped"]', { force: true });
      await page.locator('#export_button').click({ force: true });
    })(),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree.ped');
});

test('FHIR export triggers a download with correct filename', async ({ page }) => {
  await loadEditorWithTemplate(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-import-chooser')).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    (async () => {
      await page.check('input[value="fhir"]', { force: true });
      await page.locator('#export_button').click({ force: true });
    })(),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree-fhir.json');
});
