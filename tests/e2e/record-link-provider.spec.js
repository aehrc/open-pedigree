import { test, expect } from '@playwright/test';
import { retireAutoCreatedEditor } from './helpers/singleEditor';

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

async function loadEditor(page, { recordLinkProvider, questionnaire, actionLabels, terminologyBaseUrl } = {}) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  await retireAutoCreatedEditor(page);
  await page.evaluate(({ q, hasProvider, labels, termUrl }) => {
    // See questionnaire-fields.spec.js for why #work-area (not just #canvas) needs removing.
    document.querySelectorAll('#work-area').forEach((el) => el.remove());

    const options = { questionnaireLocal: q };
    if (termUrl) {
      options.questionnaireTerminologyBaseUrl = termUrl;
    }
    if (hasProvider) {
      options.recordLinkProvider = {
        isConfigured: () => true,
        canLink: () => true,
        canCreateNew: () => true,
        openPicker: (_nodeId, onLinked) => {
          if (window.__deferLink) {
            window.__linkCallback = onLinked; // called later by the test, as an async provider would
            return;
          }
          window.__pendingLink && onLinked(window.__pendingLink.ref, window.__pendingLink.details, window.__pendingLink.answers);
        },
        openEditor: (_nodeId, onDone) => {
          window.__pendingEditAnswers && onDone(window.__pendingEditAnswers);
        },
        createNew: (_nodeId, onCreated) => {
          window.__pendingCreate && onCreated(window.__pendingCreate.ref, window.__pendingCreate.answers);
        },
      };
      if (labels === 'throw') {
        options.recordLinkProvider.getActionLabel = () => { throw new Error('getActionLabel failed'); };
      } else if (labels) {
        options.recordLinkProvider.getActionLabel = (action) => labels[action];
      }
    }

    const newEditor = window.OpenPedigree.initialiseEditor(options);
    window.editor = newEditor;
    newEditor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
  }, { q: questionnaire || LINKED_RECORD_QUESTIONNAIRE, hasProvider: !!recordLinkProvider, labels: actionLabels || null, termUrl: terminologyBaseUrl || null });
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

// A host instrument whose section headers become groups, with every field linked (e.g.
// redcap_pedigree_editor's derived form): regrouping empties the "Basic Info" tab.
const ALL_LINKED_GROUP_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-all-linked-group',
  version: '1.0',
  item: [
    {
      linkId: 'basic_info', type: 'group', text: 'Basic Info',
      item: [
        {
          linkId: 'ext_field_a', type: 'string', text: 'External field A',
          extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }],
        },
      ],
    },
    {
      linkId: 'more', type: 'group', text: 'More',
      item: [{ linkId: 'notes', type: 'string', text: 'Notes' }],
    },
  ],
};

test('a tab whose items are all regrouped onto the Linked Record tab isn\'t shown', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ALL_LINKED_GROUP_QUESTIONNAIRE });
  await openNodeMenuForProband(page);
  const tabLabels = () => page.locator(`${VISIBLE_MENU} .tabs dd a`).allTextContents();

  expect(await tabLabels()).toEqual(['More', 'Linked Record']);
  await expect(page.locator(`${VISIBLE_MENU} #tab_basic_info`)).toHaveCount(0);
  // Its item is still there, under its heading on the Linked Record tab.
  await expect(page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-ext_field_a`)).toBeAttached();
  expect(await page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-heading .field-name`).allTextContents()).toEqual(['Basic Info']);
});

test('a tab left with only a nested group\'s heading isn\'t shown, and the heading doesn\'t stray onto other tabs', async ({ page }) => {
  const questionnaire = {
    resourceType: 'Questionnaire', url: 'http://example.org/Questionnaire/e2e-nested-all-linked', version: '1.0',
    item: [
      {
        linkId: 'clinical', type: 'group', text: 'Clinical',
        item: [{
          linkId: 'section_a', type: 'group', text: 'Section A',
          item: [{
            linkId: 'ext_field_a', type: 'string', text: 'External field A',
            extension: [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }],
          }],
        }],
      },
      { linkId: 'more', type: 'group', text: 'More', item: [{ linkId: 'notes', type: 'string', text: 'Notes' }] },
    ],
  };
  await loadEditor(page, { recordLinkProvider: true, questionnaire });
  await openNodeMenuForProband(page);
  expect(await page.locator(`${VISIBLE_MENU} .tabs dd a`).allTextContents()).toEqual(['More', 'Linked Record']);
  // Every heading is inside a tab's panel - none at the form's root.
  expect(await page.locator(`${VISIBLE_MENU} form.tabs-content > .field-heading`).count()).toBe(0);
  expect(await page.locator(`${VISIBLE_MENU} #tab_more .field-heading`).count()).toBe(0);
  await expect(page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-ext_field_a`)).toBeAttached();
  expect(await page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-heading .field-name`).allTextContents()).toEqual(['Section A']);
});

test('without a recordLinkProvider the same tab keeps its (disabled) linked item and is shown', async ({ page }) => {
  await loadEditor(page, { questionnaire: ALL_LINKED_GROUP_QUESTIONNAIRE });
  await openNodeMenuForProband(page);
  expect(await page.locator(`${VISIBLE_MENU} .tabs dd a`).allTextContents()).toEqual(['Basic Info', 'More']);
  await expect(page.locator(`${VISIBLE_MENU} #tab_basic_info .field-ext_field_a input[type=text]`)).toBeDisabled();
});

const LINKED_EXTENSION = [{ url: 'https://github.com/aehrc/open-pedigree/questionnaire-linked-record-source' }];

