import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// A choice's marked default (answerOption.initialSelected) is the answer of a person added in the
// editor, and the node form shows an option as chosen only when it's the answer
// (pedigree-editor-choice-defaults; play-test follow-ups 5 and 7).

const FIELD_MAPPING = 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping';
const CARRIER_DEFINITION = 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/PedigreeIndividual#PedigreeIndividual.carrierStatus';

// The default form plus an "Extra" tab: a drop-down mapped to carrier status with no "not affected"
// ('') option, an unmapped choice whose "Dark" is the default, a repeating choice with two defaults,
// and a mapped drop-down (twin's carrier) with a default.
async function loadEditor(page, { mappedDefault = false } = {}) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate(({ mapping, definition, withMappedDefault }) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const base = window.OpenPedigree.defaultQuestionnaire;
    const option = (code, display, initialSelected) => ({ valueCoding: { code, display }, ...(initialSelected ? { initialSelected: true } : {}) });
    const questionnaire = {
      ...base,
      // Without the default form's own carrier radio (it maps the same property).
      item: [...JSON.parse(JSON.stringify(base.item)).map((tab) => ({ ...tab, item: (tab.item || []).filter((i) => i.linkId !== 'carrier') })), {
        linkId: 'extra', type: 'group', text: 'Extra', item: [
          { linkId: 'carrier_select', type: 'choice', text: 'Carrier (drop-down)', definition,
            extension: [{ url: mapping, valueCode: 'mapsToField' }],
            answerOption: [option('carrier', 'Carrier', withMappedDefault), option('affected', 'Affected'), option('presymptomatic', 'Pre-symptomatic')] },
          { linkId: 'shade', type: 'choice', text: 'Shade', answerOption: [option('light', 'Light'), option('dark', 'Dark', true)] },
          { linkId: 'tags', type: 'choice', text: 'Tags', repeats: true,
            answerOption: [option('a', 'A', true), option('b', 'B'), option('c', 'C', true)] },
          // a heredity drop-down with "None" not first, and marked as a default
          { linkId: 'heredity_codes', type: 'choice', text: 'Heredity (codes)',
            definition: 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/PedigreeIndividual#PedigreeIndividual.childlessStatus',
            extension: [{ url: mapping, valueCode: 'mapsToField' }],
            answerOption: [option('childless', 'Childless'), option('infertile', 'Infertile'), option('none', 'No', true)] },
        ],
      }],
    };
    window.editor = window.OpenPedigree.initialiseEditor({ questionnaireLocal: questionnaire });
    // (loaded as an undo state, so there is one to undo back to)
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, false, true);
  }, { mapping: FIELD_MAPPING, definition: CARRIER_DEFINITION, withMappedDefault: mappedDefault });
  return errors;
}

const addSister = (page, personID) => page.evaluate((id) => document.dispatchEvent(new CustomEvent('pedigree:person:newsibling',
  { detail: { personID: id, childParams: { gender: 'F' } } })), personID);
const people = (page) => page.evaluate(() => Object.values(window.editor.getView().getNodeMap())
  .filter((n) => n.getType && n.getType() === 'Person').map((n) => n.getID()).sort((a, b) => a - b));
const answer = (page, id, linkId) => page.evaluate(([nodeID, l]) => window.editor.getView().getNode(nodeID).getQuestionnaireAnswer(l), [id, linkId]);
const undo = (page) => page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
const redo = (page) => page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:redo')));

// The node form for a person: its drop-down for an item (the shown option's text, or '' for none).
async function shownOption(page, id, linkId) {
  return page.evaluate(([nodeID, l]) => {
    window.editor.getNodeMenu().show(window.editor.getView().getNode(nodeID), 100, 100);
    const select = document.querySelector(`.menu-box .field-${l} select`);
    return select.selectedIndex < 0 ? '' : select.options[select.selectedIndex].textContent;
  }, [id, linkId]);
}

// An answer's code(s): a choice's answer may be the code or a coding.
const codeOf = (value) => (Array.isArray(value) ? value.map(codeOf)
  : (value && typeof value === 'object' ? value.code : value));

