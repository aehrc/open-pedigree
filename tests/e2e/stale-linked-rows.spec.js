import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

// Covers pedigree-editor-stale-linked-rows: on opening a saved pedigree, an editor whose
// record-link provider has fetchLinkedRows asks for every linked person's record at once, marks
// the people whose records changed since the pedigree last took them in, and offers to update them.

const NOTICE = '#linked-records-notice';
const MARK = '.linked-record-changed-mark';

const RUTH = 'record:1/instance:1';
const SAM = 'record:1/instance:2';

// The answers each person was linked with - what the saved pedigree took in (its snapshots).
const LINKED = {
  [RUTH]: [{ linkId: 'first_name', value: 'Ruth' }, { linkId: 'last_name', value: 'Sample' }],
  [SAM]: [{ linkId: 'first_name', value: 'Sam' }, { linkId: 'last_name', value: 'Sample' }],
};

/**
 * Builds a saved pedigree of three people, Ruth and Sam linked (with `LINKED`'s answers, then
 * `diagramEdits` made in the diagram), and opens it in a new editor whose provider answers
 * fetchLinkedRows with `rows` (a value, 'reject', or omitted for a provider without the method).
 */
async function openSavedPedigree(page, { rows, rowsLater, diagramEdits, extraLinks, configured = true } = {}) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await retireAutoCreatedEditor(page);
  const saved = await page.evaluate(({ linked, edits, extra }) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const builder = window.OpenPedigree.initialiseEditor({});
    window.editor = builder;
    builder.getSaveLoadEngine().createGraphFromImportData(
      'fam1 f 0 0 1 1\nfam1 m 0 0 2 1\nfam1 c f m 1 1', 'ped', {}, true, true);
    const map = builder.getView().getNodeMap();
    const people = Object.keys(map).filter((id) => map[id].getType && map[id].getType() === 'Person').map(Number);
    builder._applyLinkedRecord(people[1], Object.keys(linked)[0], linked[Object.keys(linked)[0]]);
    builder._applyLinkedRecord(people[2], Object.keys(linked)[1], linked[Object.keys(linked)[1]]);
    // More links: { person, ref, answers } (answers null: the ref only, an empty snapshot).
    (extra || []).forEach((link) => builder._applyLinkedRecord(people[link.person], link.ref, link.answers || undefined));
    (edits || []).forEach((edit) => {
      document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
        detail: { nodeID: people[edit.person], properties: edit.properties },
      }));
    });
    return builder.getGraph().toJSON();
  }, { linked: LINKED, edits: diagramEdits || [], extra: extraLinks || [] });

  await retireAutoCreatedEditor(page);
  await page.evaluate(({ json, rowsAnswer, laterAnswer, hasMethod, isConfigured }) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    // The page's own editor opened with nothing to load, so its template chooser is still up.
    document.querySelectorAll('.msdialog-modal-container').forEach((el) => el.remove());
    window.__fetchCalls = [];
    const provider = {
      isConfigured: () => isConfigured,
      canLink: () => true,
      canCreateNew: () => true,
      openPicker: () => {},
      openEditor: () => {},
      createNew: () => {},
    };
    if (hasMethod) {
      provider.fetchLinkedRows = (refs) => {
        window.__fetchCalls.push(refs);
        // The first call is the check on opening; later ones (Update) get `rowsLater` if given.
        const answer = window.__fetchCalls.length > 1 && laterAnswer ? laterAnswer : rowsAnswer;
        return answer === 'reject' ? Promise.reject(new Error('network down')) : Promise.resolve(answer);
      };
    }
    window.editor = window.OpenPedigree.initialiseEditor({
      recordLinkProvider: provider,
      backend: {
        load: (args) => args.onSuccess(json),
        save: () => {},
      },
    });
  }, { json: saved, rowsAnswer: rows === undefined ? null : rows, laterAnswer: rowsLater || null, hasMethod: rows !== undefined, isConfigured: configured });
  await page.waitForTimeout(300);
}

function personNamed(page, firstName) {
  return page.evaluate((name) => {
    const map = window.editor.getView().getNodeMap();
    const id = Object.keys(map).find((i) => map[i].getType && map[i].getType() === 'Person' && map[i].getFirstName() === name);
    return id === undefined ? null : Number(id);
  }, firstName);
}

function firstNames(page) {
  return page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    return Object.keys(map).filter((i) => map[i].getType && map[i].getType() === 'Person')
      .map((i) => map[i].getFirstName()).sort();
  });
}

