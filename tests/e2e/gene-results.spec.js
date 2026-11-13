import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// Gene result markers (pedigree-gene-result-markers): a result for each gene in a person's Genes,
// chosen beside the gene in the node menu and drawn under the symbol (BRCA1 +/−).

const MINUS = '−';

// With fhirGenes, genes come from a FHIR terminology (as localEditor.html sets up): confirmed by a
// lookup, and then coded when saved.
async function open(page, { fhirGenes = false } = {}) {
  page.on('dialog', (dialog) => dialog.accept());
  // (no terminology server: a gene's name stays its ID, so the lines read predictably)
  await page.route(/ontoserver|\/fhir\//, (route) => route.abort());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate((fhir) => {
    // (the page's own editor's canvas and toolbar go too, so what's clicked is this editor's)
    document.querySelectorAll('#work-area, #editor-menu').forEach((el) => el.remove());
    document.querySelectorAll('.pedigree-template-chooser, .pedigree-export-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove());
    window.localStorage.removeItem('geneResults');
    const genes = 'http://www.genenames.org';
    window.editor = window.OpenPedigree.initialiseEditor(Object.assign(
      { backend: window.OpenPedigree.localStorageBackend, patientDataUrl: 'local:geneResults' },
      fhir ? {
        geneOptions: { type: 'FHIR', codeSystem: genes, validIdRegex: /^[0-9]+$/, fhirBaseUrl: 'http://example.org/fhir', valueSet: genes },
        fhirTerminologyHelperOptions: { geneCodeSystem: genes },
      } : {}));
  }, fhirGenes);
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  await page.evaluate(() => document.querySelectorAll('.pedigree-template-chooser').forEach((c) => (c.closest('.msdialog-modal-container') || c).remove()));
  await page.evaluate(() => window.editor.getSaveLoadEngine().createGraphFromImportData('f 1 0 0 2 1', 'ped', {}, false, true));
}

// What the gene picker sends when genes are chosen.
const setGenes = (page, genes) => page.evaluate((list) => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty',
  { detail: { nodeID: 0, properties: { setGenes: list } } })), genes);
const resultLine = (page) => page.evaluate(() => {
  const label = window.editor.getView().getNode(0).getGraphics().getGeneResultsLabel();
  return label ? label.attr('text') : null;
});
const results = (page) => page.evaluate(() => window.editor.getView().getNode(0).getGeneResults());
// The node menu, on the tab with the Genes field.
async function openMenu(page) {
  await page.evaluate(() => window.editor.getNodeMenu().show(window.editor.getView().getNode(0), 100, 100));
  // (the menu reopens on the tab last shown, and clicking the active tab is intercepted)
  const tab = page.locator('.menu-box .tabs dd', { hasText: /clinical/i }).first();
  if (!/active/.test(await tab.getAttribute('class') || '')) {
    await tab.locator('a').click();
  }
}
const resultSelect = (page, gene) => page.locator(`.menu-box .gene-result[data-gene="${gene}"] select`);

test('a result chosen beside a gene is drawn under the symbol, and undo takes it away', async ({ page }) => {
  await open(page);
  await setGenes(page, ['BRCA1', 'TP53']);
  await openMenu(page);
  await expect(page.locator('.menu-box .gene-result')).toHaveCount(2);
  await expect(resultSelect(page, 'BRCA1')).toHaveAttribute('aria-label', 'Result for BRCA1');
  await expect(resultSelect(page, 'BRCA1')).toHaveValue('');
  expect(await resultLine(page)).toBeNull();

  await resultSelect(page, 'BRCA1').selectOption('heterozygous');
  expect(await results(page)).toEqual({ BRCA1: 'heterozygous' });
  expect(await resultLine(page)).toBe(`BRCA1 +/${MINUS}`);
  await resultSelect(page, 'TP53').selectOption('negative');
  expect(await resultLine(page)).toBe(`BRCA1 +/${MINUS}\nTP53 ${MINUS}/${MINUS}`);

  await page.evaluate(() => window.editor.getNodeMenu().hide());
  await page.click('#action-undo');
  expect(await results(page)).toEqual({ BRCA1: 'heterozygous' });
  await page.click('#action-undo');
  expect(await results(page)).toEqual({});
  expect(await resultLine(page)).toBeNull();
  await page.click('#action-redo');
  expect(await resultLine(page)).toBe(`BRCA1 +/${MINUS}`);
});

