import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// A partner without a child (pedigree-editor-partner-without-child): a couple with no children has a
// hidden placeholder child - nothing is drawn below them - in the editor, through undo and redo, and
// through a save and reopen.

async function newEditor(page, dataUrl) {
  await retireAutoCreatedEditor(page);
  await page.evaluate((url) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({ backend: window.OpenPedigree.localStorageBackend, patientDataUrl: url });
  }, dataUrl);
  await expect.poll(() => page.evaluate(() => !window.editor.isAwaitingFirstLoad())).toBe(true);
  await page.evaluate(() => document.querySelectorAll('.msdialog-modal-container, .msdialog-screen').forEach((el) => el.remove()));
}

async function open(page, dataUrl, ped) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });
  await page.evaluate((key) => window.localStorage.removeItem(key), dataUrl.split(':')[1].split('?')[0]);
  await newEditor(page, dataUrl);
  if (ped) {
    // (an undo step, as the editor's own load is)
    await page.evaluate((text) => window.editor.getSaveLoadEngine().createGraphFromImportData(text, 'ped', { externalIdMark: true }, false, true), ped);
  }
}

// The graph as people, couples and their real children, for comparing (ids change).
const shape = (page) => page.evaluate(() => {
  const graph = window.editor.getGraph();
  const name = (v) => graph.getProperties(v).externalID || graph.getProperties(v).fName || ('#' + v);
  const out = { people: [], couples: [], placeholders: 0 };
  for (let v = 0; v <= graph.getMaxNodeId(); v++) {
    if (graph.isPlaceholder(v)) {
      out.placeholders++;
    } else if (graph.isPerson(v)) {
      out.people.push(name(v));
    } else if (graph.isRelationship(v)) {
      const children = graph.getAllChildren(v);
      out.couples.push({
        partners: graph.DG.GG.getParents(v).map(name).sort().join('+'),
        children: children.filter((c) => !graph.isPlaceholder(c)).map(name).sort(),
        placeholder: children.some((c) => graph.isPlaceholder(c)),
      });
    }
  }
  out.people.sort();
  out.couples.sort((a, b) => a.partners.localeCompare(b.partners));
  return out;
});

const personByExt = '(ext) => { const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) if (g.isPerson(v) && g.getProperties(v).externalID === ext) return v; return null; }';

// Whatever is drawn for placeholders, and below their couples, that can be seen.
const visibleForPlaceholders = (page) => page.evaluate(() => {
  const graph = window.editor.getGraph(); const view = window.editor.getView();
  let visible = 0;
  for (let v = 0; v <= graph.getMaxNodeId(); v++) {
    if (!graph.isPlaceholder(v)) {
      continue;
    }
    const graphics = view.getNode(v).getGraphics();
    const elements = graphics.getAllGraphics().items
      .concat(graphics.getHoverBox() ? graphics.getHoverBox().getFrontElements().items.concat(graphics.getHoverBox().getBackElements().items) : []);
    visible += elements.filter((el) => el.node && el.node.style.display !== 'none' && el.node.getAttribute('display') !== 'none').length;
  }
  return visible;
});

// The lines a couple draws down to its children.
const childLines = (page, rel) => page.evaluate((rel) => {
  const conn = window.editor.getView().getNode(rel).getGraphics()._childhubConnection;
  return conn ? conn.items.length : 0;
}, rel);

test('the partner handle adds a partner with no child, drawn with nothing below the couple', async ({ page }) => {
  await open(page, 'local:pwc1?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate((src) => {
    const node = window.editor.getView().getNode(eval(src)('1'));
    node.getGraphics().getHoverBox().handleAction('partnerR', false, null);
  }, personByExt);
  const s = await shape(page);
  expect(s.people.length).toBe(2);
  expect(s.couples).toEqual([{ partners: expect.stringContaining('1'), children: [], placeholder: true }]);
  expect(await visibleForPlaceholders(page)).toBe(0);
  const rel = await page.evaluate(() => {
    const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isRelationship(v)) {
        return v;
      }
    } return null; 
  });
  expect(await childLines(page, rel)).toBe(0);
  // nothing below the couple can be hovered: the placeholder contains no point
  expect(await page.evaluate(() => {
    const g = window.editor.getGraph(); const v = window.editor.getView();
    for (let i = 0; i <= g.getMaxNodeId(); i++) {
      if (g.isPlaceholder(i)) {
        const n = v.getNode(i).getGraphics(); return n.containsXY(n.getX(), n.getY()); 
      }
    } return null; 
  })).toBe(false);
});

