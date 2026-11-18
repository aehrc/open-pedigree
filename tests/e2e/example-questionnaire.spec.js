import { test, expect } from '@playwright/test';

// localEditor.html with a form stored beside an example (pedigree-questionnaire-launcher): with
// ?example=<name>, a Questionnaire under questionnaire-<name> is the node form, its value sets
// served by the demo's terminology server; without one, the built-in form, as before. The
// visitor's own pedigree (pedigreeData) is never read or written.

const BASE = 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/';
const STUDY_FORM = {
  resourceType: 'Questionnaire',
  item: [{
    linkId: 'study', type: 'group', text: 'Study',
    item: [
      { linkId: 'enrolled', type: 'boolean', text: 'Enrolled in the study' },
      {
        linkId: 'study_conditions', type: 'choice', text: 'Study conditions', repeats: true,
        answerValueSet: 'http://example.org/fhir/ValueSet/study-conditions',
        extension: [{ url: BASE + 'questionnaire-field-mapping', valueCode: 'mapsToLegendCondition' }],
      },
    ],
  }],
};

async function openWith(page, query, stored) {
  page.on('dialog', (dialog) => dialog.dismiss());
  // (no terminology server is reached: only the configuration is checked)
  await page.route(/ontoserver|\/fhir\/(ValueSet|CodeSystem)/, (route) => route.abort());
  await page.addInitScript((entries) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, value));
    }
  }, stored);
  await page.goto('/localEditor.html' + query);
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => !!window.editor && !window.editor.isAwaitingFirstLoad())).toBe(true);
}

const formItems = (page) => page.evaluate(() => window.editor.getQuestionnaireConfig().items.map((i) => i.linkId));

test('a Questionnaire stored beside an example is the node form, its legend served by the terminology server', async ({ page }) => {
  await openWith(page, '?example=study', { 'questionnaire-study': JSON.stringify(STUDY_FORM), pedigreeData: JSON.stringify({ value: 'mine' }) });
  const items = await formItems(page);
  expect(items).toContain('enrolled');
  expect(items).toContain('study_conditions');
  // the custom legend exists only when its value set has a terminology server (else a plain field)
  expect(await page.evaluate(() => !!window.editor.getQuestionnaireLegend('study_conditions'))).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(window.editor.getQuestionnaireTerminology('study_conditions')))).toContain('tx.ontoserver.csiro.au');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pedigreeData')).value)).toBe('mine');
});

test('without a stored Questionnaire the editor uses its built-in form', async ({ page }) => {
  await openWith(page, '?example=study', {});
  const items = await formItems(page);
  expect(items).not.toContain('study_conditions');
  expect(items).toContain('disorders');
});

test('a form stored for another example, or for the visitor\'s own pedigree, isn\'t used', async ({ page }) => {
  await openWith(page, '', { 'questionnaire-study': JSON.stringify(STUDY_FORM), 'questionnaire-pedigreeData': JSON.stringify(STUDY_FORM) });
  expect(await formItems(page)).not.toContain('study_conditions');
});

test('a stored Questionnaire that isn\'t JSON leaves the built-in form', async ({ page }) => {
  await openWith(page, '?example=study', { 'questionnaire-study': '{not json' });
  expect(await formItems(page)).toContain('disorders');
});