// A tab that stays (it has "age"), holding a nested group whose fields are all linked
// ("Vitals", two levels deep inside "Measurements") and one that still has a field ("History").
const PARTLY_LINKED_TAB_QUESTIONNAIRE = {
  resourceType: 'Questionnaire', url: 'http://example.org/Questionnaire/e2e-partly-linked-tab', version: '1.0',
  item: [{
    linkId: 'clinical', type: 'group', text: 'Clinical',
    item: [
      { linkId: 'age', type: 'string', text: 'Age' },
      {
        linkId: 'measurements', type: 'group', text: 'Measurements',
        item: [{
          linkId: 'vitals', type: 'group', text: 'Vitals',
          item: [
            { linkId: 'height', type: 'string', text: 'Height', extension: LINKED_EXTENSION },
            { linkId: 'weight', type: 'string', text: 'Weight', extension: LINKED_EXTENSION },
          ],
        }],
      },
      {
        linkId: 'history', type: 'group', text: 'History',
        item: [{
          linkId: 'history_detail', type: 'group', text: 'History detail',
          item: [{ linkId: 'onset', type: 'string', text: 'Onset' }],
        }],
      },
    ],
  }],
};

test('on a tab that stays, a nested group whose fields are all linked leaves no empty heading', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: PARTLY_LINKED_TAB_QUESTIONNAIRE });
  await openNodeMenuForProband(page);
  expect(await page.locator(`${VISIBLE_MENU} .tabs dd a`).allTextContents()).toEqual(['Clinical', 'Linked Record']);
  // "Measurements" only held "Vitals", so both go; "History" still has a field under it.
  expect(await page.locator(`${VISIBLE_MENU} #tab_clinical .field-heading .field-name`).allTextContents()).toEqual(['History', 'History detail']);
  await expect(page.locator(`${VISIBLE_MENU} #tab_clinical .field-age`)).toBeAttached();
  expect(await page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-heading .field-name`).allTextContents()).toEqual(['Vitals']);
  await expect(page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-height`)).toBeAttached();
  await expect(page.locator(`${VISIBLE_MENU} #tab___linked_record__ .field-weight`)).toBeAttached();
});

test('without a recordLinkProvider, a partly linked tab keeps every heading', async ({ page }) => {
  await loadEditor(page, { questionnaire: PARTLY_LINKED_TAB_QUESTIONNAIRE });
  await openNodeMenuForProband(page);
  expect(await page.locator(`${VISIBLE_MENU} #tab_clinical .field-heading .field-name`).allTextContents())
    .toEqual(['Measurements', 'Vitals', 'History', 'History detail']);
});

test('without a recordLinkProvider, a tab or heading with nothing the form can show isn\'t shown', async ({ page }) => {
  // `display` items (e.g. REDCap descriptive fields) aren't rendered.
  const questionnaire = {
    resourceType: 'Questionnaire', url: 'http://example.org/Questionnaire/e2e-display-only', version: '1.0',
    item: [
      { linkId: 'intro', type: 'group', text: 'Intro', item: [{ linkId: 'intro_text', type: 'display', text: 'Welcome' }] },
      {
        linkId: 'more', type: 'group', text: 'More',
        item: [
          { linkId: 'notes', type: 'string', text: 'Notes' },
          { linkId: 'about', type: 'group', text: 'About', item: [{ linkId: 'about_text', type: 'display', text: 'About' }] },
        ],
      },
    ],
  };
  await loadEditor(page, { questionnaire });
  await openNodeMenuForProband(page);
  expect(await page.locator(`${VISIBLE_MENU} .tabs dd a`).allTextContents()).toEqual(['More']);
  expect(await page.locator(`${VISIBLE_MENU} .field-heading`).count()).toBe(0);
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

// link-record-brings-answers: onLinked's optional answers are applied in the same step, as
// onCreated's are. (Without them only the ref is set - the full-flow test above.)
test('linking with answers sets the ref and brings the record\'s values in', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true });
  const personId = await openNodeMenuForProband(page);
  await switchToLinkedRecordTab(page);

  await page.evaluate(() => {
    window.__pendingLink = { ref: 'Record/42', details: {}, answers: [{ linkId: 'ext_field_a', value: 'from the record' }] };
  });
  await clickInVisibleMenu(page, '.field-linkRecord button');
  await page.waitForTimeout(100);

  const node = await page.evaluate((id) => {
    const n = window.editor.getView().getNode(parseInt(id, 10));
    return { ref: n.getLinkedRecordRef(), answer: n.getQuestionnaireAnswer('ext_field_a'), snapshot: n.getLinkedRecordSnapshot() };
  }, personId);
  expect(node).toEqual({ ref: 'Record/42', answer: 'from the record', snapshot: { ext_field_a: 'from the record' } });
  await expect(page.locator(`${VISIBLE_MENU} .field-ext_field_a input[type=text]`)).toHaveValue('from the record');
});

test('relinking to another record with answers replaces the old record\'s value and snapshot', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true });
  const personId = await openNodeMenuForProband(page);
  await switchToLinkedRecordTab(page);

  const link = async (ref, value) => {
    await page.evaluate(({ r, v }) => {
      window.__pendingLink = { ref: r, details: {}, answers: [{ linkId: 'ext_field_a', value: v }] };
    }, { r: ref, v: value });
    await clickInVisibleMenu(page, '.field-linkRecord button');
    await page.waitForTimeout(100);
  };
  await link('Record/1', 'one');
  await link('Record/2', 'two');

  const node = await page.evaluate((id) => {
    const n = window.editor.getView().getNode(parseInt(id, 10));
    return { ref: n.getLinkedRecordRef(), answer: n.getQuestionnaireAnswer('ext_field_a'), snapshot: n.getLinkedRecordSnapshot() };
  }, personId);
  expect(node).toEqual({ ref: 'Record/2', answer: 'two', snapshot: { ext_field_a: 'two' } });
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