test('the child handle still adds a partner and a child', async ({ page }) => {
  await open(page, 'local:pwc2?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate((src) => {
    const bubble = window.editor.getNodetypeSelectionBubble();
    bubble._node = window.editor.getView().getNode(eval(src)('1'));
    bubble.handleCreateAction({ params: { parameters: { gender: 'F' } } });
  }, personByExt);
  const s = await shape(page);
  expect(s.placeholders).toBe(0);
  expect(s.couples.length).toBe(1);
  expect(s.couples[0].children.length).toBe(1);
});

test('dragging the partner handle onto a person makes a couple with no child', async ({ page }) => {
  // 3 and 4 are siblings' children (cousins), not yet partners
  await open(page, 'local:pwc3?format=GA4GH', 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1\nf 4 1 2 2 1\nf 5 0 0 2 1\nf 6 3 5 1 1\nf 7 0 0 1 1\nf 8 7 4 2 1');
  await page.evaluate((src) => {
    const find = eval(src);
    window.editor.getView().getNode(find('6')).getGraphics().getHoverBox().handleAction('partnerR', true, find('8'));
  }, personByExt);
  const s = await shape(page);
  expect(s.couples.find((c) => c.partners === '6+8')).toEqual({ partners: '6+8', children: [], placeholder: true });
});

test('a couple\'s first child takes the placeholder\'s place, and twins come together', async ({ page }) => {
  await open(page, 'local:pwc4?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate((src) => window.editor.getView().getNode(eval(src)('1')).getGraphics().getHoverBox().handleAction('partnerR', false, null), personByExt);
  const rel = await page.evaluate(() => {
    const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isRelationship(v)) {
        return v;
      }
    } return null; 
  });
  await page.evaluate((rel) => document.dispatchEvent(new window.CustomEvent('pedigree:partnership:newchild', { detail: { partnershipID: rel, childParams: { gender: 'M' }, twins: 2 } })), rel);
  const s = await shape(page);
  expect(s.placeholders).toBe(0);
  expect(s.couples[0].children.length).toBe(2);
  expect(await childLines(page, rel)).toBeGreaterThan(0);
});

test('deleting a couple\'s only child keeps the couple, with no question about the partner', async ({ page }) => {
  const dialogs = [];
  await open(page, 'local:pwc5?format=GA4GH', 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
  page.on('dialog', (d) => dialogs.push(d.message()));
  await page.evaluate((src) => document.dispatchEvent(new window.CustomEvent('pedigree:node:remove', { detail: { nodeID: eval(src)('3') } })), personByExt);
  const s = await shape(page);
  expect(s.people).toEqual(['1', '2']);
  expect(s.couples).toEqual([{ partners: '1+2', children: [], placeholder: true }]);
  expect(dialogs).toEqual([]);
  expect(await visibleForPlaceholders(page)).toBe(0);
});

test('deleting a partner of a couple with no children removes the couple', async ({ page }) => {
  await open(page, 'local:pwc6?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate((src) => window.editor.getView().getNode(eval(src)('1')).getGraphics().getHoverBox().handleAction('partnerR', false, null), personByExt);
  const partner = await page.evaluate(() => {
    const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isPerson(v) && !g.isPlaceholder(v) && v !== 0) {
        return v;
      }
    } return null; 
  });
  await page.evaluate((id) => document.dispatchEvent(new window.CustomEvent('pedigree:node:remove', { detail: { nodeID: id } })), partner);
  expect(await shape(page)).toEqual({ people: ['1'], couples: [], placeholders: 0 });
});