test('a person whose record changed is marked, and Update brings the record in as an undoable change', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: {
      [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] },
      [SAM]: { answers: LINKED[SAM] },
    },
  });

  expect(await page.evaluate(() => window.__fetchCalls)).toEqual([[RUTH, SAM]]);
  await expect(page.locator(NOTICE)).toContainText('1 person\'s linked record has changed since this pedigree was saved.');
  await expect(page.locator(MARK)).toHaveCount(1);
  expect(await firstNames(page)).toEqual(['', 'Ruth', 'Sam']);

  await page.locator(`${NOTICE} button`, { hasText: 'Update' }).click();
  await expect(page.locator(NOTICE)).toHaveCount(0);
  await expect(page.locator(MARK)).toHaveCount(0);
  expect(await firstNames(page)).toEqual(['', 'Ruthie', 'Sam']);
  const snapshot = await page.evaluate((id) => window.editor.getView().getNode(id).getLinkedRecordSnapshot(), await personNamed(page, 'Ruthie'));
  expect(snapshot.first_name).toBe('Ruthie');

  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
  expect(await firstNames(page)).toEqual(['', 'Ruth', 'Sam']);
});

test('nothing is shown when no linked record has changed', async ({ page }) => {
  await openSavedPedigree(page, { rows: { [RUTH]: { answers: LINKED[RUTH] }, [SAM]: { answers: LINKED[SAM] } } });

  expect(await page.evaluate(() => window.__fetchCalls.length)).toBe(1);
  await expect(page.locator(NOTICE)).toHaveCount(0);
  await expect(page.locator(MARK)).toHaveCount(0);
});

test('a value changed in the diagram is not a change to the record', async ({ page }) => {
  await openSavedPedigree(page, {
    diagramEdits: [{ person: 1, properties: { setFirstName: 'Ruth Ann' } }],
    rows: { [RUTH]: { answers: LINKED[RUTH] }, [SAM]: { answers: LINKED[SAM] } },
  });

  await expect(page.locator(NOTICE)).toHaveCount(0);
  expect(await firstNames(page)).toEqual(['', 'Ruth Ann', 'Sam']);
});

test('a provider without fetchLinkedRows is not asked and nothing is shown', async ({ page }) => {
  await openSavedPedigree(page);
  await expect(page.locator(NOTICE)).toHaveCount(0);
  await expect(page.locator(MARK)).toHaveCount(0);
});

test('a provider that is not configured is not asked and nothing is shown', async ({ page }) => {
  await openSavedPedigree(page, { rows: { [RUTH]: { missing: true } }, configured: false });
  expect(await page.evaluate(() => window.__fetchCalls.length)).toBe(0);
  await expect(page.locator(NOTICE)).toHaveCount(0);
});

test('Dismiss removes the notice and marks without changing anyone', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] } },
  });
  await expect(page.locator(MARK)).toHaveCount(1);

  await page.locator(`${NOTICE} button`, { hasText: 'Dismiss' }).click();
  await expect(page.locator(NOTICE)).toHaveCount(0);
  await expect(page.locator(MARK)).toHaveCount(0);
  expect(await firstNames(page)).toEqual(['', 'Ruth', 'Sam']);
});

test('missing rows and other-record links are named, and not offered for update', async ({ page }) => {
  await openSavedPedigree(page, { rows: { [RUTH]: { missing: true }, [SAM]: { otherRecord: true } } });

  await expect(page.locator(NOTICE)).toContainText('Linked to a record that no longer exists: Ruth Sample.');
  await expect(page.locator(NOTICE)).toContainText('Linked to another record\'s rows, so not checked - link them again: Sam Sample.');
  await expect(page.locator(`${NOTICE} button`, { hasText: 'Update' })).toHaveCount(0);
  await expect(page.locator(MARK)).toHaveCount(0);
});

test('a failed fetch is quiet apart from a console warning', async ({ page }) => {
  const warnings = [];
  page.on('console', (msg) => msg.type() === 'warning' && warnings.push(msg.text()));
  await openSavedPedigree(page, { rows: 'reject' });

  await expect(page.locator(NOTICE)).toHaveCount(0);
  expect(warnings.some((w) => w.includes('Checking linked records for changes failed'))).toBe(true);
});

