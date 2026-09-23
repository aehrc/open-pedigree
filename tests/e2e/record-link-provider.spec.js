import { test, expect } from '@playwright/test';

// Covers record-link-provider: a new AbstractRecordLinkProvider sibling to
// AbstractPatientProvider (link/create-new/edit lifecycle for a linked external record), the
// generic questionnaire-linked-record-source extension (always-disabled rendering, standalone
// of any provider), and the reserved "Linked Record" tab that regroups those items alongside
// the provider's actions - see openspec/changes/record-link-provider.

const LINKED_RECORD_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-linked-record-test',
  version: '1.0',
  item: [
    {
      linkId: 'demographics', type: 'group', text: 'Demographics',
      item: [
        { linkId: 'notes', type: 'string', text: 'Notes' },
        {
          linkId: 'ext_field_a', type: 'string', text: 'External field A',
          extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }],
        },
      ],
    },
    {
      linkId: 'medical_history', type: 'group', text: 'Medical History',
      item: [
        {
          linkId: 'ext_field_b', type: 'string', text: 'External field B',
          extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }],
        },
        {
          linkId: 'disorders', type: 'choice', text: 'Disorders', repeats: true,
          answerValueSet: 'http://purl.bioontology.org/ontology/OMIM',
          extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping', valueCode: 'mapsToLegendCondition' }],
        },
      ],
    },
  ],
};

const VISIBLE_MENU = '.menu-box:visible';

async function loadEditor(page, { recordLinkProvider, questionnaire, actionLabels } = {}) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await page.evaluate(({ q, hasProvider, labels }) => {
    // See questionnaire-fields.spec.js for why #work-area (not just #canvas) needs removing.
    document.querySelectorAll('#work-area').forEach((el) => el.remove());

    const options = { questionnaireLocal: q };
    if (hasProvider) {
      options.recordLinkProvider = {
        isConfigured: () => true,
        canLink: () => true,
        canCreateNew: () => true,
        openPicker: (_nodeId, onLinked) => {
          window.__pendingLink && onLinked(window.__pendingLink.ref, window.__pendingLink.details);
        },
        openEditor: (_nodeId, onDone) => {
          window.__pendingEditAnswers && onDone(window.__pendingEditAnswers);
        },
        createNew: (_nodeId, onCreated) => {
          window.__pendingCreate && onCreated(window.__pendingCreate.ref, window.__pendingCreate.answers);
        },
      };
      if (labels) {
        options.recordLinkProvider.getActionLabel = (action) => labels[action];
      }
    }

    const newEditor = window.OpenPedigree.initialiseEditor(options);
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  }, { q: questionnaire || LINKED_RECORD_QUESTIONNAIRE, hasProvider: !!recordLinkProvider, labels: actionLabels || null });
  await page.waitForTimeout(300);
}

async function openNodeMenuForProband(page) {
  return page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const personId = Object.keys(map).find(id => map[id].getType && map[id].getType() === 'Person');
    const node = map[personId];
    window.editor.getNodeMenu().show(node, 100, 100);
    return personId;
  });
}

// Dispatches a real click inside the visible menu box, bypassing Playwright's actionability
// checks - see the full-flow test below for why (an unrelated fixed-position dialog container
// can intercept a real pointer click, matching questionnaire-source-of-truth.spec.js's radio test).
async function clickInVisibleMenu(page, selector) {
  await page.evaluate((sel) => {
    const visibleMenu = Array.from(document.querySelectorAll('.menu-box'))
      .find((el) => getComputedStyle(el).display !== 'none');
    visibleMenu.querySelector(sel).dispatchEvent(new Event('click', { bubbles: true }));
  }, selector);
}

async function switchToLinkedRecordTab(page) {
  await page.evaluate(() => {
    const visibleMenu = Array.from(document.querySelectorAll('.menu-box'))
      .find((el) => getComputedStyle(el).display !== 'none');
    Array.from(visibleMenu.querySelectorAll('.tabs dd a'))
      .find((a) => a.textContent === 'Linked Record')
      .dispatchEvent(new Event('click', { bubbles: true }));
  });
}

