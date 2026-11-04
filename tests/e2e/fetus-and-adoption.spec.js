import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// A stillborn fetus with a date of death, and an adopted child, saved in GA4GH FHIR through the
// local-storage backend (as redcap_pedigree_editor saves) and opened again
// (pedigree-editor-fetus-and-adoption-fidelity).

const DATA_URL = 'local:fetusAndAdoption?format=GA4GH';

function newEditor(page) {
  return page.evaluate((dataUrl) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({ backend: window.OpenPedigree.localStorageBackend, patientDataUrl: dataUrl });
  }, DATA_URL);
}

const byName = (page) => page.evaluate(() => {
  const found = {};
  for (const node of Object.values(window.editor.getView().getNodeMap())) {
    if (node.getType && node.getType() === 'Person' && node.getFirstName()) {
      const dod = node.getDeathDate();
      found[node.getFirstName()] = {
        lifeStatus: node.getLifeStatus(),
        gestationAge: node.getGestationAge(),
        dod: dod ? `${dod.getFullYear()}-${dod.getMonth() + 1}-${dod.getDate()}` : null,
        adopted: node.getAdopted(),
        parents: window.editor.getGraph().DG.GG.getParents(node.getID())
          .map((id) => window.editor.getView().getNode(id).getFirstName() || '?').sort(),
      };
    }
  }
  return found;
});

test('a stillborn fetus with a date of death, and an adopted child, survive a save and reopen', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => localStorage.removeItem('fetusAndAdoption'));
  await retireAutoCreatedEditor(page);
  await newEditor(page);
  await page.evaluate(() => {
    // John and Jane, with a stillborn fetus (30 weeks, with a date of death - set after its status,
    // as a load or a linked record sets them) and an adopted son.
    const ped = 'fam 1 0 0 1 1\nfam 2 0 0 2 1\nfam 3 1 2 0 1\nfam 4 1 2 1 1';
    window.editor.getSaveLoadEngine().createGraphFromImportData(ped, 'ped', { externalIdMark: true }, true, true);
    const graph = window.editor.getGraph();
    const nodeOf = (externalID) => {
      for (let id = 0; id <= graph.getMaxNodeId(); id++) {
        if (graph.isPerson(id) && graph.getProperties(id).externalID === externalID) {
          return window.editor.getView().getNode(id);
        }
      }
      return null;
    };
    const set = (node, change) => {
      change(node);
      graph.setProperties(node.getID(), node.getProperties());
    };
    set(nodeOf('1'), (n) => n.setFirstName('John'));
    set(nodeOf('2'), (n) => n.setFirstName('Jane'));
    set(nodeOf('3'), (n) => { n.setFirstName('Fetus'); n.setLifeStatus('stillborn'); n.setGestationAge('30'); n.setDeathDate('2020-03-04'); });
    set(nodeOf('4'), (n) => { n.setFirstName('Sam'); n.setAdopted(true); });
  });
  const before = await byName(page);
  expect(before.Fetus).toMatchObject({ lifeStatus: 'stillborn', gestationAge: 30, dod: '2020-3-4' });
  expect(before.Sam).toMatchObject({ adopted: true, parents: ['Jane', 'John'] });

  await page.evaluate((url) => window.editor.getSaveLoadEngine().save(url), DATA_URL);
  await retireAutoCreatedEditor(page);
  await newEditor(page);

  const after = await byName(page);
  expect(after.Fetus).toEqual(before.Fetus);
  expect(after.Sam).toEqual(before.Sam);
});