test("removing a gene removes its result, and undo brings both back", async ({ page }) => {
  await open(page);
  await setGenes(page, ['BRCA1', 'TP53']);
  await openMenu(page);
  await resultSelect(page, 'BRCA1').selectOption('homozygous');
  await resultSelect(page, 'TP53').selectOption('hemizygous');
  await page.evaluate(() => window.editor.getNodeMenu().hide());

  await setGenes(page, ['TP53']);
  expect(await results(page)).toEqual({ TP53: 'hemizygous' });
  expect(await resultLine(page)).toBe('TP53 +/0');
  await openMenu(page);
  await expect(page.locator('.menu-box .gene-result')).toHaveCount(1);
  // (reopened, the menu shows the stored result)
  await expect(resultSelect(page, 'TP53')).toHaveValue('hemizygous');
  await page.evaluate(() => window.editor.getNodeMenu().hide());

  await page.click('#action-undo');
  expect(await results(page)).toEqual({ BRCA1: 'homozygous', TP53: 'hemizygous' });
  expect(await resultLine(page)).toBe('BRCA1 +/+\nTP53 +/0');
});

test('an untested gene draws nothing, and the lines stay in a de-identified export', async ({ page }) => {
  await open(page);
  await setGenes(page, ['BRCA1', 'BRCA2']);
  await openMenu(page);
  await resultSelect(page, 'BRCA2').selectOption('negative');
  await page.evaluate(() => window.editor.getNodeMenu().hide());
  expect(await resultLine(page)).toBe(`BRCA2 ${MINUS}/${MINUS}`);

  for (const privacy of ['nopersonal', 'minimal']) {
    const svg = await page.evaluate((setting) => window.editor.getView().withDeidentifiedRendering(setting,
      () => document.querySelector('#canvas svg').outerHTML), privacy);
    expect(svg, privacy).toContain(`BRCA2 ${MINUS}/${MINUS}`);
    expect(svg, privacy).not.toContain('BRCA1 ');
  }
});

test('results are saved and reopened, and a pedigree without them saves none', async ({ page }) => {
  await open(page);
  await setGenes(page, ['BRCA1']);
  await page.evaluate(() => window.editor.getSaveLoadEngine().save('local:geneResults'));
  expect(await page.evaluate(() => window.localStorage.getItem('geneResults'))).not.toContain('geneResults');

  await openMenu(page);
  await resultSelect(page, 'BRCA1').selectOption('heterozygous');
  await page.evaluate(() => window.editor.getNodeMenu().hide());
  await page.evaluate(() => window.editor.getSaveLoadEngine().save('local:geneResults'));
  const saved = await page.evaluate(() => window.localStorage.getItem('geneResults'));
  await page.evaluate((text) => {
    window.editor.getGraph().clearAll && null;
    window.editor.getSaveLoadEngine().createGraphFromSerializedData(JSON.parse(text).value);
  }, saved);
  expect(await results(page)).toEqual({ BRCA1: 'heterozygous' });
  expect(await resultLine(page)).toBe(`BRCA1 +/${MINUS}`);
});

