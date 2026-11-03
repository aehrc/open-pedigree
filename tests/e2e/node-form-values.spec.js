import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// The node form's controls are reused for every person: opening a person must show their own
// answers, never what the previous person's form left behind.
const ITEM_CONTROL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
const option = (code, display) => ({ valueCoding: { system: 'http://example.org/cs', code, display } });

const QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-node-form-values',
  version: '1.0',
  item: [
    {
      linkId: 'custom_tab', type: 'group', text: 'Custom',
      item: [
        // an answer-option choice may be left unanswered, so has a '-' choice for that, whether or
        // not it says nullValue
        { linkId: 'colour', type: 'choice', text: 'Colour', nullValue: true, answerOption: [option('red', 'Red'), option('green', 'Green')] },
        { linkId: 'size', type: 'choice', text: 'Size', answerOption: [option('small', 'Small'), option('large', 'Large')] },
        // required: a '-' to show it's unanswered, that can't be chosen
        { linkId: 'grade', type: 'choice', text: 'Grade', required: true, answerOption: [option('g1', 'One'), option('g2', 'Two')] },
        // a range select asks for '-' with nullValue
        { linkId: 'weeks', type: 'integer', text: 'Weeks', nullValue: true, range: { start: 1, end: 3, item: ['week', 'weeks'] } },
        // an unmapped range drop-down gets one without asking
        { linkId: 'days', type: 'integer', text: 'Days', range: { start: 1, end: 2, item: ['day', 'days'] } },
        {
          linkId: 'shade', type: 'choice', text: 'Shade', answerOption: [option('light', 'Light'), option('dark', 'Dark')],
          extension: [{ url: ITEM_CONTROL, valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] } }],
        },
        // an integer radio choice, as REDCap codes No/Yes: 0 is an answer
        {
          linkId: 'smoker', type: 'choice', text: 'Smoker', answerOption: [{ valueInteger: 0 }, { valueInteger: 1 }],
          extension: [{ url: ITEM_CONTROL, valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] } }],
        },
        // a required radio choice: no reset
        {
          linkId: 'tone', type: 'choice', text: 'Tone', required: true, answerOption: [option('warm', 'Warm'), option('cool', 'Cool')],
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
  expect(await shown(page, second)).toEqual({ colour: '', size: '', shade: [], features: [], notes: '' });
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
  // each kept as its option's coding, so it exports as one (not as text)
  expect(answer).toEqual([
    { system: 'http://example.org/cs', code: '1', display: 'Vertigo' },
    { system: 'http://example.org/cs', code: 'A', display: 'Tinnitus' },
  ]);
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

test('a mapped drop-down with no value shows its property\'s default, e.g. heredity\'s "None"', async ({ page }) => {
  const [first] = await loadFamily(page, null);
  const heredity = await page.evaluate((id) => {
    window.editor.getNodeMenu().show(window.editor.getView().getNode(id), 100, 100);
    const select = document.querySelector('.menu-box select[name="childlessSelect"]');
    return { value: select.value, options: [...select.options].map((o) => o.value) };
  }, first);
  expect(heredity).toEqual({ value: 'none', options: ['none', 'childless', 'infertile'] });
});

test('a required choice shows \'-\' when unanswered but can\'t be cleared to it, and a range select has \'-\' only when it asks', async ({ page }) => {
  const [first] = await loadFamily(page);
  const options = await page.evaluate((id) => {
    window.editor.getNodeMenu().show(window.editor.getView().getNode(id), 100, 100);
    const select = (name) => document.querySelector(`.menu-box select[name="${name}"]`);
    const values = (name) => [...select(name).options].map((o) => o.value + (o.disabled ? '(disabled)' : ''));
    const before = { grade: values('grade'), gradeShown: select('grade').value, weeks: values('weeks'), size: values('size'), days: values('days') };
    // the form's disabled state toggling (e.g. disabledWhen) leaves the required item's '-' fixed
    const menu = window.editor.getNodeMenu();
    menu._setFieldDisabled.select(menu.fieldMap.grade.element, true);
    menu._setFieldDisabled.select(menu.fieldMap.grade.element, false);
    menu._setFieldDisabled.select(menu.fieldMap.grade.element, ['g2']);
    return { ...before, gradeAfterToggles: values('grade') };
  }, first);
  expect(options).toEqual({
    grade: ['(disabled)', 'g1', 'g2'], gradeShown: '', weeks: ['', '1', '2', '3'], size: ['', 'small', 'large'],
    days: ['', '1', '2'], gradeAfterToggles: ['(disabled)', 'g1', 'g2(disabled)'],
  });
});

// A radio choice, like a drop-down's '-', can go back to unanswered: a "reset", as on REDCap's forms.
const resetShade = (page) => page.evaluate(() => document.querySelector('.menu-box .field-shade button.field-reset').click());
const shadeCode = (page, id) => page.evaluate((nodeId) => {
  // a choice answer is stored as its coding
  const value = window.editor.getView().getNode(nodeId).getQuestionnaireAnswer('shade');
  return value && typeof value === 'object' ? value.code : value;
}, id);
const tickedShade = (page) => page.$$eval('.menu-box .field-shade input[type=radio]', (radios) => radios.filter((r) => r.checked).map((r) => r.value));

test('a radio choice can be reset to unanswered, as one undo step', async ({ page }) => {
  const [first] = await loadFamily(page);
  await page.evaluate((id) => window.editor.getNodeMenu().show(window.editor.getView().getNode(id), 100, 100), first);
  await page.evaluate(() => document.querySelector('.menu-box .field-shade input[value="dark"]').click());
  expect(await shadeCode(page, first)).toBe('dark');

  await resetShade(page);
  expect(await shadeCode(page, first)).toBeFalsy();
  expect(await tickedShade(page)).toEqual([]);

  // with no answer, reset changes nothing - not even an undo step, so one undo brings back 'dark'
  await resetShade(page);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
  await expect.poll(() => shadeCode(page, first)).toBe('dark');
  expect(await shown(page, first)).toMatchObject({ shade: ['dark'] });
});

test('reset clears an answer that matches none of the choice\'s options', async ({ page }) => {
  const [first] = await loadFamily(page);
  await page.evaluate((id) => {
    const node = window.editor.getView().getNode(id);
    node.setQuestionnaireAnswer('shade', { system: 'http://example.org/cs', code: 'purple', display: 'Purple' });
    window.editor.getNodeMenu().show(node, 100, 100);
  }, first);
  expect(await tickedShade(page)).toEqual([]);
  await resetShade(page);
  expect(await shadeCode(page, first)).toBeFalsy();
});

// == takes 0 for '': an answer of 0 must still be a change from unanswered, both ways.
test('an answer of 0 can be chosen and reset', async ({ page }) => {
  const [first] = await loadFamily(page);
  const smoker = () => page.evaluate((id) => window.editor.getView().getNode(id).getQuestionnaireAnswer('smoker'), first);
  await page.evaluate((id) => window.editor.getNodeMenu().show(window.editor.getView().getNode(id), 100, 100), first);
  await page.evaluate(() => document.querySelector('.menu-box .field-smoker input[value="0"]').click());
  expect(await smoker()).toBe(0);
  await page.evaluate(() => document.querySelector('.menu-box .field-smoker button.field-reset').click());
  expect(await smoker()).toBeUndefined();
  expect(await page.$$eval('.menu-box .field-smoker input[type=radio]', (radios) => radios.filter((r) => r.checked).length)).toBe(0);
});

test('only an optional, unmapped radio choice has a reset, usable unless the field is read-only', async ({ page }) => {
  const [first] = await loadFamily(page);
  await page.evaluate((id) => window.editor.getView().getNode(id).setQuestionnaireAnswer('shade', 'dark'), first);
  const resets = await page.evaluate((id) => {
    const menu = window.editor.getNodeMenu();
    menu.show(window.editor.getView().getNode(id), 100, 100);
    const names = [...document.querySelectorAll('.menu-box button.field-reset')].map((b) => b.name);
    const reset = document.querySelector('.menu-box .field-shade button.field-reset');
    const label = reset.getAttribute('aria-label');
    const element = menu.fieldMap.shade.element;
    menu._setFieldDisabled.radio(element, true);
    const readOnly = reset.disabled;
    menu._setFieldDisabled.radio(element, ['light']);
    const anotherOptionOff = reset.disabled;
    menu._setFieldDisabled.radio(element, ['dark']);
    const answersOptionOff = reset.disabled;
    // as update() does it: inactive, then disabled (which enables the options again)
    menu._setFieldInactive.radio(element, ['dark']);
    menu._setFieldDisabled.radio(element, false);
    const answersOptionHidden = reset.disabled;
    menu._setFieldInactive.radio(element, false);
    menu._setFieldDisabled.radio(element, false);
    const allBack = reset.disabled;
    return { names, label, readOnly, anotherOptionOff, answersOptionOff, answersOptionHidden, allBack };
  }, first);
  expect(resets).toEqual({
    names: ['shade', 'smoker'], label: 'Reset Shade', readOnly: true, anotherOptionOff: false, answersOptionOff: false, answersOptionHidden: false, allBack: false,
  });
});

test('the default form\'s radios, all mapped to the person\'s properties (e.g. gender), have no reset', async ({ page }) => {
  const [person] = await loadFamily(page, null);
  const defaults = await page.evaluate((id) => {
    window.editor.getNodeMenu().show(window.editor.getView().getNode(id), 100, 100);
    return document.querySelectorAll('.menu-box button.field-reset').length;
  }, person);
  expect(defaults).toBe(0);
});