test('a person added in the editor gets the marked defaults; a loaded person does not', async ({ page }) => {
  const errors = await loadEditor(page);
  const [proband] = await people(page);
  expect(await answer(page, proband, 'shade')).toBeUndefined();
  expect(await shownOption(page, proband, 'shade')).toBe('-');

  await addSister(page, proband);
  // The sister, and the parents made for her: every person added gets the defaults.
  const added = (await people(page)).filter((id) => id !== proband);
  expect(added.length).toBeGreaterThan(0);
  for (const id of added) {
    expect(codeOf(await answer(page, id, 'shade')), `person ${id}`).toBe('dark');
    expect(codeOf(await answer(page, id, 'tags')), `person ${id}`).toEqual(['a', 'c']);
    expect(await shownOption(page, id, 'shade')).toBe('Dark');
  }
  // The proband, loaded before, still has no answer.
  expect(await answer(page, proband, 'shade')).toBeUndefined();

  // Undo takes the new people away, defaults and all; redo brings them back with them.
  await undo(page);
  expect(await people(page)).toEqual([proband]);
  await redo(page);
  for (const id of added) {
    expect(codeOf(await answer(page, id, 'shade'))).toBe('dark');
  }
  expect(errors).toEqual([]);
});

test('the defaults are in the saved pedigree', async ({ page }) => {
  await loadEditor(page);
  const [proband] = await people(page);
  await addSister(page, proband);
  // The editor's own saved form (what a save writes, and undo restores).
  const saved = await page.evaluate(() => window.editor.getGraph().toJSON());
  expect(saved).toContain('"dark"');
});

test('a mapped drop-down whose value matches no option shows none, and its first option can be chosen', async ({ page }) => {
  const errors = await loadEditor(page);
  const [proband] = await people(page);
  // Carrier status is '' (not affected), which this drop-down has no option for.
  expect(await shownOption(page, proband, 'carrier_select')).toBe('');
  await page.evaluate(() => {
    const select = document.querySelector('.menu-box .field-carrier_select select');
    select.value = 'carrier';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(await page.evaluate((id) => window.editor.getView().getNode(id).getCarrierStatus(), proband)).toBe('carrier');
  expect(errors).toEqual([]);
});

test('a mapped drop-down\'s default is set on a person added in the editor', async ({ page }) => {
  await loadEditor(page, { mappedDefault: true });
  const [proband] = await people(page);
  expect(await page.evaluate((id) => window.editor.getView().getNode(id).getCarrierStatus(), proband)).toBe('');
  // The loaded proband isn't a carrier: the default isn't shown as their answer.
  expect(await shownOption(page, proband, 'carrier_select')).toBe('');
  await addSister(page, proband);
  const added = (await people(page)).filter((id) => id !== proband);
  for (const id of added) {
    expect(await page.evaluate((nodeID) => window.editor.getView().getNode(nodeID).getCarrierStatus(), id)).toBe('carrier');
  }
});

test('heredity shows None for a person with no status, in the default form', async ({ page }) => {
  await loadEditor(page);
  const [proband] = await people(page);
  expect(await page.evaluate((id) => window.editor.getView().getNode(id).getChildlessStatus(), proband)).toBeNull();
  expect(await shownOption(page, proband, 'childlessSelect')).toBe('None');
  // wherever "None" is in the list
  expect(await shownOption(page, proband, 'heredity_codes')).toBe('No');
});

test('a pedigree started from a template gets the defaults, in its undo step too', async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => window.editor.getTemplateSelector().show());
  const box = page.locator('.pedigree-template-chooser .picture-box:visible').first();
  await expect(box).toBeVisible({ timeout: 10000 });
  await expect.poll(() => box.evaluate((el) => !!el.pedigreeData), { timeout: 10000 }).toBe(true);
  await box.evaluate((el) => el.click()); // (the page's own startup chooser lies over it)
  const ids = await people(page);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    expect(codeOf(await answer(page, id, 'shade')), `person ${id}`).toBe('dark');
  }
  // The template's undo step has every person's default.
  const stepShades = await page.evaluate(() => {
    const state = JSON.parse(window.editor.getActionStack()._getCurrentState().serializedState);
    return state.GG.filter((n) => !n.rel && !n.chhub && n.prop && n.prop.gender !== undefined)
      .map((n) => ((n.prop.questionnaireAnswers || {}).shade || {}).code);
  });
  expect(stepShades.length).toBe(ids.length);
  expect(stepShades.every((code) => code === 'dark')).toBe(true);
});

test('Clear leaves the kept proband\'s answers alone, defaults or not', async ({ page }) => {
  await loadEditor(page, { mappedDefault: true });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:graph:clear')));
  const [proband] = await people(page);
  expect(await answer(page, proband, 'shade')).toBeUndefined();
  expect(await page.evaluate((id) => window.editor.getView().getNode(id).getCarrierStatus(), proband)).toBe('');
});
