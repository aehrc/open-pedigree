import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// A host that loads its pedigree through a backend (as redcap_pedigree_editor does, from local
// storage) and gets its Questionnaire from a questionnaireUrl. The pedigree must be read against
// that Questionnaire, not the built-in default in effect until the fetch resolves.

const QUESTIONNAIRE_URL = 'http://example.org/fhir/Questionnaire/load-after';
const DATA_URL = 'local:loadAfterQuestionnaire?format=GA4GH';
const STORAGE_KEY = 'loadAfterQuestionnaire';

const CUSTOM_LEGEND_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-load-after-questionnaire',
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
        { linkId: 'note', type: 'string', text: 'Note' },
      ],
    },
  ],
};

const HTN = { system: 'http://example.org/codes', code: 'htn', display: 'Hypertension' };

async function routeTerminology(page) {
  await page.route('**/ValueSet/$expand**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ resourceType: 'ValueSet', expansion: { contains: [HTN] } }),
  }));
}

// Routes the questionnaireUrl: answered after delayMs, or failed, or never (a hung server).
async function routeQuestionnaire(page, { delayMs = 0, fail = false, hang = false } = {}) {
  await page.route(QUESTIONNAIRE_URL, async (route) => {
    if (hang) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (fail) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CUSTOM_LEGEND_QUESTIONNAIRE) });
    }
  });
}

function newEditor(page, options) {
  return page.evaluate(({ opts, url, dataUrl }) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const editorOptions = {
      questionnaireTerminologyBaseUrl: 'http://example.org/fhir',
      backend: window.OpenPedigree.localStorageBackend,
      patientDataUrl: dataUrl,
    };
    if (opts.local) {
      editorOptions.questionnaireLocal = opts.local;
    } else {
      editorOptions.questionnaireUrl = url;
    }
    if (opts.waitMs !== undefined) {
      editorOptions.questionnaireWaitMs = opts.waitMs;
    }
    if (opts.autosave) {
      editorOptions.autosave = true;
    }
    // A backend built in the page: 'slow' answers with the stored pedigree after 1 s (as a fetch
    // does), 'throws' throws from load. Saves are counted in window.backendSaves.
    if (opts.backend) {
      window.backendSaves = 0;
      editorOptions.backend = {
        save: (args) => { window.backendSaves++; args.setSaveInProgress(false); },
        load: (args) => {
          if (opts.backend === 'throws') {
            throw new Error('corrupt');
          }
          if (opts.backend === 'loadsThenThrows') {
            args.onSuccess(window.__serialized);
            throw new Error('after loading');
          }
          setTimeout(() => args.onSuccess(window.__serialized), 1000);
        },
      };
      editorOptions.patientDataUrl = 'custom:pedigree';
    }
    window.editor = window.OpenPedigree.initialiseEditor(editorOptions);
  }, { opts: options, url: QUESTIONNAIRE_URL, dataUrl: DATA_URL });
}

const probandName = (page) => page.evaluate(() => {
  const node = window.editor.getView().getNode(0);
  return node ? node.getFirstName() : 'no proband';
});

// The template chooser a new (unstored) pedigree gets: count of visible ones.
const visibleTemplateChoosers = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.template-picture-container'))
  .filter((el) => el.offsetParent !== null).length);

const coverShown = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.pedigree-loading-cover')).length);

// Whether the topmost element at the toolbar's corner and at the page's centre is the cover.
const coverOnTop = (page) => page.evaluate(() => [[20, 20], [window.innerWidth / 2, window.innerHeight / 2]]
  .every(([x, y]) => {
    const element = document.elementFromPoint(x, y);
    return Boolean(element && element.closest('.pedigree-loading-cover'));
  }));

// Whether the visible toolbar's Clear button is inert (out of reach of Tab and assistive tech).
const toolbarInert = (page) => page.evaluate(() => {
  const button = Array.from(document.querySelectorAll('#action-clear')).find((el) => el.offsetParent !== null);
  return Boolean(button && button.closest('[inert]'));
});

const probandAnswer = (page, linkId) => page.evaluate((id) => {
  const node = window.editor.getView().getNode(0);
  return node ? node.getQuestionnaireAnswer(id) : 'no proband';
}, linkId);

// Saves, through the local-storage backend, a proband with a custom legend answer and a note,
// made with the same Questionnaire in effect from the start.
async function storePedigree(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await routeTerminology(page);
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await retireAutoCreatedEditor(page);
  await newEditor(page, { local: CUSTOM_LEGEND_QUESTIONNAIRE });
  await page.evaluate((htn) => {
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
    const fire = (property, value) => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
      detail: { nodeID: 0, properties: { [property]: value } },
    }));
    fire('setQuestionnaireAnswer_comorbidities', [htn]);
    fire('setQuestionnaireAnswer_note', 'kept');
    fire('setFirstName', 'Stored');
  }, HTN);
  expect(await probandAnswer(page, 'comorbidities')).toEqual([HTN]);
  await page.evaluate((url) => window.editor.getSaveLoadEngine().save(url), DATA_URL);
  const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  expect(stored).toContain('htn');
  await retireAutoCreatedEditor(page);
}

