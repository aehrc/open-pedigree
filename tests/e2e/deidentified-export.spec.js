import { test, expect } from '@playwright/test';

// The de-identified export (pedigree-editor-generation-numbering): with either "Remove personal
// information" option, an SVG has no names, external IDs or dates; ages are bands, and people are
// labelled with their generation number. The canvas is unchanged by the export.

const YEAR = new Date().getFullYear();
// A date `years` years and `months` months ago, as the node form stores it.
function ago(years, months = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - 1);
  return d;
}

async function openFamily(page) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  // (the page's own editor: nothing here is saved)
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  await page.evaluate(() => window.editor.getTemplateSelector().hide());
  // Grandad (died at 72) and Grandma; their son Arthur (45) and his partner Beryl; their children Cyril (6) and Dot (3 months)
  const dates = {
    grandadBorn: ago(100).toISOString(), grandadDied: ago(28).toISOString(),
    arthur: ago(45).toISOString(), cyril: ago(6).toISOString(), dot: ago(0, 3).toISOString(),
  };
  await page.evaluate((dates) => {
    const ped = ['f GD1 0 0 1 1', 'f GM2 0 0 2 1', 'f AR3 GD1 GM2 1 1', 'f BE4 0 0 2 1', 'f CY5 AR3 BE4 1 1', 'f DO6 AR3 BE4 2 1'].join('\n');
    window.editor.getSaveLoadEngine().createGraphFromImportData(ped, 'ped', { externalIdMark: true }, false, true);
    const graph = window.editor.getGraph();
    const node = (ext) => {
      for (let v = 0; v <= graph.getMaxNodeId(); v++) {
        if (graph.isPerson(v) && graph.getProperties(v).externalID === ext) {
          return window.editor.getView().getNode(v);
        }
      }
      return null;
    };
    const set = (ext, change) => {
      const n = node(ext);
      change(n);
      graph.setProperties(n.getID(), n.getProperties());
    };
    set('GD1', (n) => { n.setFirstName('Grandad'); n.setLifeStatus('deceased'); n.setBirthDate(new Date(dates.grandadBorn)); n.setDeathDate(new Date(dates.grandadDied)); });
    set('GM2', (n) => n.setFirstName('Grandma'));
    set('AR3', (n) => { n.setFirstName('Arthur'); n.setLastName('Ashworth'); n.setBirthDate(new Date(dates.arthur)); n.setComments('Lives in Leeds'); });
    set('BE4', (n) => n.setFirstName('Beryl'));
    set('CY5', (n) => { n.setFirstName('Cyril'); n.setBirthDate(new Date(dates.cyril)); });
    set('DO6', (n) => { n.setFirstName('Dot'); n.setBirthDate(new Date(dates.dot)); });
  }, dates);
  // (the template choosers the page shows for an empty pedigree - the startup one and the editor's -
  // whose modal covers the toolbar; the export dialog has a container of its own)
  await page.evaluate(() => document.querySelectorAll('.pedigree-template-chooser')
    .forEach((chooser) => (chooser.closest('.msdialog-modal-container') || chooser).remove()));
}

// The canvas SVG's text, and the text of an SVG export through the dialog with a privacy option.
// (each visible label's text and where it is)
const canvasTexts = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas svg text')]
  .filter((t) => t.style.display !== 'none')
  .map((t) => t.textContent + ' @' + Math.round(t.getBBox().x) + ',' + Math.round(t.getBBox().y)).sort());

async function exportSVG(page, privacy) {
  await page.evaluate(() => window.editor.getExportSelector().show());
  await expect(page.locator('.pedigree-export-chooser')).toBeVisible({ timeout: 5000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.evaluate((privacy) => {
      const svg = document.querySelector('input[type=radio][name="export-type"][value="svg"]');
      svg.checked = true;
      svg.click();
      const option = document.querySelector(`input[type=radio][name="privacy-options"][value="${privacy}"]`);
      option.checked = true;
      document.getElementById('export_button').click();
    }, privacy),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const svg = Buffer.concat(chunks).toString('utf8');
  await page.evaluate(() => window.editor.getExportSelector().hide());
  return page.evaluate((svg) => {
    const dom = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return [...dom.getElementsByTagName('text')].map((t) => t.textContent);
  }, svg);
}

const NAMES = ['Grandad', 'Grandma', 'Arthur', 'Ashworth', 'Beryl', 'Cyril', 'Dot'];
const IDS = ['[GD1]', '[GM2]', '[AR3]', '[BE4]', '[CY5]', '[DO6]'];

for (const privacy of ['nopersonal', 'minimal']) {
  test(`a de-identified SVG (${privacy}) has no names, IDs or years, and gives age bands and generation labels`, async ({ page }) => {
    await openFamily(page);
    const texts = await exportSVG(page, privacy);
    const all = texts.join(' | ');
    for (const word of [...NAMES, ...IDS]) {
      expect(all, word).not.toContain(word);
    }
    for (let year = YEAR - 101; year <= YEAR; year++) {
      expect(all, String(year)).not.toContain(String(year));
    }
    for (const band of ['d. 70s', '40s', 'child', 'infant']) {
      expect(texts, band).toContain(band);
    }
    for (const label of ['I-1', 'I-2', 'II-1', 'II-2', 'III-1', 'III-2', 'I', 'II', 'III']) {
      expect(texts, label).toContain(label);
    }
    expect(all.includes('Lives in Leeds')).toBe(privacy === 'nopersonal');
  });
}

test('an SVG with all data keeps names, IDs and dates, and no numbering unless it is on', async ({ page }) => {
  await openFamily(page);
  const texts = await exportSVG(page, 'all');
  const all = texts.join(' | ');
  expect(all).toContain('Arthur Ashworth');
  expect(all).toContain('[AR3]');
  expect(texts).not.toContain('II-1');
  await page.click('#action-numbering');
  expect(await exportSVG(page, 'all')).toContain('II-1');
});

test('a de-identified export leaves the canvas as it was', async ({ page }) => {
  await openFamily(page);
  const before = await canvasTexts(page);
  await exportSVG(page, 'minimal');
  expect(await canvasTexts(page)).toEqual(before);
  expect(before.join(' | ')).toContain('Arthur Ashworth');
  // and with numbering on, it stays on
  await page.click('#action-numbering');
  const numbered = await canvasTexts(page);
  await exportSVG(page, 'nopersonal');
  expect(await canvasTexts(page)).toEqual(numbered);
});

test('a de-identified PDF is made from the same drawing, and leaves the canvas as it was', async ({ page }) => {
  await openFamily(page);
  const before = await canvasTexts(page);
  await page.evaluate(() => window.editor.getExportSelector().show());
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.evaluate(() => {
      const pdf = document.querySelector('input[type=radio][name="export-type"][value="pdf"]');
      pdf.checked = true;
      pdf.click();
      document.querySelector('input[type=radio][name="privacy-options"][value="minimal"]').checked = true;
      document.getElementById('export_button').click();
    }),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await page.evaluate(() => window.editor.getExportSelector().hide());
  expect(await canvasTexts(page)).toEqual(before);
});