test('with no recordLinkProvider configured, the reserved tab is absent but linked-record items still render disabled on their original tab', async ({ page }) => {
  await loadEditor(page);
  await openNodeMenuForProband(page);

  await expect(page.locator('#tab___linked_record__')).toHaveCount(0);
  await expect(page.locator(`${VISIBLE_MENU} .field-ext_field_a`)).toBeAttached();
  await expect(page.locator(`${VISIBLE_MENU} #tab_demographics .field-ext_field_a`)).toBeAttached();
  await expect(page.locator(`${VISIBLE_MENU} .field-ext_field_a input[type=text]`)).toBeDisabled();
});

test('with a recordLinkProvider configured, linked-record items from two different groups regroup onto the reserved tab, sub-headed by their original group, while editable items stay on their own tabs', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true });
  await openNodeMenuForProband(page);

  await expect(page.locator('#tab___linked_record__')).toBeAttached();
  await expect(page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-ext_field_a`)).toBeAttached();
  await expect(page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-ext_field_b`)).toBeAttached();
  await expect(page.locator(`${VISIBLE_MENU} .field-ext_field_a input[type=text]`)).toBeDisabled();
  await expect(page.locator(`${VISIBLE_MENU} .field-ext_field_b input[type=text]`)).toBeDisabled();

  const headingLabels = await page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-heading .field-name`).allTextContents();
  expect(headingLabels).toEqual(['Demographics', 'Medical History']);

  // The editable item on the same authored tab as ext_field_a is unaffected.
  await expect(page.locator(`${VISIBLE_MENU} #tab_demographics .field-notes`)).toBeAttached();
  await expect(page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-notes`)).toHaveCount(0);

  // The Link/Create-new/Edit actions render at the top of the tab, before the regrouped
  // read-only fields (per linked-record-tab/spec.md), not after.
  const fieldOrder = await page.locator(`${VISIBLE_MENU} #tab___linked_record__ > div`).evaluateAll(
    (divs) => divs.map((d) => Array.from(d.classList).find((c) => c.startsWith('field-') && c !== 'field-box'))
  );
  expect(fieldOrder.indexOf('field-linkRecord')).toBeLessThan(fieldOrder.indexOf('field-ext_field_a'));
  expect(fieldOrder.indexOf('field-createNewRecord')).toBeLessThan(fieldOrder.indexOf('field-ext_field_a'));
  expect(fieldOrder.indexOf('field-editRecord')).toBeLessThan(fieldOrder.indexOf('field-ext_field_a'));
});

const NESTED_INTERRUPTED_GROUP_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-linked-record-nested-interrupted-test',
  version: '1.0',
  item: [{
    linkId: 'demographics', type: 'group', text: 'Demographics',
    item: [
      { linkId: 'ext_a', type: 'string', extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }] },
      { linkId: 'ext_b', type: 'string', extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }] },
      {
        linkId: 'subsection', type: 'group', text: 'Sub Section',
        item: [
          { linkId: 'ext_c1', type: 'string', extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }] },
        ],
      },
      // Authored as a direct Demographics child AFTER the nested Sub Section, so it lands
      // after ext_c1 in document order despite belonging to Demographics, not Sub Section.
      { linkId: 'ext_d', type: 'string', extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }] },
    ],
  }],
};

