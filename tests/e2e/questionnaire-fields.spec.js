import { test, expect } from '@playwright/test';
import fs from 'fs';

const BASIC_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-test',
  version: '1.0',
  item: [
    { linkId: 'notes', type: 'string', text: 'Notes' },
    { linkId: 'smoker', type: 'boolean', text: 'Smoker?' },
    {
      linkId: 'severity', type: 'integer', text: 'Severity',
      enableWhen: [{ question: 'smoker', operator: '=', answerBoolean: true }],
    },
  ],
};

const MAPPED_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-mapping-test',
  version: '1.0',
  item: [
    {
      linkId: 'carrier',
      type: 'boolean',
      text: 'Carrier',
      definition: 'https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.carrierStatus',
      extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: 'mapsToField' }],
    },
  ],
};

const CHOICE_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-choice-test',
  version: '1.0',
  item: [
    { linkId: 'diagnosis', type: 'choice', text: 'Diagnosis', answerValueSet: 'http://example.org/ValueSet/diagnoses' },
  ],
};

async function loadEditorWithQuestionnaire(page, questionnaire, options = {}) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await page.evaluate(({ q, opts }) => {
    document.getElementById('canvas').innerHTML = '';
    const newEditor = window.OpenPedigree.initialiseEditor({ questionnaireLocal: q, questionnaireTerminologyBaseUrl: opts.terminologyBaseUrl });
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  }, { q: questionnaire, opts: options });
  await page.waitForTimeout(300);
}

async function openNodeMenuForProband(page) {
  return page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const personId = Object.keys(map).find(id => map[id].getType && map[id].getType() === 'Person');
    const node = map[personId];
    window.editor.getNodeMenu().show(node, 100, 100);
    return personId;
  });
}

test('Custom tab appears with questionnaireLocal and renders expected fields', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, BASIC_QUESTIONNAIRE);
  await openNodeMenuForProband(page);

  await expect(page.locator('#tab_Custom')).toBeAttached();
  await expect(page.locator('.field-q_notes')).toBeAttached();
  await expect(page.locator('.field-q_smoker')).toBeAttached();
  await expect(page.locator('.field-q_severity')).toBeAttached();
});

test('editing a Custom-tab field persists across save/reload (internal JSON)', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, BASIC_QUESTIONNAIRE);
  const personId = await openNodeMenuForProband(page);

  await page.evaluate(() => {
    const input = document.querySelector('.field-q_notes input[type=text]');
    input.value = 'a clinical note';
    input.dispatchEvent(new KeyboardEvent('keyup'));
  });
  await page.waitForTimeout(200);

  const json = await page.evaluate(() => window.editor.getGraph().toJSON());
  expect(json).toContain('a clinical note');

  // reload the saved JSON into a fresh graph and confirm the answer survives
  const reloadedAnswer = await page.evaluate(({ savedJson, id }) => {
    window.editor.getSaveLoadEngine().createGraphFromImportData(savedJson, 'phenotips', {}, true, true);
    const node = window.editor.getView().getNode(parseInt(id, 10));
    return node.getQuestionnaireAnswer('notes');
  }, { savedJson: json, id: personId });
  expect(reloadedAnswer).toBe('a clinical note');
});

test('enableWhen-gated field toggles visibility live as its referenced field changes', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, BASIC_QUESTIONNAIRE);
  await openNodeMenuForProband(page);

  await expect(page.locator('.field-q_severity')).toHaveClass(/hidden/);

  await page.evaluate(() => {
    const checkbox = document.querySelector('.field-q_smoker input[type=checkbox]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('click'));
  });
  await page.waitForTimeout(200);

  await expect(page.locator('.field-q_severity')).not.toHaveClass(/hidden/);
});

test('answerValueSet choice field searches the configured terminology server and stores the coding', async ({ page }) => {
  await page.route('**/ValueSet/$expand**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        resourceType: 'ValueSet',
        expansion: { contains: [{ system: 'http://example.org/codes', code: 'flu', display: 'Influenza' }] },
      }),
    });
  });

  await loadEditorWithQuestionnaire(page, CHOICE_QUESTIONNAIRE, { terminologyBaseUrl: 'http://example.org/fhir' });
  const personId = await openNodeMenuForProband(page);

  await expect(page.locator('.field-q_diagnosis select.suggest-questionnaire')).toBeAttached();

  // Exercise the actual search path (confirms the terminology instance hits the configured
  // FHIR ValueSet/$expand endpoint), then simulate the user picking the returned result.
  const searchResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      window.editor.getQuestionnaireTerminology('diagnosis').searchForTerms(
        'flu',
        (search, result) => resolve(result),
        () => resolve(null)
      );
    });
  });
  expect(searchResult).toEqual([{ text: 'Influenza', value: 'flu', system: 'http://example.org/codes' }]);

  await page.evaluate(() => {
    const select = document.querySelector('.field-q_diagnosis select.suggest-questionnaire');
    select.selectize.addOption({ text: 'Influenza', value: 'flu', system: 'http://example.org/codes' });
    select.selectize.setValue('flu', false);
    select.dispatchEvent(new CustomEvent('xwiki:customchange'));
  });
  await page.waitForTimeout(200);
  const finalAnswer = await page.evaluate((id) => {
    const node = window.editor.getView().getNode(parseInt(id, 10));
    return node.getQuestionnaireAnswer('diagnosis');
  }, personId);
  expect(finalAnswer).toEqual({ system: 'http://example.org/codes', code: 'flu', display: 'Influenza' });
});

test('GA4GH FHIR export contains a QuestionnaireResponse section for an answered node', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, BASIC_QUESTIONNAIRE);
  const personId = await openNodeMenuForProband(page);

  await page.evaluate((id) => {
    const node = window.editor.getView().getNode(parseInt(id, 10));
    node.setQuestionnaireAnswer('notes', 'exported note');
    window.editor.getGraph().setProperties(parseInt(id, 10), node.getProperties());
  }, personId);

  // Use the export selector's own path: trigger the GA4GH export and capture the download content
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.evaluate(() => {
      window.editor.getExportSelector().show();
    }).then(() => page.evaluate(() => {
      const ga4ghRadio = document.querySelector('input[type=radio][name="export-type"][value="GA4GH"]');
      ga4ghRadio.checked = true;
      ga4ghRadio.click();
      document.getElementById('export_button').click();
    })),
  ]);

  const path = await download.path();
  const content = fs.readFileSync(path, 'utf-8');
  expect(content).toContain('QuestionnaireResponse');
  expect(content).toContain('exported note');
});

test('a mapsToField-mapped item does not appear on the Custom tab', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, MAPPED_QUESTIONNAIRE);
  await openNodeMenuForProband(page);

  await expect(page.locator('.field-q_carrier')).toHaveCount(0);
});
