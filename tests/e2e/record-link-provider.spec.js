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

async function loadEditor(page, { recordLinkProvider, questionnaire, actionLabels, terminologyBaseUrl } = {}) {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

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
          window.__pendingLink && onLinked(window.__pendingLink.ref, window.__pendingLink.details);
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

    // localEditor.html already created an editor whose Controller listens on document; left
    // alone, every setproperty event would be handled twice (once per Controller), hiding
    // bugs and doubling undo steps. Its listeners call this.handleX(e), so shadowing those
    // methods on the old instance retires it.
    const oldController = window.editor && window.editor.getController && window.editor.getController();
    if (oldController) {
      Object.getOwnPropertyNames(Object.getPrototypeOf(oldController))
        .filter((name) => name.startsWith('handle'))
        .forEach((name) => { oldController[name] = () => {}; });
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