test('a group interrupted by a nested subgroup gets its own heading again, rather than mislabeling the later item under the subgroup', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: NESTED_INTERRUPTED_GROUP_QUESTIONNAIRE });
  await openNodeMenuForProband(page);

  const headingLabels = await page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-heading .field-name`).allTextContents();
  expect(headingLabels).toEqual(['Demographics', 'Sub Section', 'Demographics']);

  const fieldOrder = await page.locator(`${VISIBLE_MENU} #tab___linked_record__ > div`).evaluateAll(
    (divs) => divs.map((d) => Array.from(d.classList).find((c) => c.startsWith('field-') && c !== 'field-box'))
  );
  const demographicsHeadingIndices = fieldOrder
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c && c.startsWith('field-__linked_record_heading_demographics'))
    .map(({ i }) => i);
  expect(demographicsHeadingIndices.length).toBe(2);
  expect(fieldOrder.indexOf('field-ext_d')).toBeGreaterThan(demographicsHeadingIndices[1]);
  expect(fieldOrder.indexOf('field-ext_d')).toBeGreaterThan(fieldOrder.indexOf('field-ext_c1'));
});

test('the Edit action is only shown once a record is linked; Link/Create-new are gated by canLink/canCreateNew', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true });
  const personId = await openNodeMenuForProband(page);

  await expect(page.locator(`${VISIBLE_MENU} .field-linkRecord`)).not.toHaveClass(/hidden/);
  await expect(page.locator(`${VISIBLE_MENU} .field-createNewRecord`)).not.toHaveClass(/hidden/);
  await expect(page.locator(`${VISIBLE_MENU} .field-editRecord`)).toHaveClass(/hidden/);

  await page.evaluate((id) => {
    window.editor.getView().getNode(parseInt(id, 10)).setLinkedRecordRef('Record/1');
    window.editor.getNodeMenu().update();
  }, personId);

  await expect(page.locator(`${VISIBLE_MENU} .field-editRecord`)).not.toHaveClass(/hidden/);
});

test('full flow: linking a node then editing it dispatches answers that update the read-only-rendered linked item', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true });
  const personId = await openNodeMenuForProband(page);

  // The action buttons/regrouped fields live on the (initially inactive) Linked Record tab.
  await switchToLinkedRecordTab(page);

  await page.evaluate(() => {
    window.__pendingLink = { ref: 'Record/42', details: {} };
  });
  await clickInVisibleMenu(page, '.field-linkRecord button');
  await page.waitForTimeout(100);

  const linkedRef = await page.evaluate(
    (id) => window.editor.getView().getNode(parseInt(id, 10)).getLinkedRecordRef(),
    personId
  );
  expect(linkedRef).toBe('Record/42');
  await expect(page.locator(`${VISIBLE_MENU} .field-editRecord`)).not.toHaveClass(/hidden/);

  await page.evaluate(() => {
    window.__pendingEditAnswers = [{ linkId: 'ext_field_a', value: 'value from REDCap' }];
  });
  await clickInVisibleMenu(page, '.field-editRecord button');
  await page.waitForTimeout(100);

  await expect(page.locator(`${VISIBLE_MENU} .field-ext_field_a input[type=text]`)).toHaveValue('value from REDCap');
  await expect(page.locator(`${VISIBLE_MENU} .field-ext_field_a input[type=text]`)).toBeDisabled();
});

test('createNewRecord sets the node\'s linkedRecordRef from onCreated\'s recordRef, making Edit reachable afterward', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true });
  const personId = await openNodeMenuForProband(page);
  await switchToLinkedRecordTab(page);

  await expect(page.locator(`${VISIBLE_MENU} .field-editRecord`)).toHaveClass(/hidden/);

  await page.evaluate(() => {
    window.__pendingCreate = {
      ref: 'Record/99',
      answers: [{ linkId: 'ext_field_a', value: 'set at creation' }],
    };
  });
  await clickInVisibleMenu(page, '.field-createNewRecord button');
  await page.waitForTimeout(100);

  const linkedRef = await page.evaluate(
    (id) => window.editor.getView().getNode(parseInt(id, 10)).getLinkedRecordRef(),
    personId
  );
  expect(linkedRef).toBe('Record/99');
  await expect(page.locator(`${VISIBLE_MENU} .field-editRecord`)).not.toHaveClass(/hidden/);
  await expect(page.locator(`${VISIBLE_MENU} .field-ext_field_a input[type=text]`)).toHaveValue('set at creation');
});

