/* global require */
import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// The GA4GH export's privacy options, through the export dialog with the built-in Questionnaire:
// "Remove personal information" leaves out names, the external ID, dates and the reference to the
// person in another system; the stricter option also leaves out comments. Before, all of them were
// still in the file (the QuestionnaireResponse wrote every answer, and the external ID and comments
// were written whatever the setting).

const PERSON = {
  setFirstName: 'Zebedee', setLastName: 'Quarrington', setExternalID: 'MRN998877',
  setBirthDate: '1961-03-04', setLifeStatus: 'deceased', setDeathDate: '2020-06-01', setComments: 'seen at clinic',
};
const SECRETS = { name: 'Zebedee', surname: 'Quarrington', externalId: 'MRN998877', birthYear: '1961', deathYear: '2020', comments: 'seen at clinic', patientRef: 'Patient/4242' };

async function open(page) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate(() => {
    document.querySelectorAll('#work-area, #editor-menu').forEach((el) => el.remove());
    document.querySelectorAll('.pedigree-template-chooser, .pedigree-export-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove());
    window.localStorage.removeItem('ga4ghprivacy');
    window.editor = window.OpenPedigree.initialiseEditor({ backend: window.OpenPedigree.localStorageBackend, patientDataUrl: 'local:ga4ghprivacy?format=GA4GH' });
  });
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  await page.evaluate(() => document.querySelectorAll('.pedigree-template-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove()));
  await page.evaluate(() => window.editor.getSaveLoadEngine().createGraphFromImportData('f 1 0 0 1 1', 'ped', { externalIdMark: true }, false, true));
  await page.evaluate((properties) => {
    document.dispatchEvent(new window.CustomEvent('pedigree:node:setproperty', { detail: { nodeID: 0, properties } }));
    const node = window.editor.getView().getNode(0);
    node.setLinkedPatientRef('Patient/4242');
    window.editor.getGraph().setProperties(0, node.getProperties());
  }, PERSON);
}

async function exportGA4GH(page, privacy) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.evaluate((privacy) => {
      window.editor.getExportSelector().show();
      const format = document.querySelector('input[type=radio][name="export-type"][value="GA4GH"]');
      format.checked = true;
      format.click();
      const option = document.querySelector(`input[type=radio][name="privacy-options"][value="${privacy}"]`);
      option.checked = true;
      option.click();
      document.getElementById('export_button').click();
    }, privacy),
  ]);
  return require('fs').readFileSync(await download.path(), 'utf-8');
}

const found = (text) => Object.keys(SECRETS).filter((k) => text.includes(SECRETS[k])).sort();

test('the GA4GH export leaves out what each privacy option says', async ({ page }) => {
  await open(page);
  expect(found(await exportGA4GH(page, 'all'))).toEqual(Object.keys(SECRETS).sort());
  expect(found(await exportGA4GH(page, 'nopersonal'))).toEqual(['comments']);
  expect(found(await exportGA4GH(page, 'minimal'))).toEqual([]);
  // (still a pedigree: the person, their sex and that they've died)
  const minimal = JSON.parse(await exportGA4GH(page, 'minimal'));
  const patient = minimal.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient');
  expect(patient).toMatchObject({ gender: 'male', deceasedBoolean: true });
});
