import { test, expect } from '@playwright/test';

const CUSTOM_LEGEND_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-custom-legend-test',
  version: '1.0',
  item: [
    {
      linkId: 'custom_tab', type: 'group', text: 'Custom',
      item: [
        {
          linkId: 'comorbidities', type: 'choice', text: 'Comorbidities', repeats: true,
          answerValueSet: 'http://example.org/ValueSet/comorbidities',
          extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: 'mapsToLegendCondition' }],
        },
      ],
    },
  ],
};

const SAME_LABEL_TABS_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-same-label-tabs-test',
  version: '1.0',
  item: [
    { linkId: 'group_one', type: 'group', text: 'Details', item: [{ linkId: 'field_one', type: 'string', text: 'Field One' }] },
    { linkId: 'group_two', type: 'group', text: 'Details', item: [{ linkId: 'field_two', type: 'string', text: 'Field Two' }] },
  ],
};

const MINIMAL_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-minimal-test',
  version: '1.0',
  item: [
    { linkId: 'only_tab', type: 'group', text: 'Only', item: [{ linkId: 'only_field', type: 'string', text: 'Only Field' }] },
  ],
};

async function loadEditorWithQuestionnaire(page, questionnaire, options = {}) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await page.evaluate(({ q, opts }) => {
    // See questionnaire-fields.spec.js for why #work-area (not just #canvas) needs removing:
    // the initial page-load editor's menu-box lives outside #canvas and would otherwise leak
    // stale fields into this test's own DOM queries.
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

test('a legend-backed custom item shows a colour swatch in the node menu (surviving a re-render) and updates the canvas colour list', async ({ page }) => {
  await page.route('**/ValueSet/$expand**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        resourceType: 'ValueSet',
        expansion: { contains: [{ system: 'http://example.org/codes', code: 'htn', display: 'Hypertension' }] },
      }),
    });
  });

  await loadEditorWithQuestionnaire(page, CUSTOM_LEGEND_QUESTIONNAIRE, { terminologyBaseUrl: 'http://example.org/fhir' });
  const personId = await openNodeMenuForProband(page);

  await expect(page.locator('.field-comorbidities select.suggest-questionnaire-legend')).toBeAttached();

  await page.evaluate(() => {
    // setValue(..., false) [not silent] triggers Selectize's own onChange, which already
    // dispatches 'xwiki:customchange' itself (see _createQuestionnaireLegendSuggest) - matching
    // what a real click fires exactly once. An extra manual dispatch here would double-fire it.
    const select = document.querySelector('.field-comorbidities select.suggest-questionnaire-legend');
    select.selectize.addOption({ text: 'Hypertension', value: 'htn', system: 'http://example.org/codes' });
    select.selectize.setValue('htn', false);
  });
  await page.waitForTimeout(200);

  // A swatch bubble appears next to the selected term immediately (live colour-assignment event).
  await expect(page.locator('.field-comorbidities .item[data-value="htn"] .disorder-color')).toBeAttached();

  // Close and reopen the menu - Selectize rebuilds its .item chips from scratch on every
  // setValue(), so the swatch must be re-applied on every render, not just on first assignment.
  await page.evaluate(() => window.editor.getNodeMenu().hide());
  await openNodeMenuForProband(page);
  await expect(page.locator('.field-comorbidities .item[data-value="htn"] .disorder-color')).toBeAttached();

  const answer = await page.evaluate((id) => {
    return window.editor.getView().getNode(parseInt(id, 10)).getQuestionnaireAnswer('comorbidities');
  }, personId);
  expect(answer).toEqual([{ system: 'http://example.org/codes', code: 'htn', display: 'Hypertension' }]);

  // The node's colour list (which drives the canvas SVG shapes via updateDisorderShapes) picks
  // up the new term too.
  const colors = await page.evaluate((id) => {
    return window.editor.getView().getNode(parseInt(id, 10)).getAllNodeColors();
  }, personId);
  expect(colors.length).toBe(1);
  expect(colors[0]).toMatch(/^#/);
});

test('the disorders field shows a colour swatch for a selected disorder', async ({ page }) => {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({});
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const id = Object.keys(map).find(k => map[k].getType && map[k].getType() === 'Person');
    window.editor.getNodeMenu().show(map[id], 100, 100);
  });

  await page.evaluate(() => {
    // See the comorbidities test above for why there's no explicit dispatchEvent here.
    const select = document.querySelector('.field-disorders select.suggest-questionnaire-legend');
    select.selectize.addOption({ text: 'Diabetes', value: '73211009' });
    select.selectize.setValue('73211009', false);
  });
  await page.waitForTimeout(200);

  await expect(page.locator('.field-disorders .item[data-value="73211009"] .disorder-color')).toBeAttached();
});

test('a per-option predicate greys out specific radio options while leaving others selectable', async ({ page }) => {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const newEditor = window.OpenPedigree.initialiseEditor({});
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(300);

  const personId = await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const id = Object.keys(map).find(k => map[k].getType && map[k].getType() === 'Person');
    // carrierAvailability disables 'presymptomatic' once life status is aborted/miscarriage.
    map[id].setLifeStatus('aborted');
    window.editor.getNodeMenu().show(map[id], 100, 100);
    return id;
  });
  await page.waitForTimeout(200);

  const presymptomaticDisabled = await page.evaluate(() =>
    document.querySelector('.field-carrier input[value="presymptomatic"]').disabled
  );
  const carrierDisabled = await page.evaluate(() =>
    document.querySelector('.field-carrier input[value="carrier"]').disabled
  );
  expect(presymptomaticDisabled).toBe(true);
  expect(carrierDisabled).toBe(false);
  void personId;
});