test('results round-trip through GA4GH FHIR, with the genes coded and their answers in QuestionnaireResponses', async ({ page }) => {
  await open(page, { fhirGenes: true });
  // The gene terminology confirms each gene and names it (HGNC ids: a confirmed gene is coded).
  // (registered after open's block, so it's tried first)
  // The names are held back until released, to see the line take them up when they arrive.
  const NAMES = { 1100: 'BRCA1', 11998: 'TP53' };
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  await page.route(/CodeSystem\/\$lookup/, async (route) => {
    await released;
    const code = new URL(route.request().url()).searchParams.get('code');
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ resourceType: 'Parameters', parameter: [{ name: 'display', valueString: NAMES[code] || code }] }) });
  });
  await setGenes(page, ['1100', '11998']);
  await openMenu(page);
  await resultSelect(page, '1100').selectOption('heterozygous');
  // (no name yet: the gene's ID)
  expect(await resultLine(page)).toBe(`1100 +/${MINUS}`);
  await expect(page.locator('.menu-box .gene-result[data-gene="1100"] .gene-result-name')).toHaveText('1100');
  release();
  await expect.poll(() => resultLine(page)).toBe(`BRCA1 +/${MINUS}`);
  // (and the open menu's row)
  await expect(page.locator('.menu-box .gene-result[data-gene="1100"] .gene-result-name')).toHaveText('BRCA1');
  await expect(resultSelect(page, '1100')).toHaveAttribute('aria-label', 'Result for BRCA1');
  await page.evaluate(() => window.editor.getNodeMenu().hide());
  await openMenu(page);
  await resultSelect(page, '11998').selectOption('negative');
  await page.evaluate(() => window.editor.getNodeMenu().hide());

  await page.evaluate(() => window.editor.getSaveLoadEngine().save('local:geneResults?format=GA4GH'));
  const saved = JSON.parse(JSON.parse(await page.evaluate(() => window.localStorage.getItem('geneResults'))).value);
  const resources = saved.entry.map((e) => e.resource);
  // (the genes are coded, and the person's QuestionnaireResponse lists them)
  const genes = resources.filter((r) => r.resourceType === 'Observation' && r.valueCodeableConcept && r.component);
  expect(genes.length).toBe(2);
  expect(resources.some((r) => r.resourceType === 'QuestionnaireResponse')).toBe(true);

  await page.evaluate((text) => window.editor.getSaveLoadEngine().createGraphFromImportData(text, 'GA4GH', {}, false, true),
    JSON.stringify(saved));
  expect(await results(page)).toEqual({ 1100: 'heterozygous', 11998: 'negative' });
  await expect.poll(() => resultLine(page)).toBe(`BRCA1 +/${MINUS}\nTP53 ${MINUS}/${MINUS}`);
});

test('a result drop-down keeps the focus through a keyboard change, and is locked with the Genes field', async ({ page }) => {
  await open(page);
  await setGenes(page, ['BRCA1', 'TP53']);
  await openMenu(page);
  await resultSelect(page, 'TP53').focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => results(page)).toEqual({ TP53: 'heterozygous' });
  // (the menu was redrawn, and the same drop-down still has the focus)
  expect(await page.evaluate(() => document.activeElement && document.activeElement.closest('.gene-result')
    && document.activeElement.closest('.gene-result').dataset.gene)).toBe('TP53');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => results(page)).toEqual({ TP53: 'homozygous' });

  // Locked with the genes (as a Questionnaire's disabledWhen or a linked record does).
  await page.evaluate(() => {
    const menu = window.editor.getNodeMenu();
    menu._setFieldDisabled['questionnaire-legend-picker'].call(menu, document.querySelector('.menu-box .field-candidate_genes'), true);
  });
  await expect(resultSelect(page, 'BRCA1')).toBeDisabled();
  await expect(resultSelect(page, 'TP53')).toBeDisabled();
});

test('a variant found with its zygosity unknown is drawn as +', async ({ page }) => {
  await open(page);
  await setGenes(page, ['BRCA1']);
  await openMenu(page);
  await expect(resultSelect(page, 'BRCA1').locator('option[value="positive"]')).toHaveText('Positive, zygosity unknown (+)');
  await resultSelect(page, 'BRCA1').selectOption('positive');
  expect(await results(page)).toEqual({ BRCA1: 'positive' });
  expect(await resultLine(page)).toBe('BRCA1 +');
});
