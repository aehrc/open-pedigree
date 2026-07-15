import { test, expect } from '@playwright/test';

// Covers generalize-patient-provider-import: importClinicalData's onImported callback now
// receives an array of {linkId, value} entries (instead of an always-disorders list) and
// dispatches each through the same per-linkId setter resolution generateNodeMenu() already
// computes - a reserved legend target (merge-by-id), a mapsToField target (overwrite), or a
// plain unmapped item's generic setter (overwrite).

const EXTRA_CUSTOM_ITEM = {
  linkId: 'custom_note', type: 'string', text: 'Custom note',
};

async function loadEditorWithFakeProvider(page) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await page.evaluate(({ extraItem }) => {
    // See tests/e2e/questionnaire-fields.spec.js for why the initial page load's work-area is
    // removed before building a fresh editor for the test.
    document.querySelectorAll('#work-area').forEach((el) => el.remove());

    const base = window.OpenPedigree.defaultQuestionnaire;
    const questionnaire = { ...base, item: [...base.item, extraItem] };

    const fakeProvider = {
      isConfigured: () => true,
      canImportClinicalData: () => true,
      canLinkProband: () => true,
      canSearchFamilyMembers: () => true,
      lookupPatient: (_ref, onSuccess) => onSuccess('Test Person'),
      openPatientPickerModal: () => {},
      openClinicalImportModal: (_nodeId, _patientRef, onImported) => {
        window.__pendingImportAnswers && onImported(window.__pendingImportAnswers);
      },
    };

    const newEditor = window.OpenPedigree.initialiseEditor({ questionnaireLocal: questionnaire, patientProvider: fakeProvider });
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  }, { extraItem: EXTRA_CUSTOM_ITEM });
  await page.waitForTimeout(300);
}

function getProbandId(page) {
  return page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    return Object.keys(map).find(id => map[id].getType && map[id].getType() === 'Person');
  });
}

async function triggerImport(page, personId, answers) {
  return page.evaluate(({ personId, answers }) => {
    const node = window.editor.getView().getNode(personId);
    node.setLinkedPatientRef('Patient/42');
    window.__pendingImportAnswers = answers;
    window.editor._questionnaireActions.importClinicalData({ targetNode: node });
  }, { personId, answers });
}

test('importing a mapsToField-mapped answer overwrites the real property', async ({ page }) => {
  await loadEditorWithFakeProvider(page);
  const personId = await getProbandId(page);

  await triggerImport(page, personId, [{ linkId: 'gender', value: 'F' }]);

  const gender = await page.evaluate((personId) => window.editor.getView().getNode(personId).getGender(), personId);
  expect(gender).toBe('F');
});

test('importing a plain unmapped item dispatches through its generic setter', async ({ page }) => {
  await loadEditorWithFakeProvider(page);
  const personId = await getProbandId(page);

  await triggerImport(page, personId, [{ linkId: 'custom_note', value: 'imported text' }]);

  const value = await page.evaluate(
    (personId) => window.editor.getView().getNode(personId).getQuestionnaireAnswer_custom_note(),
    personId
  );
  expect(value).toBe('imported text');
});

test('importing a reserved legend target merges without removing existing entries', async ({ page }) => {
  await loadEditorWithFakeProvider(page);
  const personId = await getProbandId(page);

  await page.evaluate((personId) => {
    window.editor.getView().getNode(personId).setDisorders(['111111']);
  }, personId);

  await triggerImport(page, personId, [
    { linkId: 'disorders', value: [{ id: '111111', name: 'Existing' }, { id: '222222', name: 'New disorder' }] },
  ]);

  const disorders = await page.evaluate((personId) => window.editor.getView().getNode(personId).getDisorders(), personId);
  expect(disorders.sort()).toEqual(['111111', '222222']);
});

test('a single import call dispatches mixed-kind entries independently', async ({ page }) => {
  await loadEditorWithFakeProvider(page);
  const personId = await getProbandId(page);

  await triggerImport(page, personId, [
    { linkId: 'gender', value: 'M' },
    { linkId: 'disorders', value: [{ id: '333333', name: 'Third disorder' }] },
    { linkId: 'custom_note', value: 'mixed call' },
  ]);

  const result = await page.evaluate((personId) => {
    const node = window.editor.getView().getNode(personId);
    return {
      gender: node.getGender(),
      disorders: node.getDisorders(),
      note: node.getQuestionnaireAnswer_custom_note(),
    };
  }, personId);

  expect(result.gender).toBe('M');
  expect(result.disorders).toEqual(['333333']);
  expect(result.note).toBe('mixed call');
});
