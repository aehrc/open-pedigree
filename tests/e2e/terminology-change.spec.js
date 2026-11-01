import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// A pedigree saved under another Default Terminology (terminology-change-keeps-codes): its terms are
// shown by name, and saved again with their own codings - also after the person is edited and the
// edit undone (redoing a property change throws, as before this change: ActionStack.redo reads the
// event's memo, which CustomEvents don't have). localEditor.html's terminology is OMIM disorders and HPO phenotypes.
const LEGACY = fs.readFileSync(path.join(__dirname, '..', 'unit', 'fixtures', 'legacy-fhir-v1-pedigree.json'), 'utf8');
const SNOMED = 'http://snomed.info/sct';
// (a name the editor's term ids don't keep as it is: it gives it back as "ADA2 deficiency, Sneddon s type")
const ADA2 = { system: SNOMED, code: '1234567', display: 'ADA2 deficiency, Sneddon\'s type' };
const SEIZURE = { system: SNOMED, code: '91175000', display: 'Seizure' };

async function openWith(page, value) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.addInitScript((stored) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('pedigreeData', JSON.stringify({ value: stored }));
    }
  }, value);
  await page.goto('/localEditor.html?format=GA4GH');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => Object.values(window.editor.getGraph().DG.GG.properties).some((p) => p.fName === 'Maya'))).toBe(true);
}

async function save(page) {
  await page.evaluate(() => {
    localStorage.removeItem('pedigreeData');
    document.getElementById('action-save').click();
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pedigreeData'))).not.toBeNull();
  return JSON.parse(await page.evaluate(() => JSON.parse(localStorage.getItem('pedigreeData')).value));
}

function mayaOf(bundle, firstName = 'Maya') {
  const resources = bundle.entry.map((e) => e.resource);
  const patient = resources.find((r) => r.resourceType === 'Patient' && r.name && r.name[0].given && r.name[0].given[0] === firstName);
  return resources.filter((r) => r.subject && r.subject.reference === patient.id);
}

// Maya's GA4GH pedigree with her disorder and phenotype recoded in SNOMED CT, as if saved under it.
async function savedUnderSnomed(context) {
  const page = await context.newPage();
  await openWith(page, LEGACY);
  const bundle = await save(page);
  await page.close();
  for (const r of mayaOf(bundle)) {
    // (saved as text or coded, as the terminology confirmed them - localEditor.html has no server)
    if (r.resourceType === 'Condition' && JSON.stringify(r.code).includes('615688')) {
      r.code = { coding: [ADA2] };
    }
    if (r.resourceType === 'Observation' && !r.code && JSON.stringify(r).includes('HP:0001250')) {
      delete r.valueString;
      r.valueCodeableConcept = { coding: [SEIZURE] };
    }
    if (r.resourceType === 'QuestionnaireResponse') {
      for (const item of r.item) {
        for (const answer of item.answer || []) {
          if (JSON.stringify(answer).includes('615688')) {
            answer.valueCoding = ADA2;
          }
          if (JSON.stringify(answer).includes('HP:0001250')) {
            answer.valueCoding = SEIZURE;
          }
        }
      }
    }
  }
  return JSON.stringify(bundle);
}

function codings(resources) {
  return {
    disorders: resources.filter((r) => r.resourceType === 'Condition').map((r) => r.code),
    observations: resources.filter((r) => r.resourceType === 'Observation' && !r.code && r.valueCodeableConcept).map((r) => r.valueCodeableConcept),
  };
}

test('terms from another terminology are shown by name and saved with their codes, through an edit and its undo', async ({ page, context }) => {
  const stored = await savedUnderSnomed(context);
  await openWith(page, stored);
  const maya = await page.evaluate(() => {
    const [id, p] = Object.entries(window.editor.getGraph().DG.GG.properties).find(([, q]) => q.fName === 'Maya');
    return { id: Number(id), disorders: p.disorders, hpoTerms: p.hpoTerms };
  });
  expect(maya.disorders).toContain('ADA2 deficiency, Sneddon\'s type');
  expect(maya.hpoTerms).toEqual(['Seizure']);

  // saved as opened
  const opened = codings(mayaOf(await save(page)));
  expect(opened.disorders).toContainEqual({ coding: [ADA2] });
  expect(opened.observations).toContainEqual({ coding: [SEIZURE] });

  await page.evaluate((id) => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty',
    { detail: { nodeID: id, properties: { setFirstName: 'May' } } })), maya.id);
  const edited = codings(mayaOf(await save(page), 'May'));
  expect(edited.disorders).toContainEqual({ coding: [ADA2] });
  expect(edited.observations).toContainEqual({ coding: [SEIZURE] });

  await page.evaluate(() => window.editor.getActionStack().undo());
  const saved = await save(page);
  const after = codings(mayaOf(saved));
  expect(after.disorders).toContainEqual({ coding: [ADA2] });
  expect(after.observations).toContainEqual({ coding: [SEIZURE] });
});