// A first refresh has supplied nothing yet, so the node's existing disorder counts as
// diagram-entered and is kept alongside the record's (linked-record-round-trip) - not a merge;
// see the legend reconciliation test below for removal and replacement.
test('editRecord keeps diagram-entered disorders and adds the record\'s on a first refresh', async ({ page }) => {
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

  await retireAutoCreatedEditor(page);
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

test('a provider without getActionLabel keeps all the default labels', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true });
  const personId = await openNodeMenuForProband(page);
  await page.evaluate((id) => {
    window.editor.getView().getNode(parseInt(id, 10)).setLinkedRecordRef('Record/1');
    window.editor.getNodeMenu().update();
  }, personId);

  await expect(page.locator(`${VISIBLE_MENU} .field-linkRecord button`)).toHaveText('Link to existing record');
  await expect(page.locator(`${VISIBLE_MENU} .field-createNewRecord button`)).toHaveText('Create new linked record');
  await expect(page.locator(`${VISIBLE_MENU} .field-editRecord button`)).toHaveText('Edit linked record');
});

test('a getActionLabel that throws keeps the default labels and does not stop the editor loading', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, actionLabels: 'throw' });
  await openNodeMenuForProband(page);

  await expect(page.locator(`${VISIBLE_MENU} .field-linkRecord button`)).toHaveText('Link to existing record');
  await expect(page.locator(`${VISIBLE_MENU} .field-createNewRecord button`)).toHaveText('Create new linked record');
});

// ---- linked-record-round-trip ----------------------------------------------------------------
// A Questionnaire with mapped fields (gender, birth date, adopted), a plain integer and a string
// item, and the disorders legend - enough to exercise every refresh rule end to end.
const FIELD_MAPPING_URL = 'https://github.com/aehrc/open-pedigree/questionnaire-field-mapping';
const ROUND_TRIP_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-linked-record-round-trip',
  version: '1.0',
  item: [
    {
      linkId: 'person', type: 'group', text: 'Person',
      item: [
        {
          linkId: 'gender', type: 'choice', text: 'Gender',
          definition: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.gender',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToField' }],
          answerOption: [{ valueCoding: { code: 'M', display: 'Male' } }, { valueCoding: { code: 'F', display: 'Female' } }, { valueCoding: { code: 'U', display: 'Unknown' } }],
        },
        {
          linkId: 'dob', type: 'date', text: 'Date of birth',
          definition: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.birthDate',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToField' }],
        },
        {
          linkId: 'adopted', type: 'boolean', text: 'Adopted',
          definition: 'https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.isAdopted',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToField' }],
        },
        {
          linkId: 'dod', type: 'date', text: 'Date of death',
          definition: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.deceasedDateTime',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToField' }],
        },
        {
          linkId: 'weeks', type: 'integer', text: 'Gestation age',
          definition: 'https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.gestationAge',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToField' }],
        },
        { linkId: 'count', type: 'integer', text: 'Count' },
        { linkId: 'note', type: 'string', text: 'Note' },
        {
          linkId: 'disorders', type: 'choice', text: 'Disorders', repeats: true,
          answerValueSet: 'http://purl.bioontology.org/ontology/OMIM',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToLegendCondition' }],
        },
        {
          linkId: 'conds', type: 'choice', text: 'Other conditions', repeats: true,
          answerValueSet: 'http://example.org/ValueSet/conditions',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToLegendCondition' }],
        },
        {
          linkId: 'life', type: 'choice', text: 'Life status',
          definition: 'https://github.com/aehrc/open-pedigree/StructureDefinition/PedigreeIndividual#PedigreeIndividual.lifeStatus',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToField' }],
          answerOption: [{ valueCoding: { code: 'alive', display: 'Alive' } }, { valueCoding: { code: 'deceased', display: 'Deceased' } }],
        },
        {
          linkId: 'hpo_positive', type: 'choice', text: 'Phenotypes', repeats: true,
          answerValueSet: 'http://purl.obolibrary.org/obo/hp.owl',
          extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToLegendObservation' }],
        },
      ],
    },
  ],
};

async function setNodeProperty(page, personId, properties) {
  await page.evaluate(({ id, props }) => {
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: parseInt(id, 10), properties: props } }));
  }, { id: personId, props: properties });
}

// Runs the linked-record refresh exactly as a provider does: the Edit action's onDone.
async function refreshWith(page, personId, answers) {
  await page.evaluate(({ id, a }) => {
    window.__pendingEditAnswers = a;
    window.editor.getNodeMenu().show(window.editor.getView().getNode(parseInt(id, 10)), 100, 100);
  }, { id: personId, a: answers });
  await switchToLinkedRecordTab(page);
  await clickInVisibleMenu(page, '.field-editRecord button');
  await page.waitForTimeout(200);
}

async function readRoundTripNode(page, personId) {
  return page.evaluate((id) => {
    const n = window.editor.getView().getNode(parseInt(id, 10));
    const dob = n.getBirthDate();
    const dod = n.getDeathDate();
    return {
      ref: n.getLinkedRecordRef(),
      gender: n.getGender(),
      dob: dob ? dob.toDateString() : '',
      dod: dod ? dod.toDateString() : '',
      phenotypes: n.getPhenotypes().slice(0),
      life: n.getLifeStatus(),
      conds: (n.getQuestionnaireAnswer('conds') || []).map((c) => c.code),
      adopted: n.getAdopted(),
      count: n.getQuestionnaireAnswer('count'),
      note: n.getQuestionnaireAnswer('note'),
      disorders: n.getDisorders().slice(0).sort(),
      snapshot: n.getLinkedRecordSnapshot(),
    };
  }, personId);
}

