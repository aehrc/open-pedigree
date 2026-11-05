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
          // shown only with the gate's default answer (the gate comes after it), and a default of its own
          { linkId: 'gated', type: 'choice', text: 'Gated',
            enableWhen: [{ question: 'gate', operator: '=', answerCoding: { code: 'yes' } }],
            answerOption: [option('g1', 'G1', true), option('g2', 'G2')] },
          { linkId: 'gate', type: 'choice', text: 'Gate', answerOption: [option('yes', 'Yes', true), option('no', 'No')] },
          // and the other way round: the gate first
          { linkId: 'gate2', type: 'choice', text: 'Gate 2', answerOption: [option('yes', 'Yes', true), option('no', 'No')] },
          { linkId: 'gated2', type: 'choice', text: 'Gated 2',
            enableWhen: [{ question: 'gate2', operator: '=', answerCoding: { code: 'yes' } }],
            answerOption: [option('h1', 'H1', true), option('h2', 'H2')] },
          { linkId: 'tags', type: 'choice', text: 'Tags', repeats: true,
            answerOption: [option('a', 'A', true), option('b', 'B'), option('c', 'C', true)] },
          // heredity as a REDCap drop-down codes it (the module's README: anything but childless or
          // infertile is cleared), its "None" last
          { linkId: 'heredity_codes', type: 'choice', text: 'Heredity (codes)',
            definition: 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/PedigreeIndividual#PedigreeIndividual.childlessStatus',
            extension: [{ url: mapping, valueCode: 'mapsToField' }],
            answerOption: [option('childless', 'Childless'), option('infertile', 'Infertile'), option('0', 'No')] },
          // "none" wins over another blank code; a numbered list (against the README) shows nothing
          { linkId: 'heredity_both', type: 'choice', text: 'Heredity (both)',
            definition: 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/PedigreeIndividual#PedigreeIndividual.childlessStatus',
            extension: [{ url: mapping, valueCode: 'mapsToField' }],
            answerOption: [option('childless', 'Childless'), option('0', 'No'), option('none', 'None')] },
          { linkId: 'heredity_radio', type: 'choice', text: 'Heredity (radio)',
            definition: 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/PedigreeIndividual#PedigreeIndividual.childlessStatus',
            extension: [{ url: mapping, valueCode: 'mapsToField' },
              { url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl', valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] } }],
            answerOption: [option('childless', 'Childless'), option('infertile', 'Infertile'), option('0', 'No')] },
          // shown only for a fetus, with a default
          { linkId: 'fetal_note', type: 'choice', text: 'Fetal note',
            enableWhen: [{ extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-enable-predicate', valueCode: 'isFetus' }] }],
            answerOption: [option('p', 'P', true), option('q', 'Q')] },
          { linkId: 'heredity_numbered', type: 'choice', text: 'Heredity (numbered)',
            definition: 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/PedigreeIndividual#PedigreeIndividual.childlessStatus',
            extension: [{ url: mapping, valueCode: 'mapsToField' }],
            answerOption: [option('1', 'Childless'), option('2', 'Infertile'), option('0', 'None')] },
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
    // not an item hidden for them (fetus-only)
    expect(await answer(page, id, 'fetal_note'), `person ${id}`).toBeUndefined();
    // but one shown by another item's default
    expect(codeOf(await answer(page, id, 'gated')), `person ${id}`).toBe('g1');
    expect(codeOf(await answer(page, id, 'gated2')), `person ${id}`).toBe('h1');
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
  // and REDCap's own code for it, wherever it is in the list
  expect(await shownOption(page, proband, 'heredity_codes')).toBe('No');
  expect(await shownOption(page, proband, 'heredity_both')).toBe('None');
  expect(await shownOption(page, proband, 'heredity_numbered')).toBe('');
  // and as radio buttons
  expect(await page.evaluate(() => [...document.querySelectorAll('.menu-box .field-heredity_radio input[type=radio]')]
    .filter((r) => r.checked).map((r) => r.value))).toEqual(['0']);
});

test('a relationship\'s heredity shows None when it has no status', async ({ page }) => {
  await loadEditor(page);
  const [proband] = await people(page);
  await addSister(page, proband);
  const shown = await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const partnership = Object.values(map).find((n) => n.getType && n.getType() === 'Partnership');
    window.editor.getPartnershipMenu().show(partnership, 100, 100);
    const select = document.querySelector('.menu-box .field-childlessSelect select:not([disabled])')
      || [...document.querySelectorAll('.field-childlessSelect select')].find((s) => s.offsetParent !== null);
    return select.selectedIndex < 0 ? '' : select.options[select.selectedIndex].textContent;
  });
  expect(shown).toBe('None');
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
  // an answer given before Clear stays; a blank stays blank
  await page.evaluate(() => window.editor.getView().getNode(0).setQuestionnaireAnswer('tags', [{ code: 'b', display: 'B' }]));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:graph:clear')));
  const [proband] = await people(page);
  expect(codeOf(await answer(page, proband, 'tags'))).toEqual(['b']);
  expect(await answer(page, proband, 'shade')).toBeUndefined();
  expect(await page.evaluate((id) => window.editor.getView().getNode(id).getCarrierStatus(), proband)).toBe('');
});
