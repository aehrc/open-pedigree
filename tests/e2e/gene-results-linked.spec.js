import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// A gene's result from a linked record (pedigree-gene-results-from-linked-rows): the record sends
// `gene_results` with its genes; the result is drawn, read-only like the genes, and kept in step
// when the record changes.

const MINUS = '−';
const LINKED = { url: 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/questionnaire-linked-record-source' };
const LEGEND = { url: 'https://aehrc.github.io/open-pedigree/fhir/StructureDefinition/questionnaire-field-mapping', valueCode: 'mapsToLegendObservation' };
// As the module derives it in Tags only mode: the Genes item comes from the linked row.
const QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-linked-genes',
  version: '1.0',
  item: [
    { linkId: 'clinical', type: 'group', text: 'Clinical', item: [
      { linkId: 'candidate_genes', type: 'choice', text: 'Genes', repeats: true, answerValueSet: 'http://www.genenames.org',
        extension: [LEGEND, LINKED] },
    ] },
  ],
};
const REF = 'record:1/instance:1';
const answers = (results) => [
  { linkId: 'candidate_genes', value: [{ id: 'BRCA1', name: 'BRCA1' }] },
  { linkId: 'gene_results', value: results },
];

async function open(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  // (no terminology server: a gene's name stays its ID)
  await page.route(/ontoserver|example\.org\/fhir/, (route) => route.abort());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate((q) => {
    document.querySelectorAll('#work-area, #editor-menu').forEach((el) => el.remove());
    document.querySelectorAll('.msdialog-modal-container').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({ questionnaireLocal: q, questionnaireTerminologyBaseUrl: 'http://example.org/fhir' });
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 2 1', 'ped', {}, true, true);
  }, QUESTIONNAIRE);
  await page.waitForTimeout(300);
}

const person = (page) => page.evaluate(() => {
  const map = window.editor.getView().getNodeMap();
  return Number(Object.keys(map).find((k) => map[k].getType && map[k].getType() === 'Person'));
});
const resultLine = (page, id) => page.evaluate((n) => {
  const label = window.editor.getView().getNode(n).getGraphics().getGeneResultsLabel();
  return label ? label.attr('text') : null;
}, id);

test('a linked record\'s result is drawn, and follows the record when it changes or is emptied', async ({ page }) => {
  await open(page);
  const id = await person(page);
  await page.evaluate(({ n, ref, a }) => window.editor._applyLinkedRecord(n, ref, a), { n: id, ref: REF, a: answers({ BRCA1: 'heterozygous' }) });
  expect(await resultLine(page, id)).toBe(`BRCA1 +/${MINUS}`);

  // closing Edit in REDCap: the record's result changed
  await page.evaluate(({ n, ref, a }) => window.editor._dispatchLinkedRecordRefresh(n, a, ref), { n: id, ref: REF, a: answers({ BRCA1: 'homozygous' }) });
  expect(await resultLine(page, id)).toBe('BRCA1 +/+');

  // the record's result emptied: cleared, the gene stays
  await page.evaluate(({ n, ref, a }) => window.editor._dispatchLinkedRecordRefresh(n, a, ref), { n: id, ref: REF, a: answers({}) });
  expect(await resultLine(page, id)).toBeNull();
  expect(await page.evaluate((n) => window.editor.getView().getNode(n).getGenes(), id)).toEqual(['BRCA1']);
});

test('a linked gene\'s result can\'t be changed in the node menu', async ({ page }) => {
  await open(page);
  const id = await person(page);
  await page.evaluate(({ n, ref, a }) => window.editor._applyLinkedRecord(n, ref, a), { n: id, ref: REF, a: answers({ BRCA1: 'heterozygous' }) });
  await page.evaluate((n) => window.editor.getNodeMenu().show(window.editor.getView().getNode(n), 100, 100), id);
  const select = page.locator('.menu-box .gene-result[data-gene="BRCA1"] select');
  await expect(select).toHaveValue('heterozygous');
  await expect(select).toBeDisabled();
});

test('a refresh keeps the result of a gene that didn\'t come from the record', async ({ page }) => {
  await open(page);
  const id = await person(page);
  await page.evaluate(({ n, ref, a }) => window.editor._applyLinkedRecord(n, ref, a), { n: id, ref: REF, a: answers({ BRCA1: 'heterozygous' }) });
  // TP53 and its result, from elsewhere (e.g. a pedigree saved before the person was linked)
  await page.evaluate((n) => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty',
    { detail: { nodeID: n, properties: { setGenes: ['BRCA1', 'TP53'], setGeneResults: { BRCA1: 'heterozygous', TP53: 'negative' } } } })), id);
  await page.evaluate(({ n, ref, a }) => window.editor._dispatchLinkedRecordRefresh(n, a, ref), { n: id, ref: REF, a: answers({ BRCA1: 'homozygous' }) });
  expect(await page.evaluate((n) => window.editor.getView().getNode(n).getGeneResults(), id)).toEqual({ BRCA1: 'homozygous', TP53: 'negative' });
});