test('a linked node keeps its link and record snapshot through a GA4GH export and re-import', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
  await refreshWith(page, personId, [{ linkId: 'note', value: 'from the record' }]);

  await page.evaluate(() => window.editor.getExportSelector().show());
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.evaluate(() => {
      const ga4ghRadio = document.querySelector('input[type=radio][name="export-type"][value="GA4GH"]');
      ga4ghRadio.checked = true;
      ga4ghRadio.click();
      document.getElementById('export_button').click();
    }),
  ]);
  const fs = require('fs');
  const exported = fs.readFileSync(await download.path(), 'utf8');

  await page.evaluate((json) => {
    window.editor.getSaveLoadEngine().createGraphFromImportData(json, 'GA4GH', {}, true, true);
  }, exported);
  await page.waitForTimeout(300);

  const reloadedId = await openNodeMenuForProband(page);
  const node = await readRoundTripNode(page, reloadedId);
  expect(node.ref).toBe('record:1/instance:1');
  expect(node.note).toBe('from the record');
  expect(node.snapshot).toEqual({ note: 'from the record' });
  await switchToLinkedRecordTab(page);
  await expect(page.locator(`${VISIBLE_MENU} .field-editRecord`)).not.toHaveClass(/hidden/);
});

test('a refresh clears what the record supplied, leaves diagram-entered values, and handles gender and 0', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });

  await refreshWith(page, personId, [
    { linkId: 'gender', value: 'F' }, { linkId: 'count', value: 0 }, { linkId: 'note', value: 'hello' },
  ]);
  await setNodeProperty(page, personId, { setBirthDate: '1980-01-01' }); // entered in the diagram
  expect(await readRoundTripNode(page, personId)).toMatchObject({ gender: 'F', count: 0, note: 'hello' });

  await refreshWith(page, personId, [
    { linkId: 'gender', value: null }, { linkId: 'count', value: null },
    { linkId: 'note', value: null }, { linkId: 'dob', value: null },
  ]);
  const node = await readRoundTripNode(page, personId);
  expect(node.gender).toBe('U');
  expect(node.count).toBeUndefined();
  expect(node.note).toBeUndefined();
  expect(node.dob).toBe(new Date('1980-01-01').toDateString());
  expect(node.snapshot).toEqual({});
});

// Links a node exactly as a provider's picker does: onLinked with the record's answers.
async function linkWith(page, personId, ref, answers) {
  await page.evaluate(({ id, r, a }) => {
    window.__pendingLink = { ref: r, details: {}, answers: a };
    window.editor.getNodeMenu().show(window.editor.getView().getNode(parseInt(id, 10)), 100, 100);
  }, { id: personId, r: ref, a: answers });
  await switchToLinkedRecordTab(page);
  await clickInVisibleMenu(page, '.field-linkRecord button');
  await page.waitForTimeout(200);
}

test('relinking to a record without a value clears the old record\'s value, but keeps one typed in the diagram', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await linkWith(page, personId, 'record:1/instance:1', [
    { linkId: 'note', value: 'from record 1' }, { linkId: 'count', value: 3 },
  ]);
  // Typed in the diagram: no longer the record's value.
  await setNodeProperty(page, personId, { setQuestionnaireAnswer_count: 7 });

  await linkWith(page, personId, 'record:1/instance:2', [{ linkId: 'note', value: null }, { linkId: 'count', value: null }]);
  const node = await readRoundTripNode(page, personId);
  expect(node.ref).toBe('record:1/instance:2');
  expect(node.note ?? null).toBeNull();
  expect(node.count).toBe(7);
  expect(node.snapshot).toEqual({});
});

test('relinking applies a value the new record shares with the old one, over a diagram edit', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await linkWith(page, personId, 'record:1/instance:1', [{ linkId: 'note', value: 'X' }]);
  await setNodeProperty(page, personId, { setQuestionnaireAnswer_note: 'Y' });

  await linkWith(page, personId, 'record:1/instance:2', [{ linkId: 'note', value: 'X' }]);
  const node = await readRoundTripNode(page, personId);
  expect(node.ref).toBe('record:1/instance:2');
  expect(node.note).toBe('X');
  expect(node.snapshot).toEqual({ note: 'X' });
});

test('a late onLinked for a person who is no longer at that node ID is ignored', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await page.evaluate(() => { window.__deferLink = true; });
  await switchToLinkedRecordTab(page);
  await clickInVisibleMenu(page, '.field-linkRecord button');
  // Before the provider answers, the pedigree is replaced: a different person now has that ID.
  await page.evaluate(() => {
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 0 0 1 1', 'ped', {}, true, true);
    window.__linkCallback('record:1/instance:1', {}, [{ linkId: 'note', value: 'too late' }]);
  });
  const node = await readRoundTripNode(page, personId);
  expect(node.ref || '').toBe('');
  expect(node.note ?? null).toBeNull();
});

test('onCreated without answers only sets the ref, keeping the previous record\'s values', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await linkWith(page, personId, 'record:1/instance:1', [{ linkId: 'note', value: 'from record 1' }]);
  await page.evaluate(() => { window.__pendingCreate = { ref: 'Record/99' }; });
  await switchToLinkedRecordTab(page);
  await clickInVisibleMenu(page, '.field-createNewRecord button');
  await page.waitForTimeout(200);
  const node = await readRoundTripNode(page, personId);
  expect(node.ref).toBe('Record/99');
  expect(node.note).toBe('from record 1');
});