test('a marked person re-linked before Update loses the mark and is left alone', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: {
      [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] },
      [SAM]: { answers: [{ linkId: 'first_name', value: 'Samuel' }, { linkId: 'last_name', value: 'Sample' }] },
    },
  });
  await expect(page.locator(NOTICE)).toContainText('2 people\'s linked records have changed');
  await expect(page.locator(MARK)).toHaveCount(2);

  const ruth = await personNamed(page, 'Ruth');
  await page.evaluate((id) => window.editor._applyLinkedRecord(id, 'record:1/instance:7', [{ linkId: 'first_name', value: 'Rita' }]), ruth);
  await expect(page.locator(NOTICE)).toContainText('1 person\'s linked record has changed');
  await expect(page.locator(MARK)).toHaveCount(1);

  await page.locator(`${NOTICE} button`, { hasText: 'Update' }).click();
  expect(await firstNames(page)).toEqual(['', 'Rita', 'Samuel']);
});

test('Update leaves the lines about rows it can\'t update until they are dismissed', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: {
      [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] },
      [SAM]: { missing: true },
    },
  });
  await page.locator(`${NOTICE} button`, { hasText: 'Update' }).click();

  await expect(page.locator(NOTICE)).toContainText('Linked to a record that no longer exists: Sam Sample.');
  await expect(page.locator(NOTICE)).not.toContainText('changed since');
  await expect(page.locator(`${NOTICE} button`, { hasText: 'Update' })).toHaveCount(0);
  await expect(page.locator(MARK)).toHaveCount(0);
  await page.locator(`${NOTICE} button`, { hasText: 'Dismiss' }).click();
  await expect(page.locator(NOTICE)).toHaveCount(0);
});

test('undoing a re-link puts the person\'s mark back', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] } },
  });
  const ruth = await personNamed(page, 'Ruth');
  await page.evaluate((id) => window.editor._applyLinkedRecord(id, 'record:1/instance:7', [{ linkId: 'first_name', value: 'Rita' }]), ruth);
  await expect(page.locator(MARK)).toHaveCount(0);
  await expect(page.locator(NOTICE)).toHaveCount(0);

  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
  await expect(page.locator(MARK)).toHaveCount(1);
  await expect(page.locator(NOTICE)).toContainText('1 person\'s linked record has changed');
});

test('two people linked to one row are each counted and named once', async ({ page }) => {
  await openSavedPedigree(page, {
    extraLinks: [{ person: 0, ref: RUTH, answers: LINKED[RUTH] }],
    rows: { [RUTH]: { missing: true }, [SAM]: { answers: LINKED[SAM] } },
  });
  await expect(page.locator(NOTICE)).toContainText('Linked to a record that no longer exists: Ruth Sample, Ruth Sample.');
});

test('a person with nothing taken in yet loses the mark once the diagram matches the record', async ({ page }) => {
  const ROW = 'record:1/instance:3';
  await openSavedPedigree(page, {
    extraLinks: [{ person: 0, ref: ROW, answers: null }],
    rows: { [ROW]: { answers: [{ linkId: 'first_name', value: 'Dev' }] }, [RUTH]: { answers: LINKED[RUTH] }, [SAM]: { answers: LINKED[SAM] } },
  });
  await expect(page.locator(MARK)).toHaveCount(1);

  const dev = await personNamed(page, '');
  await page.evaluate((id) => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
    detail: { nodeID: id, properties: { setFirstName: 'Dev' } },
  })), dev);
  await expect(page.locator(MARK)).toHaveCount(0);
  await expect(page.locator(NOTICE)).toHaveCount(0);
});

test('a person with nothing taken in yet, already showing the record\'s values, is not reported', async ({ page }) => {
  const ROW = 'record:1/instance:3';
  await openSavedPedigree(page, {
    extraLinks: [{ person: 0, ref: ROW, answers: null }],
    diagramEdits: [{ person: 0, properties: { setFirstName: 'Dev' } }],
    rows: { [ROW]: { answers: [{ linkId: 'first_name', value: 'Dev' }] }, [RUTH]: { answers: LINKED[RUTH] }, [SAM]: { answers: LINKED[SAM] } },
  });
  await expect(page.locator(NOTICE)).toHaveCount(0);
  await expect(page.locator(MARK)).toHaveCount(0);
});

