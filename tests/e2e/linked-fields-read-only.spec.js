import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// A linked-record item (questionnaire-linked-record-source) is always read-only - its value comes
// from the linked record (record-link-provider design D5). Every kind of field the node menu
// draws must honour that, not just text/number/checkbox; and the same kind of field, not linked,
// stays editable.

const LINKED = { url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' };
const LEGEND = (kind) => ({ url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: kind });
const RADIO = {
  url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',
  valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] },
};
const OPTIONS = [{ valueCoding: { code: 'a', display: 'A' } }, { valueCoding: { code: 'b', display: 'B' } }];

// One of each, `linked` or not.
function items(prefix, linked) {
  const ext = (...e) => (linked ? [...e, LINKED] : e);
  return [
    { linkId: `${prefix}_string`, type: 'string', text: 'String', extension: ext() },
    { linkId: `${prefix}_text`, type: 'text', text: 'Text', extension: ext() },
    { linkId: `${prefix}_date`, type: 'date', text: 'Date', extension: ext() },
    { linkId: `${prefix}_integer`, type: 'integer', text: 'Integer', extension: ext() },
    { linkId: `${prefix}_boolean`, type: 'boolean', text: 'Boolean', extension: ext() },
    { linkId: `${prefix}_select`, type: 'choice', text: 'Select', answerOption: OPTIONS, extension: ext() },
    { linkId: `${prefix}_radio`, type: 'choice', text: 'Radio', answerOption: OPTIONS, extension: ext(RADIO) },
    { linkId: `${prefix}_picker`, type: 'choice', text: 'Picker', answerValueSet: 'http://example.org/vs', extension: ext() },
    { linkId: `${prefix}_legend`, type: 'choice', text: 'Legend', repeats: true, answerValueSet: 'http://example.org/vs',
      extension: ext(LEGEND('mapsToLegendCondition')) },
  ];
}

const QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-linked-read-only',
  version: '1.0',
  item: [
    { linkId: 'linked_group', type: 'group', text: 'Linked', item: [
      ...items('linked', true),
      // a reserved legend
      { linkId: 'disorders', type: 'choice', text: 'Disorders', repeats: true, answerValueSet: 'http://purl.bioontology.org/ontology/OMIM',
        extension: [LEGEND('mapsToLegendCondition'), LINKED] },
    ] },
    { linkId: 'editable_group', type: 'group', text: 'Editable', item: items('editable', false) },
  ],
};

async function openMenu(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate((q) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const editor = window.OpenPedigree.initialiseEditor({ questionnaireLocal: q, questionnaireTerminologyBaseUrl: 'http://example.org/fhir' });
    window.editor = editor;
    editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  }, QUESTIONNAIRE);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const id = Object.keys(map).find((k) => map[k].getType && map[k].getType() === 'Person');
    window.editor.getNodeMenu().show(map[id], 100, 100);
  });
}

// Whether each field's inputs are disabled: the input itself, or the selectize widget over a select.
function readState(page, prefix) {
  return page.evaluate((p) => {
    const menu = Array.from(document.querySelectorAll('.menu-box')).find((el) => getComputedStyle(el).display !== 'none');
    const state = {};
    menu.querySelectorAll(`.field-box[class*="field-${p}"]`).forEach((box) => {
      const name = Array.from(box.classList).find((c) => c.startsWith(`field-${p}`)).slice('field-'.length);
      const select = box.querySelector('select');
      if (select && select.selectize) {
        state[name] = select.selectize.isDisabled;
      } else {
        const inputs = Array.from(box.querySelectorAll('input:not([type=hidden]), select, textarea'));
        state[name] = inputs.length > 0 && inputs.every((i) => i.disabled);
      }
    });
    return state;
  }, prefix);
}

const KINDS = ['string', 'text', 'date', 'integer', 'boolean', 'select', 'radio', 'picker', 'legend'];

test('every kind of linked field is read-only, and the same kind not linked is editable', async ({ page }) => {
  await openMenu(page);
  const linked = await readState(page, 'linked_');
  expect(Object.keys(linked).sort()).toEqual(KINDS.map((k) => `linked_${k}`).sort());
  for (const kind of KINDS) {
    expect(linked[`linked_${kind}`], kind).toBe(true);
  }
  const editable = await readState(page, 'editable_');
  expect(Object.keys(editable).sort()).toEqual(KINDS.map((k) => `editable_${k}`).sort());
  for (const kind of KINDS) {
    expect(editable[`editable_${kind}`], kind).toBe(false);
  }
});

test('a linked reserved legend is read-only, and a linked radio stays visible', async ({ page }) => {
  await openMenu(page);
  expect((await readState(page, 'disorders')).disorders).toBe(true);
  // A disabled radio used to be hidden altogether.
  await expect(page.locator('.menu-box:visible .field-linked_radio')).not.toHaveClass(/\bhidden\b/);
});