test('one undo removes a link and the values it brought', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  // Something to undo back to: in this harness the link would otherwise be the first state.
  await setNodeProperty(page, personId, { setGender: 'F' });
  await linkWith(page, personId, 'record:1/instance:1', [{ linkId: 'note', value: 'from the record' }]);
  expect((await readRoundTripNode(page, personId)).note).toBe('from the record');

  await page.evaluate(() => window.editor.getActionStack().undo());
  const node = await readRoundTripNode(page, personId);
  expect(node.ref || '').toBe('');
  expect(node.note ?? null).toBeNull();
  expect(node.snapshot).toEqual({});
});

test('a refresh that changes nothing adds no undo step, and one that changes things adds exactly one', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
  const undoSize = () => page.evaluate(() => window.editor.getActionStack()._size());

  const before = await undoSize();
  await refreshWith(page, personId, [{ linkId: 'note', value: 'hello' }, { linkId: 'count', value: 3 }]);
  expect(await undoSize()).toBe(before + 1);

  await refreshWith(page, personId, [{ linkId: 'note', value: 'hello' }, { linkId: 'count', value: 3 }]);
  expect(await undoSize()).toBe(before + 1);
});

test('legend refresh removes and replaces the record\'s disorders but keeps diagram-entered ones', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });

  await refreshWith(page, personId, [{ linkId: 'disorders', value: [{ id: 'D1', name: 'One' }] }]);
  await setNodeProperty(page, personId, { setDisorders: ['D1', 'D9'] }); // D9 entered in the diagram
  expect((await readRoundTripNode(page, personId)).disorders).toEqual(['D1', 'D9']);

  await refreshWith(page, personId, [{ linkId: 'disorders', value: [{ id: 'D2', name: 'Two' }] }]);
  expect((await readRoundTripNode(page, personId)).disorders).toEqual(['D2', 'D9']);

  await refreshWith(page, personId, [{ linkId: 'disorders', value: null }]);
  expect((await readRoundTripNode(page, personId)).disorders).toEqual(['D9']);
});

test('sanitised legend IDs (e.g. HP:0001250) don\'t duplicate on repeated refreshes, and are removed when dropped', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
  const undoSize = () => page.evaluate(() => window.editor.getActionStack()._size());
  const alerts = [];
  page.on('dialog', (d) => alerts.push(d.message()));

  await refreshWith(page, personId, [{ linkId: 'hpo_positive', value: [{ id: 'HP:0001250', name: 'Seizure' }] }]);
  const afterFirst = await undoSize();
  await refreshWith(page, personId, [{ linkId: 'hpo_positive', value: [{ id: 'HP:0001250', name: 'Seizure' }] }]);
  expect(await undoSize()).toBe(afterFirst);
  expect((await readRoundTripNode(page, personId)).phenotypes).toEqual(['HP_C_0001250']);

  await refreshWith(page, personId, [{ linkId: 'hpo_positive', value: null }]);
  expect((await readRoundTripNode(page, personId)).phenotypes).toEqual([]);
  expect(alerts).toEqual([]);
});

test('an unchanged value open-pedigree stores differently (gestation age on a live-born person) settles with no undo growth', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
  const undoSize = () => page.evaluate(() => window.editor.getActionStack()._size());

  await refreshWith(page, personId, [{ linkId: 'weeks', value: 38 }]);
  const afterFirst = await undoSize();
  for (let i = 0; i < 3; i++) {
    await refreshWith(page, personId, [{ linkId: 'weeks', value: 38 }]);
  }
  expect(await undoSize()).toBe(afterFirst);
});

test('a gender the partnership rules rejected, later emptied in the record, leaves the diagram\'s gender alone', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  // Father (2, male) partnered with mother (3, female): the father can't become female.
  await page.evaluate(() => {
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 2 3 1 1\nfam1 2 0 0 1 1\nfam1 3 0 0 2 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(300);
  const fatherId = await page.evaluate(() => {
    const graph = window.editor.getGraph();
    for (let id = 0; id <= graph.getMaxNodeId(); id++) {
      if (graph.isPerson(id) && graph.getGender(id) === 'M' && graph.getParentRelationship(id) === null) {
        return String(id);
      }
    }
    return null;
  });
  await setNodeProperty(page, fatherId, { setLinkedRecordRef: 'record:1/instance:1' });

  await refreshWith(page, fatherId, [{ linkId: 'gender', value: 'F' }]);
  expect((await readRoundTripNode(page, fatherId)).gender).toBe('M');
  await refreshWith(page, fatherId, [{ linkId: 'gender', value: null }]);
  expect((await readRoundTripNode(page, fatherId)).gender).toBe('M');
});

test('moving both dates later, or both earlier, applies both', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });

  await refreshWith(page, personId, [{ linkId: 'dob', value: '1950-01-01' }, { linkId: 'dod', value: '1960-01-01' }]);
  await refreshWith(page, personId, [{ linkId: 'dob', value: '1970-01-01' }, { linkId: 'dod', value: '2020-01-01' }]);

  let node = await readRoundTripNode(page, personId);
  expect(node.dob).toBe(new Date('1970-01-01').toDateString());
  expect(node.dod).toBe(new Date('2020-01-01').toDateString());

  // Undo puts both back, in an order the setters accept.
  await page.evaluate(() => window.editor.getActionStack().undo());
  node = await readRoundTripNode(page, personId);
  expect(node.dob).toBe(new Date('1950-01-01').toDateString());
  expect(node.dod).toBe(new Date('1960-01-01').toDateString());

  // And both earlier, past the old birth date.
  await refreshWith(page, personId, [{ linkId: 'dob', value: '1900-01-01' }, { linkId: 'dod', value: '1910-01-01' }]);
  node = await readRoundTripNode(page, personId);
  expect(node.dob).toBe(new Date('1900-01-01').toDateString());
  expect(node.dod).toBe(new Date('1910-01-01').toDateString());
});

