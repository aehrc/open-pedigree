import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// An unborn person (pregnancy) who is also a carrier or pre-symptomatic: the "P" moves up and
// shrinks so the carrier dot or pre-symptomatic bar below it can be seen, for a male, a female and
// an unknown-gender person, and the drawing follows changes to either status.

async function newEditorWithFamily(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await retireAutoCreatedEditor(page);
  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.localStorage.removeItem('unbornCarrierMark');
    window.editor = window.OpenPedigree.initialiseEditor({
      backend: window.OpenPedigree.localStorageBackend, patientDataUrl: 'local:unbornCarrierMark?format=GA4GH',
    });
  });
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  await page.evaluate(() => {
    // parents 1 and 2; children 3-5 (male, female, unknown) are carriers, 6-8 pre-symptomatic
    const ped = ['fam 1 0 0 1 1', 'fam 2 0 0 2 1',
      'fam 3 1 2 1 1', 'fam 4 1 2 2 1', 'fam 5 1 2 0 1',
      'fam 6 1 2 1 1', 'fam 7 1 2 2 1', 'fam 8 1 2 0 1'].join('\n');
    window.editor.getSaveLoadEngine().createGraphFromImportData(ped, 'ped', { externalIdMark: true }, true, true);
  });
}

// Runs in the page: the node with the given externalID.
const NODE_OF = `(ext) => {
  const graph = window.editor.getGraph();
  for (let id = 0; id <= graph.getMaxNodeId(); id++) {
    if (graph.isPerson(id) && graph.getProperties(id).externalID === ext) {
      return window.editor.getView().getNode(id);
    }
  }
  return null;
}`;

// For each child: whether the drawn "P" and the carrier mark overlap, and the "P"'s font size.
const marks = (page) => page.evaluate((nodeOfSrc) => {
  const nodeOf = eval(nodeOfSrc);
  const out = {};
  for (const ext of ['3', '4', '5', '6', '7', '8']) {
    const g = nodeOf(ext).getGraphics();
    const p = g.getUnbornShape();
    const pBox = p && p.node ? p.node.getBBox() : null;
    const markBox = g._carrierGraphic ? g._carrierGraphic.getBBox() : null;
    out[ext] = {
      pSize: pBox ? Number(p.attr('font-size')) : null,
      hasMark: !!markBox,
      overlap: !!(pBox && markBox
        && pBox.x < markBox.x + markBox.width && markBox.x < pBox.x + pBox.width
        && pBox.y < markBox.y + markBox.height && markBox.y < pBox.y + pBox.height),
    };
  }
  return out;
}, NODE_OF);

test('an unborn carrier or pre-symptomatic person shows the "P" and the mark without overlap', async ({ page }) => {
  await newEditorWithFamily(page);
  await page.evaluate((nodeOfSrc) => {
    const nodeOf = eval(nodeOfSrc);
    for (const ext of ['3', '4', '5', '6', '7', '8']) {
      const node = nodeOf(ext);
      node.setLifeStatus('unborn');
      node.setCarrierStatus(Number(ext) <= 5 ? 'carrier' : 'presymptomatic');
    }
  }, NODE_OF);

  const drawn = await marks(page);
  for (const ext of ['3', '4', '5', '6', '7', '8']) {
    expect(drawn[ext], `child ${ext}`).toEqual({ pSize: 30, hasMark: true, overlap: false });
  }
});

test('the "P" and the mark are redrawn when either status changes', async ({ page }) => {
  await newEditorWithFamily(page);
  const set = (ext, change) => page.evaluate(([nodeOfSrc, e, c]) => {
    const node = eval(nodeOfSrc)(e);
    if (c.lifeStatus) {
      node.setLifeStatus(c.lifeStatus);
    }
    if (c.carrierStatus !== undefined) {
      node.setCarrierStatus(c.carrierStatus);
    }
  }, [NODE_OF, ext, change]);

  // carrier first, then unborn: the mark set before the "P" still makes room for it
  await set('3', { carrierStatus: 'carrier' });
  await set('3', { lifeStatus: 'unborn' });
  expect((await marks(page))['3']).toEqual({ pSize: 30, hasMark: true, overlap: false });

  // no longer a carrier: the full-size "P" comes back
  await set('3', { carrierStatus: '' });
  expect((await marks(page))['3']).toEqual({ pSize: 50, hasMark: false, overlap: false });

  // a carrier again, then born: no "P", and the dot is back at the centre of the shape
  await set('3', { carrierStatus: 'carrier' });
  await set('3', { lifeStatus: 'alive' });
  const born = await page.evaluate((nodeOfSrc) => {
    const g = eval(nodeOfSrc)('3').getGraphics();
    const p = g.getUnbornShape();
    return { pDrawn: !!(p && p.node), dotOffset: Math.round(g._carrierGraphic.attr('cy') - g.getY()) };
  }, NODE_OF);
  expect(born).toEqual({ pDrawn: false, dotOffset: 0 });

  // to a miscarriage and back (the shape itself is redrawn): the dot and the small "P" come back right
  await set('5', { carrierStatus: 'carrier' });
  await set('5', { lifeStatus: 'miscarriage' });
  expect((await marks(page))['5']).toEqual({ pSize: null, hasMark: true, overlap: false });
  await set('5', { lifeStatus: 'unborn' });
  expect((await marks(page))['5']).toEqual({ pSize: 30, hasMark: true, overlap: false });

  // exactly one "P" per unborn person (children 4 and 5) is left on the canvas (none orphaned by the redraws)
  await set('4', { lifeStatus: 'unborn' });
  const pCount = await page.evaluate(() => [...document.querySelectorAll('#canvas svg text')]
    .filter((t) => t.textContent === 'P').length);
  expect(pCount).toBe(2);
});