test('Update fetches the records again and applies what they hold now', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] } },
    rowsLater: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruth Ann' }, { linkId: 'last_name', value: 'Sample' }] } },
  });
  await page.locator(`${NOTICE} button`, { hasText: 'Update' }).click();
  await expect(page.locator(NOTICE)).toHaveCount(0);
  expect(await page.evaluate(() => window.__fetchCalls)).toEqual([[RUTH, SAM], [RUTH]]);
  expect(await firstNames(page)).toEqual(['', 'Ruth Ann', 'Sam']);
});

test('undoing Update puts the marks and the Update offer back', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] } },
  });
  await page.locator(`${NOTICE} button`, { hasText: 'Update' }).click();
  await expect(page.locator(MARK)).toHaveCount(0);

  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pedigree:undo')));
  await expect(page.locator(MARK)).toHaveCount(1);
  await expect(page.locator(`${NOTICE} button`, { hasText: 'Update' })).toHaveCount(1);
});

test('a field the Questionnaire in effect no longer has is not counted as a change', async ({ page }) => {
  // Ruth's snapshot still holds an item since removed from the Questionnaire; her record's value
  // for it has changed, but the refresh leaves such fields out, so nothing she shows would change.
  await openSavedPedigree(page, {
    diagramEdits: [{ person: 1, properties: { setLinkedRecordSnapshot: { first_name: 'Ruth', last_name: 'Sample', removed_item: 'old' } } }],
    rows: {
      [RUTH]: { answers: [...LINKED[RUTH], { linkId: 'removed_item', value: 'new' }] },
      [SAM]: { answers: LINKED[SAM] },
    },
  });
  await expect(page.locator(NOTICE)).toHaveCount(0);
  await expect(page.locator(MARK)).toHaveCount(0);
});

test('pointing at the mark keeps the person\'s hover box working and shows the mark\'s tooltip', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] } },
  });
  const box = await page.locator(MARK).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(5, 300);
  await page.mouse.move(x, y, { steps: 10 });
  await page.waitForTimeout(500);

  const under = await page.evaluate(({ px, py }) => {
    const el = document.elementFromPoint(px, py);
    const title = el && el.querySelector('title');
    return title ? title.textContent : null;
  }, { px: x, py: y });
  expect(under).toBe('This person\'s linked record has changed since this pedigree was saved');
  const ruth = await personNamed(page, 'Ruth');
  expect(await page.evaluate((id) => !window.editor.getView().getNode(id).getGraphics().getHoverBox()._hidden, ruth)).toBe(true);
});

test('a person whose record matches the diagram is marked once the diagram is edited away from it', async ({ page }) => {
  // The record changed Ruth to Ruthie since the save, and the diagram already says Ruthie.
  await openSavedPedigree(page, {
    diagramEdits: [{ person: 1, properties: { setFirstName: 'Ruthie' } }],
    rows: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] } },
  });
  await expect(page.locator(NOTICE)).toHaveCount(0);

  const ruth = await personNamed(page, 'Ruthie');
  await page.evaluate((id) => document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
    detail: { nodeID: id, properties: { setFirstName: 'Rue' } },
  })), ruth);
  await expect(page.locator(MARK)).toHaveCount(1);
  await expect(page.locator(NOTICE)).toContainText('1 person\'s linked record has changed');
});

test('a record deleted between opening and Update is reported as no longer existing', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] } },
    rowsLater: { [RUTH]: { missing: true } },
  });
  await page.locator(`${NOTICE} button`, { hasText: 'Update' }).click();
  await expect(page.locator(NOTICE)).toContainText('Linked to a record that no longer exists: Ruth Sample.');
  await expect(page.locator(MARK)).toHaveCount(0);
  expect(await firstNames(page)).toEqual(['', 'Ruth', 'Sam']);
});

test('the mark stays over the person\'s shape when the shape is redrawn', async ({ page }) => {
  await openSavedPedigree(page, {
    rows: { [RUTH]: { answers: [{ linkId: 'first_name', value: 'Ruthie' }, { linkId: 'last_name', value: 'Sample' }] } },
  });
  const ruth = await personNamed(page, 'Ruth');
  // As a gender or proband change does.
  await page.evaluate((id) => window.editor.getView().getNode(id).getGraphics().setGenderGraphics(), ruth);
  const markAboveShape = await page.evaluate((id) => {
    const graphics = window.editor.getView().getNode(id).getGraphics();
    const shape = graphics.getGenderShape().node;
    const mark = document.querySelector('.linked-record-changed-mark');
    return !!(shape.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, ruth);
  expect(markAboveShape).toBe(true);
});