test('a new birth date on the same day as the current death date is applied', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
  await refreshWith(page, personId, [{ linkId: 'dob', value: '1950-01-01' }, { linkId: 'dod', value: '1960-01-01' }]);
  await refreshWith(page, personId, [{ linkId: 'dob', value: '1960-01-01' }, { linkId: 'dod', value: '1970-01-01' }]);
  const node = await readRoundTripNode(page, personId);
  expect(node.dob).toBe(new Date('1960-01-01').toDateString());
  expect(node.dod).toBe(new Date('1970-01-01').toDateString());
});

test('a refresh still keeps monozygotic twins the same gender (a group rule)', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  await page.evaluate(() => {
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 2 3 2 1\nfam1 2 0 0 1 1\nfam1 3 0 0 2 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(300);
  const personId = await page.evaluate(() => {
    const graph = window.editor.getGraph();
    for (let id = 0; id <= graph.getMaxNodeId(); id++) {
      if (graph.isPerson(id) && graph.getParentRelationship(id) !== null) {
        return String(id);
      }
    }
    return null;
  });
  await page.evaluate((id) => {
    document.dispatchEvent(new CustomEvent('pedigree:node:modify', { detail: { nodeID: parseInt(id, 10), modifications: { addTwin: 2 } } }));
  }, personId);
  await page.waitForTimeout(300);
  const twinId = await page.evaluate((id) => window.editor.getGraph().getAllTwinsSortedByOrder(parseInt(id, 10)).find((t) => t !== parseInt(id, 10)), personId);
  await setNodeProperty(page, personId, { setMonozygotic: true });
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });

  await refreshWith(page, personId, [{ linkId: 'gender', value: 'M' }]);

  expect(await page.evaluate((id) => window.editor.getView().getNode(parseInt(id, 10)).getGender(), personId)).toBe('M');
  expect(await page.evaluate((id) => window.editor.getView().getNode(id).getGender(), twinId)).toBe('M');
});

test('undoing a relink restores the old link and its snapshot; re-picking the same row keeps the snapshot', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  const linkTo = (ref) => page.evaluate(({ id, r }) => {
    const props = window.editor._linkedRecordRefProperties(parseInt(id, 10), r);
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: parseInt(id, 10), properties: props } }));
  }, { id: personId, r: ref });

  await linkTo('record:1/instance:1');
  await refreshWith(page, personId, [{ linkId: 'note', value: 'x' }]);

  await linkTo('record:1/instance:1');
  expect((await readRoundTripNode(page, personId)).snapshot).toEqual({ note: 'x' });

  await linkTo('record:1/instance:2');
  expect(await readRoundTripNode(page, personId)).toMatchObject({ ref: 'record:1/instance:2', snapshot: {} });

  await page.evaluate(() => window.editor.getActionStack().undo());
  expect(await readRoundTripNode(page, personId)).toMatchObject({ ref: 'record:1/instance:1', snapshot: { note: 'x' } });
});

test('legend entries sent as {system, code, display} work for reserved legends', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await refreshWith(page, personId, [{ linkId: 'hpo_positive', value: [{ system: 'http://purl.obolibrary.org/obo/hp.owl', code: 'HP:0001250', display: 'Seizure' }] }]);
  expect((await readRoundTripNode(page, personId)).phenotypes).toEqual(['HP_C_0001250']);
  await refreshWith(page, personId, [{ linkId: 'hpo_positive', value: null }]);
  expect((await readRoundTripNode(page, personId)).phenotypes).toEqual([]);
  expect(errors).toEqual([]);
});

test('custom legend items accept {id, name} entries', async ({ page }) => {
  // A custom legend item needs a terminology to have a legend at all (it's only looked up on
  // search, so this URL is never fetched here).
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE, terminologyBaseUrl: 'http://example.org/fhir' });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await refreshWith(page, personId, [{ linkId: 'conds', value: [{ id: 'X1', name: 'Example one' }, { id: 'X2', name: 'Example two' }] }]);
  expect((await readRoundTripNode(page, personId)).conds).toEqual(['X1', 'X2']);
  await refreshWith(page, personId, [{ linkId: 'conds', value: [{ id: 'X2', name: 'Example two' }] }]);
  expect((await readRoundTripNode(page, personId)).conds).toEqual(['X2']);
  expect(errors).toEqual([]);
});

test('an edit window\'s answers are not applied if the node was relinked meanwhile', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });

  await page.evaluate((id) => {
    window.editor._dispatchLinkedRecordRefresh(parseInt(id, 10), [{ linkId: 'note', value: 'from record 1' }], 'record:1/instance:2');
  }, personId);
  expect((await readRoundTripNode(page, personId)).note).toBeUndefined();
});

test('undoing a refresh that set life status and a death date restores both', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });

  await refreshWith(page, personId, [{ linkId: 'life', value: 'deceased' }, { linkId: 'dod', value: '2000-01-01' }]);
  expect(await readRoundTripNode(page, personId)).toMatchObject({ life: 'deceased', dod: new Date('2000-01-01').toDateString() });
  await page.evaluate(() => window.editor.getActionStack().undo());
  expect(await readRoundTripNode(page, personId)).toMatchObject({ life: 'alive', dod: '' });
});