test('editRecord dispatching a reserved-legend-target answer (disorders) merges rather than overwrites, matching importClinicalData', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true });
  const personId = await openNodeMenuForProband(page);

  await page.evaluate((id) => {
    window.editor.getView().getNode(parseInt(id, 10)).setDisorders(['111111']);
    window.editor.getView().getNode(parseInt(id, 10)).setLinkedRecordRef('Record/42');
    window.editor.getNodeMenu().update();
  }, personId);

  await switchToLinkedRecordTab(page);
  await page.evaluate(() => {
    window.__pendingEditAnswers = [
      { linkId: 'disorders', value: [{ id: '111111', name: 'Existing' }, { id: '222222', name: 'New disorder' }] },
    ];
  });
  await clickInVisibleMenu(page, '.field-editRecord button');
  await page.waitForTimeout(100);

  const disorders = await page.evaluate(
    (id) => window.editor.getView().getNode(parseInt(id, 10)).getDisorders(),
    personId
  );
  expect(disorders.sort()).toEqual(['111111', '222222']);
});

test('a patientProvider and a recordLinkProvider configured together gate their own actions independently, with no interference', async ({ page }) => {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    const base = window.OpenPedigree.defaultQuestionnaire;
    const newEditor = window.OpenPedigree.initialiseEditor({
      questionnaireLocal: base,
      // Deliberately opposite capability flags from the recordLinkProvider below, to prove
      // neither provider's gating leaks into the other's actions.
      patientProvider: {
        isConfigured: () => true,
        canLinkPatient: () => true,
        canImportClinicalData: () => false,
        canLinkProband: () => true,
        canSearchFamilyMembers: () => true,
        lookupPatient: () => {},
        openPatientPickerModal: () => {},
        openClinicalImportModal: () => {},
      },
      recordLinkProvider: {
        isConfigured: () => true,
        canLink: () => false,
        canCreateNew: () => true,
        openPicker: () => {},
        openEditor: () => {},
        createNew: () => {},
      },
    });
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(300);
  await openNodeMenuForProband(page);

  // patientProvider: canLinkPatient true -> link_patient visible; canImportClinicalData false -> import_from_record hidden.
  await expect(page.locator(`${VISIBLE_MENU} .field-link_patient`)).not.toHaveClass(/hidden/);
  await expect(page.locator(`${VISIBLE_MENU} .field-import_from_record`)).toHaveClass(/hidden/);

  await switchToLinkedRecordTab(page);
  // recordLinkProvider: canLink false -> linkRecord hidden; canCreateNew true -> createNewRecord visible.
  await expect(page.locator(`${VISIBLE_MENU} .field-linkRecord`)).toHaveClass(/hidden/);
  await expect(page.locator(`${VISIBLE_MENU} .field-createNewRecord`)).not.toHaveClass(/hidden/);
});

test('a provider can relabel its actions via getActionLabel; actions it does not relabel keep the default', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, actionLabels: { editRecord: 'Edit in REDCap' } });
  const personId = await openNodeMenuForProband(page);
  await page.evaluate((id) => {
    window.editor.getView().getNode(parseInt(id, 10)).setLinkedRecordRef('Record/1');
    window.editor.getNodeMenu().update();
  }, personId);

  await expect(page.locator(`${VISIBLE_MENU} .field-editRecord button`)).toHaveText('Edit in REDCap');
  await expect(page.locator(`${VISIBLE_MENU} .field-linkRecord button`)).toHaveText('Link to existing record');
  await expect(page.locator(`${VISIBLE_MENU} .field-createNewRecord button`)).toHaveText('Create new linked record');
});

test('a blank or non-string getActionLabel result keeps the default label', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, actionLabels: { linkRecord: '   ', createNewRecord: 42 } });
  await openNodeMenuForProband(page);

  await expect(page.locator(`${VISIBLE_MENU} .field-linkRecord button`)).toHaveText('Link to existing record');
  await expect(page.locator(`${VISIBLE_MENU} .field-createNewRecord button`)).toHaveText('Create new linked record');
});