test('undo and redo step through a couple with no children, its first child and its deletion', async ({ page }) => {
  await open(page, 'local:pwc7?format=GA4GH', 'f 1 0 0 1 1');
  const states = [await shape(page)];
  await page.evaluate((src) => window.editor.getView().getNode(eval(src)('1')).getGraphics().getHoverBox().handleAction('partnerR', false, null), personByExt);
  states.push(await shape(page));
  const rel = await page.evaluate(() => {
    const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isRelationship(v)) {
        return v;
      }
    } return null; 
  });
  await page.evaluate((rel) => document.dispatchEvent(new window.CustomEvent('pedigree:partnership:newchild', { detail: { partnershipID: rel, childParams: { gender: 'F', fName: 'Kid' } } })), rel);
  states.push(await shape(page));
  const kid = await page.evaluate(() => {
    const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isPerson(v) && g.getProperties(v).fName === 'Kid') {
        return v;
      }
    } return null; 
  });
  await page.evaluate((id) => document.dispatchEvent(new window.CustomEvent('pedigree:node:remove', { detail: { nodeID: id } })), kid);
  states.push(await shape(page));
  expect(states[3]).toEqual(states[1]);
  for (let i = states.length - 2; i >= 0; i--) {
    await page.evaluate(() => window.editor.getActionStack().undo());
    expect(await shape(page), 'undo to state ' + i).toEqual(states[i]);
  }
  for (let i = 1; i < states.length; i++) {
    await page.evaluate(() => window.editor.getActionStack().redo());
    expect(await shape(page), 'redo to state ' + i).toEqual(states[i]);
  }
  expect(await visibleForPlaceholders(page)).toBe(0);
});

test('a couple with no children can be marked childless', async ({ page }) => {
  await open(page, 'local:pwc8?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate((src) => window.editor.getView().getNode(eval(src)('1')).getGraphics().getHoverBox().handleAction('partnerR', false, null), personByExt);
  const rel = await page.evaluate(() => {
    const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isRelationship(v)) {
        return v;
      }
    } return null; 
  });
  const summary = await page.evaluate((rel) => window.editor.getView().getNode(rel).getSummary().childlessSelect, rel);
  expect(summary.inactive).toBe(false);
  await page.evaluate((rel) => document.dispatchEvent(new window.CustomEvent('pedigree:node:setproperty', { detail: { nodeID: rel, properties: { setChildlessStatus: 'infertile' } } })), rel);
  const drawn = await page.evaluate((rel) => {
    const n = window.editor.getView().getNode(rel); return { status: n.getChildlessStatus(), shape: !!n.getGraphics().getChildlessShape() }; 
  }, rel);
  expect(drawn).toEqual({ status: 'infertile', shape: true });
  // a child added to an infertile couple is adopted, and the mark stays
  await page.evaluate((rel) => document.dispatchEvent(new window.CustomEvent('pedigree:partnership:newchild', { detail: { partnershipID: rel, childParams: { gender: 'M', fName: 'Adoptee' } } })), rel);
  const after = await page.evaluate(() => {
    const g = window.editor.getGraph(); for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isPerson(v) && g.getProperties(v).fName === 'Adoptee') {
        return g.getProperties(v).isAdopted === true;
      }
    } return null; 
  });
  expect(after).toBe(true);
});