test('a refresh whose only value is rejected adds no undo step', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  await page.evaluate(() => {
    window.editor.getSaveLoadEngine().createGraphFromImportData('fam1 1 2 3 1 1\nfam1 2 0 0 1 1\nfam1 3 0 0 2 1', 'ped', {}, true, true);
  });
  await page.waitForTimeout(300);
  const fatherId = await page.evaluate(() => {
    const graph = window.editor.getGraph();
    for (let id = 0; id <= graph.getMaxNodeId(); id++) {
      if (graph.isPerson(id) && graph.getGender(id) === 'M' && graph.getParentRelationship(id) === null) {
        return String(id);
      }
    }
    return null;
  });
  await setNodeProperty(page, fatherId, { setLinkedRecordRef: 'record:1/instance:1' });
  const undoSize = () => page.evaluate(() => window.editor.getActionStack()._size());
  const before = await undoSize();
  await refreshWith(page, fatherId, [{ linkId: 'gender', value: 'F' }]);
  expect(await undoSize()).toBe(before);
});

// An ordinary edit (not a refresh): the controller's date-pair ordering must not move the dates
// ahead of setLifeStatus in an undo memo, or restoring a fetus status would wipe them again.
test('undoing a life status change away from stillborn restores the status and both dates', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await page.evaluate((id) => {
    const n = window.editor.getView().getNode(parseInt(id, 10));
    n.setLifeStatus('stillborn');
    n.setBirthDate('2000-01-01');
    n.setDeathDate('2000-01-02');
    window.editor.getGraph().setProperties(parseInt(id, 10), n.getProperties());
  }, personId);
  const before = await readRoundTripNode(page, personId);
  expect(before).toMatchObject({ life: 'stillborn', dob: new Date('2000-01-01').toDateString(), dod: new Date('2000-01-02').toDateString() });
  // undo() needs a state to step back to: give the stack a baseline edit first.
  await setNodeProperty(page, personId, { setFirstName: 'Baseline' });
  const undoSize = await page.evaluate(() => window.editor.getActionStack()._size());

  await setNodeProperty(page, personId, { setLifeStatus: 'deceased' });
  expect(await page.evaluate(() => window.editor.getActionStack()._size())).toBe(undoSize + 1);
  expect((await readRoundTripNode(page, personId)).life).toBe('deceased');
  await page.evaluate(() => window.editor.getActionStack().undo());
  expect(await readRoundTripNode(page, personId)).toMatchObject({ life: 'stillborn', dob: before.dob, dod: before.dod });
});


// GA4GH export through the export dialog, as a user would save it.
async function exportGA4GH(page) {
  await page.evaluate(() => window.editor.getExportSelector().show());
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.evaluate(() => {
      const ga4ghRadio = document.querySelector('input[type=radio][name="export-type"][value="GA4GH"]');
      ga4ghRadio.checked = true;
      ga4ghRadio.click();
      document.getElementById('export_button').click();
    }),
  ]);
  return require('fs').readFileSync(await download.path(), 'utf8');
}

async function importGA4GH(page, json) {
  return page.evaluate((j) => window.editor.getSaveLoadEngine().createGraphFromImportData(j, 'GA4GH', {}, true, true) !== false
    && window.editor.getGraph().getMaxNodeId() > 0, json);
}

test('a pedigree saved, loaded and saved again still loads with its family intact', async ({ page }) => {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await page.evaluate(() => window.editor.getSaveLoadEngine().createGraphFromImportData(
    'fam1 child dad mum 1 0\nfam1 dad 0 0 1 0\nfam1 mum 0 0 2 0', 'ped', {}, true, true));
  const people = () => page.evaluate(() => {
    const g = window.editor.getGraph();
    let n = 0;
    for (let id = 0; id <= g.getMaxNodeId(); id++) { if (g.isPerson(id)) n++; }
    return n;
  });
  expect(await people()).toBe(3);

  const first = await exportGA4GH(page);
  expect(await importGA4GH(page, first)).toBe(true);
  const second = await exportGA4GH(page);
  expect(second).not.toMatch(/"reference": "Patient\/urn:uuid:/);
  expect(await importGA4GH(page, second)).toBe(true);
  expect(await people()).toBe(3);
  expect(dialogs).toEqual([]);
});

// A saved pedigree with one linked person and a 'note' answer, loaded into a new editor that
// gets the same Questionnaire from a slow questionnaireUrl - while the built-in default is still
// in effect. Returns a function reading the person's 'note' answer.
async function loadBeforeQuestionnaireArrives(page) {
  await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
  const personId = await openNodeMenuForProband(page);
  await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
  await refreshWith(page, personId, [{ linkId: 'note', value: 'from the record' }]);
  const saved = await exportGA4GH(page);

  await page.route('**/fhir/Questionnaire/slow-round-trip', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROUND_TRIP_QUESTIONNAIRE) });
  });
  await retireAutoCreatedEditor(page);
  await page.evaluate((json) => {
    document.querySelectorAll('#work-area').forEach((el) => el.remove());
    window.editor = window.OpenPedigree.initialiseEditor({ questionnaireUrl: 'http://example.org/fhir/Questionnaire/slow-round-trip' });
    // As a host's load does (localStorageBackend): with an undo step, so undo can go back to it.
    window.editor.getSaveLoadEngine().createGraphFromImportData(json, 'GA4GH', {}, false, true);
  }, saved);
  const linkedPersonId = () => page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    return parseInt(Object.keys(map).find((k) => map[k].getType && map[k].getType() === 'Person' && map[k].getLinkedRecordRef()), 10);
  });
  const note = async () => {
    const id = await linkedPersonId();
    return page.evaluate((i) => window.editor.getView().getNode(i).getQuestionnaireAnswer('note'), id);
  };
  return { note, linkedPersonId };
}

function questionnaireResponses(exported) {
  return JSON.parse(exported).entry.map((e) => e.resource).filter((r) => r.resourceType === 'QuestionnaireResponse');
}

