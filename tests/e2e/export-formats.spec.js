import { test, expect } from '@playwright/test';

async function loadEditor(page) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
}

test('export dialog opens and shows all format options', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-import-chooser')).toBeVisible({ timeout: 5000 });

  await expect(page.locator('input[value="ped"]')).toBeAttached();
  await expect(page.locator('input[value="GA4GH"]')).toBeAttached();
  await expect(page.locator('input[value="DADA2"]')).toBeAttached();
  await expect(page.locator('input[value="svg"]')).toBeAttached();
});

test('PED export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
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

test('DADA2 export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-import-chooser')).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    (async () => {
      await page.check('input[value="DADA2"]', { force: true });
      await page.locator('#export_button').click({ force: true });
    })(),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree.dada2');
});

test('GA4GH FHIR export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-import-chooser')).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    // Use PrototypeJS $$ and $ within the page context so observers fire correctly
    page.evaluate(() => {
      const ga4ghRadio = $$('input[type=radio][name="export-type"][value="GA4GH"]')[0];
      ga4ghRadio.checked = true;
      ga4ghRadio.click(); // fires disableEnableOptions → shows privacy section
      $('export_button').click();
    }),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree-GA4GH-fhir.json');
});