for (const format of ['GA4GH', 'PED', 'DADA2', 'internal']) {
  test(`a couple with no children survives a save and reopen (${format})`, async ({ page }) => {
    const url = `local:pwcSave${format}?format=${format}`;
    await open(page, url, 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1');
    // 3 gets a partner with no children (1 and 2 keep their child 3)
    await page.evaluate((src) => window.editor.getView().getNode(eval(src)('3')).getGraphics().getHoverBox().handleAction('partnerR', false, null), personByExt);
    const before = await shape(page);
    await page.evaluate((u) => window.editor.getSaveLoadEngine().save(u), url);
    await newEditor(page, url);
    const after = await shape(page);
    expect(after.placeholders).toBe(1);
    // (PED and DADA2 renumber people, so couples are compared regardless of order)
    const couples = (s) => s.couples.map((c) => c.children.length + (c.placeholder ? '+placeholder' : '')).sort();
    expect(couples(after)).toEqual(couples(before));
    expect(after.people.length).toBe(before.people.length);
    expect(await visibleForPlaceholders(page)).toBe(0);
  });
}

test('a child of a couple with an infertile partner is adopted', async ({ page }) => {
  await open(page, 'local:pwc9?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate((src) => {
    const id = eval(src)('1');
    document.dispatchEvent(new window.CustomEvent('pedigree:node:setproperty', { detail: { nodeID: id, properties: { setChildlessStatus: 'infertile' } } }));
    window.editor.getView().getNode(id).getGraphics().getHoverBox().handleAction('partnerR', false, null);
  }, personByExt);
  const rel = await page.evaluate(() => {
    const g = window.editor.getGraph();
    for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isRelationship(v)) {
        return v;
      }
    }
    return null;
  });
  await page.evaluate((rel) => document.dispatchEvent(new window.CustomEvent('pedigree:partnership:newchild', { detail: { partnershipID: rel, childParams: { gender: 'F', fName: 'Kid' } } })), rel);
  const adopted = await page.evaluate(() => {
    const g = window.editor.getGraph();
    for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isPerson(v) && g.getProperties(v).fName === 'Kid') {
        return g.getProperties(v).isAdopted === true;
      }
    }
    return null;
  });
  expect(adopted).toBe(true);
});

test('dragging a person onto a couple with no children as their child centres on that person', async ({ page }) => {
  // 3 gets a partner with no children (a placeholder); then 4 gets a partner, Q, made after that
  // placeholder - so Q's ID shifts when the placeholder goes - and Q is made 3's couple's child
  await open(page, 'local:pwc10?format=GA4GH', 'f 1 0 0 1 1\nf 2 0 0 2 1\nf 3 1 2 1 1\nf 4 1 2 2 1');
  await page.evaluate((src) => window.editor.getView().getNode(eval(src)('3')).getGraphics().getHoverBox().handleAction('partnerR', false, null), personByExt);
  await page.evaluate((src) => window.editor.getView().getNode(eval(src)('4')).getGraphics().getHoverBox().handleAction('partnerR', false, null), personByExt);
  const result = await page.evaluate((src) => {
    const find = eval(src);
    const g = window.editor.getGraph();
    const coupleOf = (p) => g.DG.GG.getAllRelationships(p)[0];
    const couple = coupleOf(find('3'));
    const q = g.DG.GG.getParents(coupleOf(find('4'))).find((p) => p !== find('4'));
    g.setProperties(q, { ...g.getProperties(q), fName: 'Q' });
    const placeholder = g.getAllChildren(couple).find((c) => g.isPlaceholder(c));
    const calls = [];
    const workspace = window.editor.getWorkspace();
    const original = workspace.centerAroundNode.bind(workspace);
    workspace.centerAroundNode = (id, animate) => {
      calls.push(id);
      return original(id, animate);
    };
    document.dispatchEvent(new window.CustomEvent('pedigree:person:drag:newparent', { detail: { personID: q, parentID: couple } }));
    let qNow = null;
    for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isPerson(v) && g.getProperties(v).fName === 'Q') {
        qNow = v;
      }
    }
    return { calls, qBefore: q, qNow, placeholderBefore: placeholder };
  }, personByExt);
  // (Q's ID did shift)
  expect(result.qBefore).toBeGreaterThan(result.placeholderBefore);
  expect(result.qNow).toBe(result.qBefore - 1);
  expect(result.calls).toEqual([result.qNow]);
});

test('a placeholder stays hidden when its properties are applied again', async ({ page }) => {
  await open(page, 'local:pwc11?format=GA4GH', 'f 1 0 0 1 1');
  await page.evaluate((src) => window.editor.getView().getNode(eval(src)('1')).getGraphics().getHoverBox().handleAction('partnerR', false, null), personByExt);
  await page.evaluate(() => {
    const g = window.editor.getGraph();
    for (let v = 0; v <= g.getMaxNodeId(); v++) {
      if (g.isPlaceholder(v)) {
        const node = window.editor.getView().getNode(v);
        node.assignProperties(g.getProperties(v));
        node.setGender('M');
        node.setLifeStatus('deceased');
        node.getGraphics().drawLabels();
      }
    }
  });
  expect(await visibleForPlaceholders(page)).toBe(0);
});
