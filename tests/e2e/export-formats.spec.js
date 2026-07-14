import { test, expect } from '@playwright/test';

async function loadEditor(page) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
}

async function openExportDialog(page) {
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('#export_button')).toBeVisible({ timeout: 5000 });
}

// Scope a query to the container of #export_button to avoid matching the import dialog
function exportQuery(selector) {
  return `document.getElementById('export_button').closest('.msdialog-modal-container').querySelector('${selector}')`;
}

test('export dialog opens and shows all format options', async ({ page }) => {
  await loadEditor(page);
  await openExportDialog(page);

  // Check within the export dialog container to avoid strict mode violations with import dialog
  for (const val of ['ped', 'GA4GH', 'DADA2', 'svg']) {
    const found = await page.evaluate(
      (v) => !!document.getElementById('export_button').closest('.msdialog-modal-container').querySelector(`input[value="${v}"]`),
      val
    );
    expect(found, `input[value="${val}"] not found in export dialog`).toBe(true);
  }
});

test('PED export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
  await openExportDialog(page);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.evaluate(() => {
      const container = document.getElementById('export_button').closest('.msdialog-modal-container');
      const radio = container.querySelector('input[value="ped"]');
      radio.checked = true;
      radio.click();
      document.getElementById('export_button').click();
    }),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree.ped');
});

test('DADA2 export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
  await openExportDialog(page);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.evaluate(() => {
      const container = document.getElementById('export_button').closest('.msdialog-modal-container');
      const radio = container.querySelector('input[value="DADA2"]');
      radio.checked = true;
      radio.click();
      document.getElementById('export_button').click();
    }),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree.dada2');
});

test('GA4GH FHIR export triggers a download with correct filename', async ({ page }) => {
  await loadEditor(page);
  await openExportDialog(page);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.evaluate(() => {
      const container = document.getElementById('export_button').closest('.msdialog-modal-container');
      const ga4ghRadio = container.querySelector('input[value="GA4GH"]');
      ga4ghRadio.checked = true;
      ga4ghRadio.click();
      // Ensure a privacy option is selected
      const privacyRadio = container.querySelector('input[type=radio][name="privacy-options"]');
      if (privacyRadio && !container.querySelector('input:checked[name="privacy-options"]')) {
        privacyRadio.checked = true;
      }
      document.getElementById('export_button').click();
    }),
  ]);

  expect(download.suggestedFilename()).toBe('open-pedigree-GA4GH-fhir.json');
});