test('a pedigree loaded before its questionnaireUrl arrives gets its answers once it does, and an undo keeps them', async ({ page }) => {
  const { note } = await loadBeforeQuestionnaireArrives(page);
  await expect.poll(note, { timeout: 10000 }).toBe('from the record');

  // Undoing a structural edit (here: adding parents) reloads the load's snapshot - taken
  // before the answers arrived.
  const before = await page.evaluate(() => window.editor.getGraph().getMaxNodeId());
  await page.evaluate(() => {
    const map = window.editor.getView().getNodeMap();
    const id = Object.keys(map).find((k) => map[k].getType && map[k].getType() === 'Person' && map[k].getLinkedRecordRef());
    document.dispatchEvent(new CustomEvent('pedigree:person:newparent', { detail: { personID: parseInt(id, 10) } }));
  });
  await expect.poll(() => page.evaluate(() => window.editor.getGraph().getMaxNodeId())).toBeGreaterThan(before);
  await page.evaluate(() => window.editor.getActionStack().undo());
  await expect.poll(() => page.evaluate(() => window.editor.getGraph().getMaxNodeId())).toBe(before);
  expect(await note()).toBe('from the record');

  const resaved = await exportGA4GH(page);
  expect(resaved).not.toContain('[object Object]');
  expect(questionnaireResponses(resaved).flatMap((qr) => qr.item)).toContainEqual({ linkId: 'note', answer: [{ valueString: 'from the record' }] });
});

test('an answer that arrived late and was then changed saves as changed, in one QuestionnaireResponse', async ({ page }) => {
  const { note, linkedPersonId } = await loadBeforeQuestionnaireArrives(page);
  await expect.poll(note, { timeout: 10000 }).toBe('from the record');

  const id = await linkedPersonId();
  await setNodeProperty(page, id, { setQuestionnaireAnswer_note: 'changed here' });
  expect(await note()).toBe('changed here');

  const resaved = await exportGA4GH(page);
  const responses = questionnaireResponses(resaved);
  expect(responses).toHaveLength(1);
  expect(responses[0].item).toContainEqual({ linkId: 'note', answer: [{ valueString: 'changed here' }] });
});

// Calendar dates are the day they are in any time zone - toISOString()/new Date('YYYY-MM-DD')
// work in UTC, the day before east (showing) or west (reading) of it.
const DATE_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  url: 'http://example.org/Questionnaire/e2e-dates',
  version: '1.0',
  item: [{
    linkId: 'person', type: 'group', text: 'Person',
    item: [{
      linkId: 'dob', type: 'date', text: 'Date of birth',
      definition: 'http://hl7.org/fhir/StructureDefinition/Patient#Patient.birthDate',
      extension: [{ url: FIELD_MAPPING_URL, valueCode: 'mapsToField' }],
    }],
  }],
};

const birthDay = (page, personId) => page.evaluate((id) => {
  const d = window.editor.getView().getNode(parseInt(id, 10)).getBirthDate();
  return d ? [d.getFullYear(), d.getMonth() + 1, d.getDate()] : null;
}, personId);

for (const timezoneId of ['Australia/Brisbane', 'America/New_York']) {
  test.describe(`dates in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test('the node menu shows a person\'s date of birth as that day', async ({ page }) => {
      await loadEditor(page, { questionnaire: DATE_QUESTIONNAIRE });
      const personId = await openNodeMenuForProband(page);
      await page.evaluate((id) => {
        document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: { nodeID: parseInt(id, 10), properties: { setBirthDate: new Date(2016, 6, 12) } } }));
        window.editor.getNodeMenu().show(window.editor.getView().getNode(parseInt(id, 10)), 100, 100);
      }, personId);
      await expect(page.locator(`${VISIBLE_MENU} .field-dob input.xwiki-date`)).toHaveValue('2016-07-12');
    });

    test('a date picked in the node menu is stored as that day', async ({ page }) => {
      await loadEditor(page, { questionnaire: DATE_QUESTIONNAIRE });
      const personId = await openNodeMenuForProband(page);
      await page.evaluate(() => {
        const input = document.querySelector('.menu-box:not([style*="display: none"]) .field-dob input.xwiki-date')
          || [...document.querySelectorAll('.field-dob input.xwiki-date')].find((el) => el.offsetParent);
        input._flatpickr.setDate('2016-07-12', true);
      });
      await expect.poll(() => birthDay(page, personId)).toEqual([2016, 7, 12]);
    });

    test('a YYYY-MM-DD date of birth set on a person is that day', async ({ page }) => {
      await loadEditor(page, { questionnaire: DATE_QUESTIONNAIRE });
      const personId = await openNodeMenuForProband(page);
      await setNodeProperty(page, personId, { setBirthDate: '2016-07-12' });
      expect(await birthDay(page, personId)).toEqual([2016, 7, 12]);
    });

    test('a date of birth from a linked record is that day', async ({ page }) => {
      await loadEditor(page, { recordLinkProvider: true, questionnaire: ROUND_TRIP_QUESTIONNAIRE });
      const personId = await openNodeMenuForProband(page);
      await setNodeProperty(page, personId, { setLinkedRecordRef: 'record:1/instance:1' });
      await refreshWith(page, personId, [{ linkId: 'dob', value: '2016-07-12' }]);
      expect(await birthDay(page, personId)).toEqual([2016, 7, 12]);

      // And the same date again is no change: no new undo step.
      const undoSize = () => page.evaluate(() => window.editor.getActionStack()._size());
      const before = await undoSize();
      await refreshWith(page, personId, [{ linkId: 'dob', value: '2016-07-12' }]);
      expect(await undoSize()).toBe(before);

      // The person still holds the record's date, so emptying it in the record clears it.
      await refreshWith(page, personId, [{ linkId: 'dob', value: null }]);
      expect(await birthDay(page, personId)).toBeNull();
    });
  });
}
