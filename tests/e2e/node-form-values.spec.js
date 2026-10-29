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
        // a choice that may be left unanswered (as REDCap's are) has a '-' choice for that
        { linkId: 'colour', type: 'choice', text: 'Colour', nullValue: true, answerOption: [option('red', 'Red'), option('green', 'Green')] },
        // without one, no answer shows the first option, as a new form does
        { linkId: 'size', type: 'choice', text: 'Size', answerOption: [option('small', 'Small'), option('large', 'Large')] },
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

// Three people (a child and their parents); with no questionnaire, the editor's default one.
async function loadFamily(page, questionnaire = QUESTIONNAIRE) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate((q) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor(q ? { questionnaireLocal: q } : {});
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 2 3 1 1\nfam1 2 0 0 1 1\nfam1 3 0 0 2 1', 'ped', {}, true, true);
  }, questionnaire);
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
      colour: select('colour').value,
      size: select('size').value,
      shade: [...document.querySelectorAll('.menu-box .field-shade input[type=radio]')].filter((r) => r.checked).map((r) => r.value),
      features: [...document.querySelectorAll('.menu-box .field-features input[type=checkbox]')].filter((b) => b.checked).map((b) => b.value),
      notes: document.querySelector('.menu-box .field-notes input[type=text]').value,
    };
  }, personId);
}

test('a person with no answers shows none, not the previous person\'s', async ({ page }) => {
  const [first, second] = await loadFamily(page);
  await page.evaluate((id) => {
    const node = window.editor.getView().getNode(id);
    node.setQuestionnaireAnswer('colour', 'red');
    node.setQuestionnaireAnswer('size', 'large');
    node.setQuestionnaireAnswer('shade', 'dark');
    node.setQuestionnaireAnswer('features', ['A']);
    node.setQuestionnaireAnswer('notes', 'first person');
  }, first);

  expect(await shown(page, first)).toEqual({ colour: 'red', size: 'large', shade: ['dark'], features: ['A'], notes: 'first person' });
  await page.evaluate(() => window.editor.getNodeMenu().hide());
  expect(await shown(page, second)).toEqual({ colour: '', size: 'small', shade: [], features: [], notes: '' });
});

test('a repeating choice shows every ticked option', async ({ page }) => {
  const [first] = await loadFamily(page);
  await page.evaluate((id) => window.editor.getView().getNode(id).setQuestionnaireAnswer('features', ['1', '-1']), first);
  expect((await shown(page, first)).features).toEqual(['1', '-1']);
});

test('choosing several options of a repeating choice stores them all', async ({ page }) => {
  const [first] = await loadFamily(page);
  await shown(page, first);
  // clicked in the page: the floating form never counts as "stable" for Playwright's check()
  await page.evaluate(() => ['1', 'A'].forEach((v) => document.querySelector(`.menu-box .field-features input[value="${v}"]`).click()));
  await page.waitForTimeout(200);
  const answer = await page.evaluate((id) => window.editor.getView().getNode(id).getQuestionnaireAnswer('features'), first);
  expect([].concat(answer).map(String).sort()).toEqual(['1', 'A']);
});

test('a legend picker shows a term\'s current name, not the one it had when first shown', async ({ page }) => {
  const [id] = await loadFamily(page, null);
  const pickerText = await page.evaluate(async (id) => {
    const node = window.editor.getView().getNode(id);
    node.setDisorders(['111111']);
    const menu = window.editor.getNodeMenu();
    menu.show(node, 100, 100);
    // as if the term was still being looked up when the form first showed it
    const selectize = document.querySelector('.menu-box select.suggest-omim').selectize;
    selectize.updateOption('111111', { text: 'loading...', value: '111111' });
    menu.hide();
    window.editor.getDisorderLegend().addToCache('111111', 'Example disorder');
    window.editor.getDisorderLegend().seedTermName('111111', 'Example disorder');
    menu.show(node, 100, 100);
    return [...document.querySelectorAll('.menu-box .field-disorders .selectize-input [data-value]')].map((e) => e.textContent.replace(/×$/, '').trim());
  }, id);
  expect(pickerText).toEqual(['Example disorder']);
});

test('opening one person straight after another, without closing the form, shows the second\'s answers', async ({ page }) => {
  const [first, second] = await loadFamily(page);
  await page.evaluate((id) => {
    const node = window.editor.getView().getNode(id);
    node.setQuestionnaireAnswer('colour', 'red');
    node.setQuestionnaireAnswer('notes', 'first person');
  }, first);
  await shown(page, first);
  const result = await shown(page, second); // no hide() between
  expect(result.colour).toBe('');
  expect(result.notes).toBe('');
});

test('an answer matching no option shows the empty choice, not an option', async ({ page }) => {
  const [first] = await loadFamily(page);
  await page.evaluate((id) => window.editor.getView().getNode(id).setQuestionnaireAnswer('colour', 'blue'), first);
  expect((await shown(page, first)).colour).toBe('');
});

test('a legend picker shows no terms for a person with none, not the last person\'s', async ({ page }) => {
  const [first, second] = await loadFamily(page, null);
  const pickers = await page.evaluate(({ first, second }) => {
    window.editor.getDisorderLegend().addToCache('111111', 'Example disorder');
    window.editor.getView().getNode(first).setDisorders(['111111']);
    const menu = window.editor.getNodeMenu();
    const chips = () => [...document.querySelectorAll('.menu-box .field-disorders .selectize-input [data-value]')].map((e) => e.getAttribute('data-value'));
    menu.show(window.editor.getView().getNode(first), 100, 100);
    const a = chips();
    menu.hide();
    menu.show(window.editor.getView().getNode(second), 100, 100);
    return [a, chips()];
  }, { first, second });
  expect(pickers).toEqual([['111111'], []]);
});

test('unticking every option of a repeating choice leaves no answer', async ({ page }) => {
  const [first] = await loadFamily(page);
  await page.evaluate((id) => window.editor.getView().getNode(id).setQuestionnaireAnswer('features', ['A']), first);
  await shown(page, first);
  await page.evaluate(() => document.querySelector('.menu-box .field-features input[value="A"]').click());
  await page.waitForTimeout(200);
  const answer = await page.evaluate((id) => window.editor.getView().getNode(id).getQuestionnaireAnswer('features'), first);
  expect(answer === undefined || answer === null || answer === '').toBe(true);
});

test('a coded answer (e.g. from a linked record) shows as its code', async ({ page }) => {
  const [first] = await loadFamily(page);
  await page.evaluate((id) => {
    const node = window.editor.getView().getNode(id);
    node.setQuestionnaireAnswer('colour', { system: 'http://example.org', code: 'green', display: 'Green' });
    node.setQuestionnaireAnswer('features', [{ code: '1' }, { code: '-1' }]);
  }, first);
  const result = await shown(page, first);
  expect(result.colour).toBe('green');
  expect(result.features).toEqual(['1', '-1']);
});