test('a stored pedigree is read against the questionnaireUrl Questionnaire, even when it arrives late', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { delayMs: 800 });
  await newEditor(page, {});

  await expect.poll(() => probandAnswer(page, 'comorbidities'), { timeout: 10000 }).toEqual([HTN]);
  expect(await probandAnswer(page, 'note')).toBe('kept');
  // Read as the custom legend's term, not also as a phenotype or disorder.
  expect(await page.evaluate(() => window.editor.getView().getNode(0).getPhenotypes())).toEqual([]);
  expect(await page.evaluate(() => window.editor.getView().getNode(0).getDisorders())).toEqual([]);
  // The load's own undo state holds the answer too, so an undo doesn't lose it.
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
  await page.waitForTimeout(300);
  expect(await probandAnswer(page, 'comorbidities')).toEqual([HTN]);
});

test('control: the same stored pedigree, with the Questionnaire given directly, keeps its answers', async ({ page }) => {
  await storePedigree(page);
  await newEditor(page, { local: CUSTOM_LEGEND_QUESTIONNAIRE });

  await expect.poll(() => probandAnswer(page, 'comorbidities'), { timeout: 10000 }).toEqual([HTN]);
  expect(await probandAnswer(page, 'note')).toBe('kept');
});

test('the stored pedigree waits for the Questionnaire: nothing is loaded before it arrives', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { delayMs: 1500 });
  const choosersBefore = await visibleTemplateChoosers(page);
  await newEditor(page, {});

  await page.waitForTimeout(500);
  expect(await probandName(page)).toBe('no proband');
  // A cover keeps the user out of the empty editor meanwhile.
  expect(await coverShown(page)).toBe(1);
  await expect(page.locator('.pedigree-loading-cover')).toContainText('Loading the pedigree');
  // It's on top of everything, so clicks anywhere (the toolbar too) land on it.
  expect(await coverOnTop(page)).toBe(true);
  expect(await toolbarInert(page)).toBe(true);
  await expect.poll(() => probandName(page), { timeout: 10000 }).toBe('Stored');
  expect(await coverShown(page)).toBe(0);
  expect(await coverOnTop(page)).toBe(false);
  expect(await toolbarInert(page)).toBe(false);
  expect(await probandAnswer(page, 'comorbidities')).toEqual([HTN]);
  // A stored pedigree gets no template chooser.
  expect(await visibleTemplateChoosers(page)).toBe(choosersBefore);
});

test('a failed Questionnaire fetch still loads the stored pedigree, against the built-in default', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { delayMs: 300, fail: true });
  await newEditor(page, {});

  await expect.poll(() => probandName(page), { timeout: 10000 }).toBe('Stored');
  // The built-in default's fields are in effect.
  await page.evaluate(() => window.editor.getNodeMenu().show(window.editor.getView().getNode(0), 100, 100));
  await expect(page.locator('.menu-box .field-comments').first()).toBeAttached();
});

test('a Questionnaire that never arrives: the stored pedigree loads once the wait cap passes', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { hang: true });
  // As a string, as a host might pass it from a URL parameter.
  await newEditor(page, { waitMs: '1500' });

  await page.waitForTimeout(500);
  expect(await probandName(page)).toBe('no proband');
  await expect.poll(() => probandName(page), { timeout: 5000 }).toBe('Stored');
  expect(await probandAnswer(page, 'note')).toBeUndefined();
});

test('a pedigree imported while waiting for the Questionnaire is not replaced by the stored one', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { delayMs: 1000 });
  const choosersBefore = await visibleTemplateChoosers(page);
  await newEditor(page, {});
  await page.evaluate(() => {
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam2 9 0 0 2 1', 'ped', {}, true, true);
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
      detail: { nodeID: 0, properties: { setFirstName: 'Imported' } },
    }));
  });

  // The Questionnaire has arrived...
  await expect.poll(() => page.evaluate(() => window.editor._questionnaireConfig.items.some((item) => item.linkId === 'note')), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(500);
  // ...and the import is still what's shown.
  expect(await probandName(page)).toBe('Imported');
  expect(await visibleTemplateChoosers(page)).toBe(choosersBefore);
});

test('with nothing stored, the template chooser is shown once the Questionnaire arrives', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await retireAutoCreatedEditor(page);
  await routeQuestionnaire(page, { delayMs: 300 });
  const choosersBefore = await visibleTemplateChoosers(page);
  await newEditor(page, {});

  await expect.poll(() => visibleTemplateChoosers(page), { timeout: 10000 }).toBe(choosersBefore + 1);
});

