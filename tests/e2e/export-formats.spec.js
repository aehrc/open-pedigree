import { test, expect } from '@playwright/test';

async function loadEditor(page) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
}

test('export dialog opens and shows all format options', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-export-chooser')).toBeVisible({ timeout: 5000 });

  await expect(page.locator('input[name="export-type"][value="ped"]')).toBeAttached();
  await expect(page.locator('input[name="export-type"][value="GA4GH"]')).toBeAttached();
  await expect(page.locator('input[name="export-type"][value="DADA2"]')).toBeAttached();
  await expect(page.locator('input[name="export-type"][value="svg"]')).toBeAttached();
});

test('PED export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-export-chooser')).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.evaluate(() => {
      const pedRadio = document.querySelector('input[type=radio][name="export-type"][value="ped"]');
      pedRadio.checked = true;
      pedRadio.click();
      document.getElementById('export_button').click();
    }),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree.ped');
});

test('DADA2 export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-export-chooser')).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.evaluate(() => {
      const dada2Radio = document.querySelector('input[type=radio][name="export-type"][value="DADA2"]');
      dada2Radio.checked = true;
      dada2Radio.click();
      document.getElementById('export_button').click();
    }),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree.dada2');
});

test('GA4GH FHIR export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-export-chooser')).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.evaluate(() => {
      const ga4ghRadio = document.querySelector('input[type=radio][name="export-type"][value="GA4GH"]');
      ga4ghRadio.checked = true;
      ga4ghRadio.click(); // fires disableEnableOptions → shows privacy section
      document.getElementById('export_button').click();
    }),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree-GA4GH-fhir.json');
});

// exportAsSVG also makes the image embedded in a saved GA4GH/PEDX pedigree (localStorageBackend),
// which hosts such as redcap_pedigree_editor show as the pedigree's thumbnail.
test('SVG export downloads the drawn pedigree as an SVG image', async ({ page }) => {
  await loadEditor(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (/Error creating svg|is not defined/.test(m.text())) errors.push(m.text()); });
  await page.evaluate(() => window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true));
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-export-chooser')).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.evaluate(() => {
      const svgRadio = document.querySelector('input[type=radio][name="export-type"][value="svg"]');
      svgRadio.checked = true;
      svgRadio.click();
      document.getElementById('export_button').click();
    }),
  ]);
  const svg = require('fs').readFileSync(await download.path(), 'utf8');
  expect(errors).toEqual([]);
  expect(svg).toMatch(/^<svg[\s>]/);
  // Sized to the drawing (getBBox of the canvas's svg).
  expect(svg).toMatch(/viewBox="-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+"/);
  expect(svg).not.toContain('NaN');
});

test('SVG export copes with a non-breaking space in a label (e.g. pasted from Word)', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty',
    { detail: { nodeID: 0, properties: { setFirstName: 'Mary Ann', setLastName: 'O’Neil & Co <3>' } } })));
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-export-chooser')).toBeVisible({ timeout: 5000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.evaluate(() => {
      const svgRadio = document.querySelector('input[type=radio][name="export-type"][value="svg"]');
      svgRadio.checked = true;
      svgRadio.click();
      document.getElementById('export_button').click();
    }),
  ]);
  const svg = require('fs').readFileSync(await download.path(), 'utf8');
  expect(svg).toMatch(/^<svg[\s>]/);
  expect(svg).not.toContain('parsererror');
  expect(svg).toContain('Mary Ann');
});
