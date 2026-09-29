import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// A pedigree saved in the Legacy FHIR format (fhir_v1) by redcap_pedigree_editor v0.3.2 - see
// tests/unit/model/LegacyFHIRConverter.test.js.
const LEGACY = fs.readFileSync(path.join(__dirname, '..', 'unit', 'fixtures', 'legacy-fhir-v1-pedigree.json'), 'utf8');
const NAMES = ['Arthur', 'Edith', 'Grace', 'June', 'Leo', 'Maya', 'Ray', 'Ruby', 'Tom'];
const GA4GH_PROFILE = 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree';

// Opens localEditor.html, as a host such as redcap_pedigree_editor does, with a stored pedigree.
async function openWith(page, format, value) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.addInitScript((stored) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('pedigreeData', JSON.stringify({ value: stored }));
    }
  }, value);
  await page.goto(`/localEditor.html?format=${format}`);
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
}

// Maya's terms, in the systems v0.3.2 saved them with, which today's defaults don't use.
const MAYA = { disorders: ['615688', 'affected'], hpoTerms: ['HP:0001250'], candidateGenes: ['HGNC:1839'] };

function maya(page) {
  return page.evaluate(() => {
    const p = Object.values(window.editor.getGraph().DG.GG.properties).find((q) => q.fName === 'Maya');
    return { disorders: p.disorders, hpoTerms: p.hpoTerms, candidateGenes: p.candidateGenes };
  });
}

async function names(page) {
  await expect.poll(() => page.evaluate(() => Object.values(window.editor.getGraph().DG.GG.properties).filter((p) => p.fName).length)).toBe(NAMES.length);
  return page.evaluate(() => Object.values(window.editor.getGraph().DG.GG.properties).map((p) => p.fName).filter(Boolean).sort());
}

async function save(page) {
  await page.evaluate(() => {
    localStorage.removeItem('pedigreeData');
    document.getElementById('action-save').click();
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pedigreeData'))).not.toBeNull();
  return page.evaluate(() => JSON.parse(localStorage.getItem('pedigreeData')).value);
}

for (const format of ['fhir_v1', 'GA4GH']) {
  test(`a legacy FHIR pedigree opens with format ${format}`, async ({ page }) => {
    await openWith(page, format, LEGACY);
    expect(await names(page)).toEqual(NAMES);
    expect(await maya(page)).toEqual(MAYA);
  });
}

test('format fhir_v1 saves GA4GH, which it opens again', async ({ page, context }) => {
  await openWith(page, 'fhir_v1', LEGACY);
  await names(page);
  const saved = JSON.parse(await save(page));
  expect(saved.resourceType).toBe('Bundle');
  expect(saved.entry[0].resource.meta.profile).toContain(GA4GH_PROFILE);

  // (a new page, as a host opens the editor again: this one would ask about leaving)
  const reopened = await context.newPage();
  await openWith(reopened, 'fhir_v1', JSON.stringify(saved));
  expect(await names(reopened)).toEqual(NAMES);
  // (GA4GH doesn't read a last name at birth back - a separate, existing limitation - so Grace's
  // isn't checked here.)
  expect(await maya(reopened)).toEqual(MAYA);
});
