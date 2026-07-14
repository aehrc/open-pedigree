import { test, expect } from '@playwright/test';
import fs from 'fs';

// Every fixture's items are wrapped in a top-level group - under the questionnaire-source-of-truth
// model, a top-level group becomes a node-menu tab (keyed by linkId, labelled by text); a
// non-group top-level item is placed on an implicit "General" tab with a logged warning, so a
// realistic Questionnaire always wraps its items like this.
const BASIC_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-test',
  version: '1.0',
  item: [
    {
      linkId: 'custom_tab', type: 'group', text: 'Custom',
      item: [
        { linkId: 'notes', type: 'string', text: 'Notes' },
        { linkId: 'smoker', type: 'boolean', text: 'Smoker?' },
        {
          linkId: 'severity', type: 'integer', text: 'Severity',
          enableWhen: [{ question: 'smoker', operator: '=', answerBoolean: true }],
        },
      ],
    },
  ],
};

const MAPPED_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-mapping-test',
  version: '1.0',
  item: [
    {
      linkId: 'custom_tab', type: 'group', text: 'Custom',
      item: [
        {
          linkId: 'evaluated',
          type: 'boolean',
          text: 'Documented evaluation',
          definition: 'https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.evaluated',
          extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: 'mapsToField' }],
        },
      ],
    },
  ],
};

const CHOICE_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-choice-test',
  version: '1.0',
  item: [
    {
      linkId: 'custom_tab', type: 'group', text: 'Custom',
      item: [
        { linkId: 'diagnosis', type: 'choice', text: 'Diagnosis', answerValueSet: 'http://example.org/ValueSet/diagnoses' },
      ],
    },
  ],
};

async function loadEditorWithQuestionnaire(page, questionnaire, options = {}) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await page.evaluate(({ q, opts }) => {
    // The initial page load's PedigreeEditor (built from the now-always-present default
    // Questionnaire) creates its own #work-area/#canvas/.menu-box - remove it entirely rather
    // than just clearing #canvas's innerHTML, so its menu-box (which lives outside #canvas,
    // as a work-area sibling) doesn't leak stale fields into this test's own DOM queries.
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
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

  await expect(page.locator('#tab_custom_tab')).toBeAttached();
  await expect(page.locator('.field-notes')).toBeAttached();
  await expect(page.locator('.field-smoker')).toBeAttached();
  await expect(page.locator('.field-severity')).toBeAttached();
});

test('editing a Custom-tab field persists across save/reload (internal JSON)', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, BASIC_QUESTIONNAIRE);
  const personId = await openNodeMenuForProband(page);

  await page.evaluate(() => {
    const input = document.querySelector('.field-notes input[type=text]');
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

  await expect(page.locator('.field-severity')).toHaveClass(/hidden/);

  await page.evaluate(() => {
    const checkbox = document.querySelector('.field-smoker input[type=checkbox]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('click'));
  });
  await page.waitForTimeout(200);

  await expect(page.locator('.field-severity')).not.toHaveClass(/hidden/);
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

  await expect(page.locator('.field-diagnosis select.suggest-questionnaire')).toBeAttached();

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
    // setValue(..., false) [not silent] already triggers Selectize's own onChange, which
    // dispatches 'xwiki:customchange' itself (see _createQuestionnaireSuggest) - matching what
    // a real click fires exactly once. An extra manual dispatch here would double-fire it.
    const select = document.querySelector('.field-diagnosis select.suggest-questionnaire');
    select.selectize.addOption({ text: 'Influenza', value: 'flu', system: 'http://example.org/codes' });
    select.selectize.setValue('flu', false);
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

test('a mapsToField-mapped item renders normally and dispatches through the real setter', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, MAPPED_QUESTIONNAIRE);
  const personId = await openNodeMenuForProband(page);

  // Now that the Questionnaire is the only source of the form, a mapsToField item renders
  // exactly like any other field (there's no separate hardcoded field left for it to
  // duplicate) - it just dispatches through the existing real setEvaluated/getEvaluated
  // instead of a generic per-linkId answer store.
  await expect(page.locator('.field-evaluated')).toBeAttached();

  await page.evaluate(() => {
    const checkbox = document.querySelector('.field-evaluated input[type=checkbox]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('click'));
  });
  await page.waitForTimeout(200);

  const evaluated = await page.evaluate((id) => {
    return window.editor.getView().getNode(parseInt(id, 10)).getEvaluated();
  }, personId);
  expect(evaluated).toBe(true);
  const answers = await page.evaluate((id) => {
    return window.editor.getView().getNode(parseInt(id, 10)).getQuestionnaireAnswers();
  }, personId);
  expect(answers.evaluated).toBeUndefined();
});