test('two top-level groups sharing a display label render as independent tabs with their own fields', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, SAME_LABEL_TABS_QUESTIONNAIRE);
  await openNodeMenuForProband(page);

  await expect(page.locator('#tab_group_one')).toBeAttached();
  await expect(page.locator('#tab_group_two')).toBeAttached();
  await expect(page.locator('.field-field_one')).toBeAttached();
  await expect(page.locator('.field-field_two')).toBeAttached();

  const tabLabels = await page.locator('.menu-box .tabs dd a').allTextContents();
  expect(tabLabels).toEqual(['Details', 'Details']);
});

// generateNodeGroupMenu() (an unrelated, unmodified menu for PersonGroup nodes) has its own
// hardcoded 'comments'/'disorders' fields, always present (hidden) in the DOM regardless of
// Questionnaire config - scope queries to the currently-VISIBLE menu box (the one just shown
// via .show()) to avoid colliding with it.
const VISIBLE_MENU = '.menu-box:visible';

test('an implementer Questionnaire fully replaces the built-in default - fields it omits are absent', async ({ page }) => {
  await loadEditorWithQuestionnaire(page, MINIMAL_QUESTIONNAIRE);
  await openNodeMenuForProband(page);

  await expect(page.locator(`${VISIBLE_MENU} .field-only_field`)).toBeAttached();
  // None of the built-in default's fields (comments, disorders, evaluated, ...) should exist.
  await expect(page.locator(`${VISIBLE_MENU} .field-comments`)).toHaveCount(0);
  await expect(page.locator(`${VISIBLE_MENU} .field-disorders`)).toHaveCount(0);
  await expect(page.locator(`${VISIBLE_MENU} .field-evaluated`)).toHaveCount(0);
});

test('questionnaireUrl fetch success rebuilds the entire node menu from the fetched Questionnaire', async ({ page }) => {
  await page.route('**/fhir/Questionnaire/remote-demo', async (route) => {
    // A small artificial delay so the "default Questionnaire in effect until the fetch
    // resolves" intermediate state below is reliably observable, not a race.
    await new Promise((resolve) => setTimeout(resolve, 300));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MINIMAL_QUESTIONNAIRE) });
  });
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const newEditor = window.OpenPedigree.initialiseEditor({ questionnaireUrl: 'http://example.org/fhir/Questionnaire/remote-demo' });
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  });

  // Immediately after construction (before the fetch resolves) the built-in default is in effect.
  await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const id = Object.keys(map).find(k => map[k].getType && map[k].getType() === 'Person');
    window.editor.getNodeMenu().show(map[id], 100, 100);
  });
  await expect(page.locator(`${VISIBLE_MENU} .field-comments`)).toBeAttached();

  // Once the fetch resolves, the entire menu is rebuilt from the fetched Questionnaire.
  await expect(async () => {
    const map = await page.evaluate(() => Object.keys(window.editor.getView().getNodeMap())[0]);
    await page.evaluate((id) => {
      window.editor.getNodeMenu().show(window.editor.getView().getNode(parseInt(id, 10)), 100, 100);
    }, map);
    await expect(page.locator(`${VISIBLE_MENU} .field-only_field`)).toBeAttached({ timeout: 500 });
  }).toPass({ timeout: 10000 });
  await expect(page.locator(`${VISIBLE_MENU} .field-comments`)).toHaveCount(0);
});

test('questionnaireUrl fetch failure falls back to the built-in default Questionnaire', async ({ page }) => {
  await page.route('**/fhir/Questionnaire/broken-demo', (route) => {
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  page.on('dialog', dialog => dialog.dismiss());
  const consoleWarnings = [];
  page.on('console', msg => { if (msg.type() === 'warning') consoleWarnings.push(msg.text()); });
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const newEditor = window.OpenPedigree.initialiseEditor({ questionnaireUrl: 'http://example.org/fhir/Questionnaire/broken-demo' });
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const id = Object.keys(map).find(k => map[k].getType && map[k].getType() === 'Person');
    window.editor.getNodeMenu().show(map[id], 100, 100);
  });
  await expect(page.locator(`${VISIBLE_MENU} .field-comments`)).toBeAttached();
});

test('a graph-state predicate (isFetus) toggles field visibility live as life status changes, without reopening the menu', async ({ page }) => {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const newEditor = window.OpenPedigree.initialiseEditor({});
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const id = Object.keys(map).find(k => map[k].getType && map[k].getType() === 'Person');
    window.editor.getNodeMenu().show(map[id], 100, 100);
  });

  await expect(page.locator('.field-date_of_birth')).not.toHaveClass(/hidden/);

  await page.evaluate(() => {
    const radio = document.querySelector('.field-state input[value="unborn"]');
    radio.checked = true;
    radio.dispatchEvent(new Event('click'));
  });
  await page.waitForTimeout(200);

  await expect(page.locator('.field-date_of_birth')).toHaveClass(/hidden/);
});
