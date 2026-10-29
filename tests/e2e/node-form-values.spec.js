import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// The node form's controls are reused for every person: opening a person must show their own
// answers, never what the previous person's form left behind.
const ITEM_CONTROL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
const option = (code, display) => ({ valueCoding: { code, display } });

const QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-node-form-values',
  version: '1.0',
  item: [
    {
      linkId: 'custom_tab', type: 'group', text: 'Custom',
      item: [
        { linkId: 'colour', type: 'choice', text: 'Colour', answerOption: [option('red', 'Red'), option('green', 'Green')] },
        {
          linkId: 'shade', type: 'choice', text: 'Shade', answerOption: [option('light', 'Light'), option('dark', 'Dark')],
          extension: [{ url: ITEM_CONTROL, valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] } }],
        },
        {
          linkId: 'features', type: 'choice', text: 'Features', repeats: true,
          answerOption: [option('1', 'Vertigo'), option('A', 'Tinnitus'), option('-1', 'Not known')],
        },
        { linkId: 'notes', type: 'string', text: 'Notes' },
      ],
    },
  ],
};

async function loadFamily(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate((q) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({ questionnaireLocal: q });
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 2 3 1 1\nfam1 2 0 0 1 1\nfam1 3 0 0 2 1', 'ped', {}, true, true);
  }, QUESTIONNAIRE);
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    return Object.keys(map).filter((id) => map[id].getType && map[id].getType() === 'Person').map(Number);
  });
}

// What the open form shows for each test item.
function shown(page, personId) {
  return page.evaluate((id) => {
    window.editor.getNodeMenu().show(window.editor.getView().getNode(id), 100, 100);
    const select = (name) => document.querySelector(`.menu-box select[name="${name}"]`);
    return {
      colour: [...select('colour').selectedOptions].map((o) => o.value),
      shade: [...document.querySelectorAll('.menu-box .field-shade input[type=radio]')].filter((r) => r.checked).map((r) => r.value),
      features: [...select('features').selectedOptions].map((o) => o.value),
      featuresMultiple: select('features').multiple,
      notes: document.querySelector('.menu-box .field-notes input[type=text]').value,
    };
  }, personId);
}

test('a person with no answers shows none, not the previous person\'s', async ({ page }) => {
  const [first, second] = await loadFamily(page);
  await page.evaluate((id) => {
    const node = window.editor.getView().getNode(id);
    node.setQuestionnaireAnswer('colour', 'red');
    node.setQuestionnaireAnswer('shade', 'dark');
    node.setQuestionnaireAnswer('features', ['A']);
    node.setQuestionnaireAnswer('notes', 'first person');
  }, first);

  expect(await shown(page, first)).toEqual({ colour: ['red'], shade: ['dark'], features: ['A'], featuresMultiple: true, notes: 'first person' });
  await page.evaluate(() => window.editor.getNodeMenu().hide());
  expect(await shown(page, second)).toEqual({ colour: [], shade: [], features: [], featuresMultiple: true, notes: '' });
});

test('a repeating choice shows every ticked option', async ({ page }) => {
  const [first] = await loadFamily(page);
  await page.evaluate((id) => window.editor.getView().getNode(id).setQuestionnaireAnswer('features', ['1', '-1']), first);
  expect((await shown(page, first)).features).toEqual(['1', '-1']);
});

test('choosing several options of a repeating choice stores them all', async ({ page }) => {
  const [first] = await loadFamily(page);
  await shown(page, first);
  await page.locator('.menu-box select[name="features"]').selectOption(['1', 'A']);
  await page.waitForTimeout(200);
  const answer = await page.evaluate((id) => window.editor.getView().getNode(id).getQuestionnaireAnswer('features'), first);
  expect([].concat(answer).map(String).sort()).toEqual(['1', 'A']);
});