test('an import that fails while waiting leaves the canvas empty, so the stored pedigree still loads', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { delayMs: 1000 });
  await newEditor(page, {});
  const imported = await page.evaluate(() => window.editor.getSaveLoadEngine().createGraphFromImportData('not a pedigree', 'GA4GH', {}, true, true));
  expect(imported).toBeFalsy();

  await expect.poll(() => probandName(page), { timeout: 10000 }).toBe('Stored');
});

test('after Clear while waiting, the new proband and its edits are kept', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { delayMs: 1000 });
  await newEditor(page, {});
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('pedigree:graph:clear'));
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
      detail: { nodeID: 0, properties: { setFirstName: 'Mine' } },
    }));
  });

  await expect.poll(() => page.evaluate(() => window.editor._questionnaireConfig.items.some((item) => item.linkId === 'note')), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(500);
  expect(await probandName(page)).toBe('Mine');
});

test('saving while waiting does not overwrite the stored pedigree', async ({ page }) => {
  await storePedigree(page);
  const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await routeQuestionnaire(page, { delayMs: 1500 });
  await newEditor(page, {});

  // An autosave or a host's save.
  await page.evaluate((url) => window.editor.getSaveLoadEngine().save(url), DATA_URL);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(stored);

  await expect.poll(() => probandName(page), { timeout: 10000 }).toBe('Stored');
  expect(await page.evaluate(() => window.editor.isAwaitingFirstLoad())).toBe(false);
});

test('with a backend that fetches, the stored pedigree arrives after the Questionnaire, with its answers', async ({ page }) => {
  await storePedigree(page);
  // The stored pedigree, serialized, for the page's slow backend to hand back.
  await newEditor(page, { local: CUSTOM_LEGEND_QUESTIONNAIRE });
  await expect.poll(() => probandName(page), { timeout: 10000 }).toBe('Stored');
  await page.evaluate(() => { window.__serialized = window.editor.getGraph().toJSON(); });
  await retireAutoCreatedEditor(page);
  await routeQuestionnaire(page, { delayMs: 200 });
  page.on('dialog', (dialog) => dialog.dismiss());
  await newEditor(page, { backend: 'slow' });

  // The Questionnaire has arrived and the cover is gone; the backend is still fetching.
  await expect.poll(() => coverShown(page), { timeout: 10000 }).toBe(0);
  expect(await probandName(page)).toBe('no proband');

  await expect.poll(() => probandName(page), { timeout: 10000 }).toBe('Stored');
  expect(await probandAnswer(page, 'comorbidities')).toEqual([HTN]);
  await page.evaluate(() => window.editor.getSaveLoadEngine().save('custom:pedigree'));
  expect(await page.evaluate(() => window.backendSaves)).toBe(1);
});

test('a backend that throws on the deferred load gets the template chooser, and saving works again', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { delayMs: 200 });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  const choosersBefore = await visibleTemplateChoosers(page);
  await newEditor(page, { backend: 'throws' });

  await expect.poll(() => visibleTemplateChoosers(page), { timeout: 10000 }).toBe(choosersBefore + 1);
  expect(errors.some((text) => text.includes('Loading the stored pedigree failed'))).toBe(true);
  expect(await page.evaluate(() => window.editor.isAwaitingFirstLoad())).toBe(false);
  expect(await coverShown(page)).toBe(0);
});

test('a backend that throws after loading the pedigree gets no template chooser over it', async ({ page }) => {
  await storePedigree(page);
  await newEditor(page, { local: CUSTOM_LEGEND_QUESTIONNAIRE });
  await expect.poll(() => probandName(page), { timeout: 10000 }).toBe('Stored');
  await page.evaluate(() => { window.__serialized = window.editor.getGraph().toJSON(); });
  await retireAutoCreatedEditor(page);
  await routeQuestionnaire(page, { delayMs: 200 });
  const choosersBefore = await visibleTemplateChoosers(page);
  await newEditor(page, { backend: 'loadsThenThrows' });

  await expect.poll(() => probandName(page), { timeout: 10000 }).toBe('Stored');
  await page.waitForTimeout(300);
  expect(await visibleTemplateChoosers(page)).toBe(choosersBefore);
  expect(await coverShown(page)).toBe(0);
  expect(await page.evaluate(() => window.editor.isAwaitingFirstLoad())).toBe(false);
});

test('with autosave on, a Clear while waiting (by the host: the cover keeps the user out) does not save over the stored pedigree', async ({ page }) => {
  await storePedigree(page);
  const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await routeQuestionnaire(page, { delayMs: 1000 });
  await newEditor(page, { autosave: true });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:graph:clear')));
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(stored);
});

test('a blank questionnaireWaitMs means the default wait, not none', async ({ page }) => {
  await storePedigree(page);
  await routeQuestionnaire(page, { hang: true });
  await newEditor(page, { waitMs: ' ' });
  await page.waitForTimeout(1500);
  expect(await probandName(page)).toBe('no proband');
});
