import Controller from 'pedigree/controller';
import SaveLoadEngine from 'pedigree/saveLoadEngine';
import View from 'pedigree/view';
import DynamicPositionedGraph from 'pedigree/model/dynamicGraph';

import Workspace from 'pedigree/view/workspace';
import DisorderLegend from 'pedigree/view/disorderLegend';
import PhenotypeLegend from 'pedigree/view/phenotypeLegend';
import GeneLegend from 'pedigree/view/geneLegend';
import ExportSelector from 'pedigree/view/exportSelector';
import ImportSelector from 'pedigree/view/importSelector';
import NodeMenu from 'pedigree/view/nodeMenu';
import NodetypeSelectionBubble from 'pedigree/view/nodetypeSelectionBubble';
import TemplateSelector from 'pedigree/view/templateSelector';
import ActionStack from 'pedigree/undoRedo';
import VersionUpdater from 'pedigree/versionUpdater';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';
import DefaultFhirTerminologyHelper from 'pedigree/DefaultFhirTerminologyHelper';

import '../style/editor.css';
import CTSSTerminology from 'pedigree/terminology/CTSSTerminology';
import FHIRTerminology from 'pedigree/terminology/FHIRTerminology';
import DelegatingTerminology from 'pedigree/terminology/DelegatingTerminology';
import StaticTerminology from 'pedigree/terminology/StaticTerminology';
import EmptyTerminology from 'pedigree/terminology/EmptyTerminology';
import {DisorderTermType} from 'pedigree/terminology/disorderTerm';
import {PhenotypeTermType} from 'pedigree/terminology/phenotypeTerm';
import {GeneTermType} from 'pedigree/terminology/geneTerm';
import BioportalTerminology from './terminology/BioportalTerminology';
import EmptyPatientProvider from 'pedigree/patientProvider/EmptyPatientProvider';
import EmptyRecordLinkProvider from 'pedigree/recordLinkProvider/EmptyRecordLinkProvider';
import type AbstractRecordLinkProvider from 'pedigree/recordLinkProvider/AbstractRecordLinkProvider';
import type { RecordLinkAction } from 'pedigree/recordLinkProvider/AbstractRecordLinkProvider';
import { computeLinkedRecordRefresh, sameValue } from 'pedigree/recordLinkProvider/linkedRecordRefresh';
import { parseQuestionnaire, RESERVED_LEGEND_TARGETS, MAPS_TO_FIELD_TARGETS, LINKED_RECORD_TAB } from 'pedigree/questionnaire/questionnaireParser';
import Legend from 'pedigree/view/legend';
import { DEFAULT_QUESTIONNAIRE } from 'pedigree/questionnaire/defaultQuestionnaire';

export default class PedigreeEditor {
  DEBUG_MODE: any;
  _omimServiceUrl: string;
  _hpoServiceUrl: string;
  _graphModel: any;
  _workspace: any;
  _nodeMenu: any;
  _nodeGroupMenu: any;
  _partnershipMenu: any;
  _nodetypeSelectionBubble: any;
  _siblingSelectionBubble: any;
  _disorderLegend: any;
  _geneLegend: any;
  _phenotypeLegend: any;
  _disorderTerminology: any;
  _geneTerminology: any;
  _phenotypeTerminology: any;
  _fhirTerminologyHelper: any;
  _view: any;
  _actionStack: any;
  _templateSelector: any;
  _importSelector: any;
  _exportSelector: any;
  _versionUpdater: any;
  _saveLoadEngine: any;
  _closing: any;
  _controller: any;
  _patientProvider: any;
  _recordLinkProvider: any;
  _questionnaireConfig: any;
  _questionnaireTerminologies: any;
  _questionnaireLegends: any;

  constructor(options: any) {
    options = options || {};

    var returnUrl = options.returnUrl || 'https://github.com/aehrc/open-pedigree';

    var patientDataUrl = options.patientDataUrl || '';
    var backend = options.backend || {};
    var enableAutosave = options.autosave || false;

    if (backend.save === undefined || typeof backend.save !== 'function') {
      console.error('No "save" function provided for backend');
    }
    if (backend.load === undefined || typeof backend.save !== 'function') {
      console.error('No "load" function provided for backend');
    }

    this.DEBUG_MODE = Boolean(options.DEBUG_MODE);
    this._omimServiceUrl = options.omimServiceUrl || '';
    this._hpoServiceUrl  = options.hpoServiceUrl  || '';

    this._patientProvider = options.patientProvider || new EmptyPatientProvider();
    this._recordLinkProvider = options.recordLinkProvider || new EmptyRecordLinkProvider();

    (window as any).editor = this;

    this._questionnaireTerminologies = {};
    this._questionnaireLegends = {};
    if (options.questionnaireLocal) {
      this._questionnaireConfig = this._parseQuestionnaireConfig(options.questionnaireLocal);
    } else {
      // Always an effective Questionnaire (see questionnaire-source-of-truth design D14) -
      // the built-in default until/unless a questionnaireUrl fetch resolves.
      this._questionnaireConfig = this._parseQuestionnaireConfig(DEFAULT_QUESTIONNAIRE);
    }

    this._graphModel = DynamicPositionedGraph.makeEmpty(PedigreeEditorParameters.attributes.layoutRelativePersonWidth, PedigreeEditorParameters.attributes.layoutRelativeOtherWidth);

    this._workspace = new Workspace();
    // Must run after Workspace exists - a legend-mapped item constructs a Legend instance,
    // whose constructor calls editor.getWorkspace().getWorkArea().
    this._initialiseQuestionnaireTerminologies(options);
    this._nodeMenu = this.generateNodeMenu();
    this._nodeGroupMenu = this.generateNodeGroupMenu();
    this._partnershipMenu = this.generatePartnershipMenu();
    this._nodetypeSelectionBubble = new NodetypeSelectionBubble(false);
    this._siblingSelectionBubble  = new NodetypeSelectionBubble(true);
    this._disorderTerminology = this._initialiseTerminology(DisorderTermType, options);
    this._geneTerminology = this._initialiseTerminology(GeneTermType, options);
    this._phenotypeTerminology = this._initialiseTerminology(PhenotypeTermType, options);
    this._disorderLegend = new DisorderLegend(this._disorderTerminology);
    this._geneLegend = new GeneLegend(this._geneTerminology);
    this._phenotypeLegend = new PhenotypeLegend(this._phenotypeTerminology);

    if (options.hasOwnProperty('fhirTerminologyHelper')){
      console.log('Using passed terminology helper');
      this._fhirTerminologyHelper = options.fhirTerminologyHelper;
    } else if (options.hasOwnProperty('fhirTerminologyHelperOptions')){
      let fhirTerminologyHelperOptions = options.fhirTerminologyHelperOptions;
      console.log('Creating terminology helper using options', fhirTerminologyHelperOptions);
      this._fhirTerminologyHelper = new DefaultFhirTerminologyHelper(
        fhirTerminologyHelperOptions.disorderCodeSystem,
        fhirTerminologyHelperOptions.phenotypeCodeSystem,
        fhirTerminologyHelperOptions.geneCodeSystem);
      console.log('Creating terminology helper using options', fhirTerminologyHelperOptions, this._fhirTerminologyHelper);
    } else {
      console.log('Creating default terminology helper with no options');
      this._fhirTerminologyHelper = new DefaultFhirTerminologyHelper();
    }

    this._view = new View();

    this._actionStack = new ActionStack();
    this._templateSelector = new TemplateSelector();
    this._importSelector = new ImportSelector();
    this._exportSelector = new ExportSelector();
    this._versionUpdater = new VersionUpdater();
    this._saveLoadEngine = new SaveLoadEngine(backend);

    this._saveLoadEngine.load(patientDataUrl, this._saveLoadEngine);
    this._closing = false;

    this._controller = new Controller();

    var undoButton = document.getElementById('action-undo');
    undoButton && undoButton.addEventListener('click', function(event: any) {
      document.dispatchEvent(new CustomEvent('pedigree:undo'));
    });
    var redoButton = document.getElementById('action-redo');
    redoButton && redoButton.addEventListener('click', function(event: any) {
      document.dispatchEvent(new CustomEvent('pedigree:redo'));
    });

    var clearButton = document.getElementById('action-clear');
    clearButton && clearButton.addEventListener('click', function(event: any) {
      document.dispatchEvent(new CustomEvent('pedigree:graph:clear'));
    });

    var saveButton = document.getElementById('action-save');
    saveButton && saveButton.addEventListener('click', function(event: any) {
      editor.getView().unmarkAll();
      if (patientDataUrl) {
        editor.getSaveLoadEngine().save(patientDataUrl);
      }
    });

    var templatesButton = document.getElementById('action-templates');
    templatesButton && templatesButton.addEventListener('click', function(event: any) {
      editor.getTemplateSelector().show();
    });
    var importButton = document.getElementById('action-import');
    importButton && importButton.addEventListener('click', function(event: any) {
      editor.getImportSelector().show();
    });
    var exportButton = document.getElementById('action-export');
    exportButton && exportButton.addEventListener('click', function(event: any) {
      editor.getExportSelector().show();
    });

    var closeButton = document.getElementById('action-close');
    closeButton && closeButton.addEventListener('click', function(event: any) {
      if (enableAutosave) {
        editor.getSaveLoadEngine().save(patientDataUrl);
      }
      if (returnUrl === '#CloseWindow'){
        console.log('Attempt to close the window');
        window.close();
      } else if (returnUrl) {
        (window as any).location = returnUrl;
      }
    });

    window.addEventListener('beforeunload', (event) => {
      if (!this._closing){
        event.preventDefault();
        event.returnValue = 'Are you sure you want to leave?';
      }
    });

    var unsupportedBrowserButton = document.getElementById('action-readonlymessage');
    unsupportedBrowserButton && unsupportedBrowserButton.addEventListener('click', function(event: any) {
      alert('Your browser does not support all the features required for ' +
                  'Pedigree Editor, so pedigree is displayed in read-only mode (and may have quirks).\n\n' +
                  'Supported browsers include Firefox v3.5+, Internet Explorer v9+, ' +
                  'Chrome, Safari v4+, Opera v10.5+ and most mobile browsers.');
    });

    if (enableAutosave) {
      const autosave = this.autosave(patientDataUrl);
      document.addEventListener('pedigree:graph:clear',               autosave);
      document.addEventListener('pedigree:undo',                      autosave);
      document.addEventListener('pedigree:redo',                      autosave);
      document.addEventListener('pedigree:node:remove',               autosave);
      document.addEventListener('pedigree:node:setproperty',          autosave);
      document.addEventListener('pedigree:node:modify',               autosave);
      document.addEventListener('pedigree:person:drag:newparent',     autosave);
      document.addEventListener('pedigree:person:drag:newpartner',    autosave);
      document.addEventListener('pedigree:person:drag:newsibling',    autosave);
      document.addEventListener('pedigree:person:newparent',          autosave);
      document.addEventListener('pedigree:person:newsibling',         autosave);
      document.addEventListener('pedigree:person:newpartnerandchild', autosave);
      document.addEventListener('pedigree:partnership:newchild',      autosave);
    }

    if (options.questionnaireUrl && !options.questionnaireLocal) {
      this._loadQuestionnaireFromUrl(options.questionnaireUrl, options);
    }
  }

  autosave(patientDataUrl: any): any {
    return () => {
      editor.getSaveLoadEngine().save(patientDataUrl);
    };
  }

  /**
   * Fetches a Questionnaire from questionnaireUrl and, once resolved, replaces the editor's
   * effective Questionnaire and entirely rebuilds the node menu from it (tabs and all - see
   * questionnaire-source-of-truth design D14). Node instances constructed before the fetch
   * resolved get their per-item setters retroactively re-synthesized. On failure, the editor
   * keeps rendering the built-in default Questionnaire it started with.
   */
  _loadQuestionnaireFromUrl(url: any, options: any): void {
    var _this = this;
    fetch(url)
      .then(function(response: any) {
        if (!response.ok) {
          throw new Error('Unexpected response status ' + response.status);
        }
        return response.json();
      })
      .then(function(questionnaire: any) {
        if (!questionnaire || questionnaire.resourceType !== 'Questionnaire') {
          throw new Error('Resource at questionnaireUrl is not a Questionnaire');
        }
        _this._questionnaireConfig = _this._parseQuestionnaireConfig(questionnaire);
        _this._questionnaireTerminologies = {};
        _this._questionnaireLegends = {};
        _this._initialiseQuestionnaireTerminologies(options);

        var view = _this.getView();
        if (view) {
          var nodeMap = view.getNodeMap();
          for (var nodeID in nodeMap) {
            if (nodeMap.hasOwnProperty(nodeID) && nodeMap[nodeID].getType && nodeMap[nodeID].getType() === 'Person') {
              nodeMap[nodeID]._synthesizeQuestionnaireSetters();
            }
          }
        }

        _this._rebuildNodeMenu();
      })
      .catch(function(err: any) {
        console.warn('Failed to load questionnaireUrl - continuing with the built-in default Questionnaire', err);
      });
  }

  /**
   * Discards the current node menu (if any) and regenerates it from the (now possibly
   * updated) effective Questionnaire config.
   */
  _rebuildNodeMenu(): void {
    if (this._nodeMenu && this._nodeMenu.menuBox && this._nodeMenu.menuBox.parentNode) {
      this._nodeMenu.hide();
      this._nodeMenu.menuBox.parentNode.removeChild(this._nodeMenu.menuBox);
    }
    this._nodeMenu = this.generateNodeMenu();
  }

  _initialiseQuestionnaireTerminologies(options: any): void {
    if (!this._questionnaireConfig) {
      return;
    }
    var _this = this;
    this._questionnaireConfig.items.forEach(function(item: any) {
      if (item.fieldType !== 'questionnaire-choice-picker' && item.fieldType !== 'questionnaire-legend-picker') {
        return;
      }
      if (RESERVED_LEGEND_TARGETS.hasOwnProperty(item.linkId)) {
        return;
      }
      var termOptionsKey = item.linkId + 'Options';
      var termOptions = (options.questionnaireTerminologyOptions && options.questionnaireTerminologyOptions[item.linkId])
        || options[termOptionsKey];
      if (!termOptions) {
        var baseUrl = options.questionnaireTerminologyBaseUrl;
        if (!baseUrl) {
          console.warn('Questionnaire item ' + item.linkId + ' has an answerValueSet but no questionnaireTerminologyBaseUrl (or per-item options) configured - falling back to plain rendering');
          item.fieldType = item.answerOption ? 'select' : 'text';
          return;
        }
        termOptions = { type: 'FHIR', fhirBaseUrl: baseUrl, valueSet: item.answerValueSet };
      }
      var syntheticOptions: any = {};
      syntheticOptions[termOptionsKey] = termOptions;
      _this._questionnaireTerminologies[item.linkId] = _this._initialiseTerminology(item.linkId, syntheticOptions);

      if (item.fieldType === 'questionnaire-legend-picker') {
        _this._questionnaireLegends[item.linkId] = new Legend(item.label, _this._questionnaireTerminologies[item.linkId], 'legend-' + item.linkId);
      }
    });
  }

  /**
   * Builds NodeMenu field descriptors for the "Custom" tab from the parsed Questionnaire
   * config. mapsToField-mapped items are excluded (see design D9) - they read/write the
   * existing property directly and are not rendered separately.
   */
  /**
   * Wraps parseQuestionnaire() with the three built-in record-link-provider action items
   * (linkRecord/createNewRecord/editRecord - see record-link-provider design D1/D2), appended
   * onto the reserved LINKED_RECORD_TAB so they flow through the same generic
   * enableWhen/getSummary()/dispatch machinery as every other Questionnaire-driven action
   * (mirroring linkPatient/importClinicalData exactly). Kept out of parseQuestionnaire() itself
   * so the parser's own output stays a pure function of the raw Questionnaire.
   */
  _parseQuestionnaireConfig(questionnaire: any): any {
    var config = parseQuestionnaire(questionnaire);
    var provider: Partial<Pick<AbstractRecordLinkProvider, 'getActionLabel'>> = this.getRecordLinkProvider();
    // A provider may relabel its actions (AbstractRecordLinkProvider.getActionLabel); anything
    // other than a non-blank string keeps the generic default. Checked by presence, since a host
    // can pass a duck-typed provider that doesn't extend AbstractRecordLinkProvider. A throw is
    // contained here: this runs in the constructor and in the questionnaireUrl reload, and a
    // cosmetic label must never stop the editor loading or discard a fetched Questionnaire.
    var labelFor = function(action: RecordLinkAction, fallback: string): string {
      var custom: unknown;
      try {
        custom = typeof provider.getActionLabel === 'function' ? provider.getActionLabel(action) : undefined;
      } catch (e) {
        console.warn('recordLinkProvider.getActionLabel("' + action + '") threw - using the default label', e);
        custom = undefined;
      }
      return (typeof custom === 'string' && custom.trim() !== '') ? custom : fallback;
    };
    var actionItem = function(linkId: RecordLinkAction, defaultLabel: string, predicate: string): any {
      var label = labelFor(linkId, defaultLabel);
      return {
        linkId: linkId,
        label: label,
        itemType: 'display',
        fieldType: 'button-action',
        tab: LINKED_RECORD_TAB,
        repeats: false,
        mapping: { kind: 'action', action: linkId },
        enableWhen: [{ predicate: predicate, negate: false }],
        enableBehavior: 'all',
        disabledWhen: undefined,
        disabledBehavior: 'all',
        disablingPredicate: null,
        disablingPredicateTarget: 'inactive',
        buttonLabel: label,
        parentGroup: null,
        linkedRecordSource: false
      };
    };
    // Prepended, not appended: the linked-record-tab capability requires the actions to render
    // "at the top, followed by the read-only linked items" - since _buildFieldDescriptors()
    // renders LINKED_RECORD_TAB fields in overall _questionnaireConfig.items array order, these
    // three must sort before every (possibly-regrouped) linkedRecordSource item.
    config.items = [
      actionItem('linkRecord', 'Link to existing record', 'canLinkRecord'),
      actionItem('createNewRecord', 'Create new linked record', 'canCreateNewRecord'),
      actionItem('editRecord', 'Edit linked record', 'canEditLinkedRecord')
    ].concat(config.items);
    return config;
  }

  /**
   * Builds NodeMenu field descriptors (and the tabs array) entirely from the parsed
   * effective Questionnaire config - see questionnaire-source-of-truth design D13.
   * - `invokesAction` items dispatch to a named function in `_questionnaireActions`.
   * - `RESERVED_LEGEND_TARGETS` items (disorders/candidate_genes/hpo_positive) and
   *   `mapsToField` items dispatch straight to their existing real Person setter.
   * - Everything else dispatches through the synthesized `setQuestionnaireAnswer_<linkId>`.
   * - Items marked `linkedRecordSource` are regrouped onto LINKED_RECORD_TAB (sub-headed by
   *   their original parentGroup), and that whole tab (regrouped items and the built-in
   *   link/create-new/edit actions alike) is omitted entirely unless `recordLinkProvider` is
   *   configured - see record-link-provider design D6 and the linked-record-tab capability.
   */
  _buildFieldDescriptors(): any {
    if (!this._questionnaireConfig) {
      return { fields: [], tabs: [] };
    }
    var _this = this;
    var fields: any[] = [];
    var recordLinkConfigured = this.getRecordLinkProvider().isConfigured();
    // Tracks the parentGroup.key of the most recently emitted linkedRecordSource item (not a
    // "seen ever" set) so a new sub-heading is emitted whenever the run of consecutive
    // linkedRecordSource items changes group - including a group reappearing non-contiguously
    // (e.g. interrupted by a nested subgroup's own linkedRecordSource items), which otherwise
    // would misattribute the later item under the wrong (in-between) heading.
    var lastLinkedRecordGroupKey: any = undefined;
    var linkedRecordHeadingCounts: any = {};

    this._questionnaireConfig.items.forEach(function(item: any) {
      if (item.tab && item.tab.key === LINKED_RECORD_TAB.key && !recordLinkConfigured) {
        return;
      }

      var tab = item.tab;
      if (recordLinkConfigured && item.linkedRecordSource) {
        tab = LINKED_RECORD_TAB;
        var groupKey = item.parentGroup ? item.parentGroup.key : null;
        if (groupKey !== lastLinkedRecordGroupKey) {
          if (item.parentGroup) {
            var occurrence = linkedRecordHeadingCounts[groupKey] = (linkedRecordHeadingCounts[groupKey] || 0) + 1;
            fields.push({
              'name': '__linked_record_heading_' + groupKey + '_' + occurrence,
              'label': item.parentGroup.label,
              'type': 'heading',
              'tab': LINKED_RECORD_TAB
            });
          }
          lastLinkedRecordGroupKey = groupKey;
        }
      }

      var descriptor: any = {
        'name': item.linkId,
        'label': item.label,
        'type': item.fieldType,
        'tab': tab,
        'linkId': item.linkId,
        'repeats': item.repeats
      };

      if (item.fieldType === 'select' || item.fieldType === 'radio') {
        if (item.answerOption) {
          descriptor.values = item.answerOption.map(function(opt: any) {
            return { 'actual': opt.value, 'displayed': opt.display };
          });
        }
        if (item.range) {
          descriptor.range = item.range;
        }
        if (item.nullValue) {
          descriptor.nullValue = item.nullValue;
        }
        if (item.columns) {
          descriptor.columns = item.columns;
        }
      }
      if (item.fieldType === 'textarea') {
        descriptor.rows = 2;
      }

      if (item.fieldType === 'button-action') {
        descriptor.buttonLabel = item.buttonLabel;
        descriptor.action = item.mapping && _this._questionnaireActions[item.mapping.action];
      } else if (item.fieldType !== 'heading') {
        descriptor.function = _this._resolveQuestionnaireSetter(item.linkId);
      }

      fields.push(descriptor);
    });

    var tabs = this._questionnaireConfig.tabs.slice();
    if (recordLinkConfigured) {
      tabs.push(LINKED_RECORD_TAB);
    }

    return { fields: fields, tabs: tabs };
  }

  /**
   * Resolves the real Person setter method name for a Questionnaire linkId, using the same
   * priority `_buildFieldDescriptors()` uses when rendering the form: a reserved legend target
   * (disorders/candidate_genes/hpo_positive), then a mapsToField target, then the item's generic
   * synthesized `setQuestionnaireAnswer_<linkId>` setter. Also used by `importClinicalData` (see
   * design D2 of generalize-patient-provider-import) to dispatch imported answers generically.
   */
  _resolveQuestionnaireSetter(linkId: any): any {
    if (RESERVED_LEGEND_TARGETS.hasOwnProperty(linkId)) {
      return RESERVED_LEGEND_TARGETS[linkId].setter;
    }
    var item = this._questionnaireConfig && this._questionnaireConfig.items.find(function(i: any) { return i.linkId === linkId; });
    if (item && item.mapping && item.mapping.kind === 'field') {
      return MAPS_TO_FIELD_TARGETS[item.mapping.field].setter;
    }
    return 'setQuestionnaireAnswer_' + linkId;
  }

  /**
   * Built-in named actions for `invokesAction` Questionnaire items (see design D17) - lifted
   * out of the old hardcoded `link_patient`/`import_from_record` button-action descriptors.
   */
  _questionnaireActions: any = {
    linkPatient: function(menu: any): void {
      var nodeId = menu.targetNode.getID();
      (window as any).editor.getPatientProvider().openPatientPickerModal(nodeId,
        function(patientRef: string, details: any) {
          var properties: any = { setLinkedPatientRef: patientRef, setFirstName: details.firstName };
          if (details.lastName)   properties.setLastName   = details.lastName;
          if (details.gender)     properties.setGender     = details.gender;
          if (details.birthDate)  properties.setBirthDate  = details.birthDate;
          if (details.lifeStatus) properties.setLifeStatus = details.lifeStatus;
          document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
            detail: { nodeID: nodeId, properties: properties }
          }));
        }
      );
    },
    importClinicalData: function(menu: any): void {
      var nodeId = menu.targetNode.getID();
      var node = (window as any).editor.getView().getNode(nodeId);
      var patientRef = node && node.getLinkedPatientRef ? node.getLinkedPatientRef() : '';
      if (!patientRef) {
        return;
      }
      (window as any).editor.getPatientProvider().openClinicalImportModal(nodeId, patientRef,
        function(answers: {linkId: string, value: any}[]) {
          if (!answers || answers.length === 0) {
            return;
          }
          var n = (window as any).editor.getView().getNode(nodeId);
          var properties: any = {};
          answers.forEach(function(answer: any) {
            var linkId = answer.linkId;
            var setterName = (window as any).editor._resolveQuestionnaireSetter(linkId);
            if (RESERVED_LEGEND_TARGETS.hasOwnProperty(linkId)) {
              var target = RESERVED_LEGEND_TARGETS[linkId];
              var existing = (n && n[target.getter]) ? n[target.getter]().slice(0) : [];
              var existingIds = new Set(existing);
              var incoming = (answer.value || [])
                .filter(function(v: any) { return !existingIds.has(v.id); })
                .map(function(v: any) { return v.id; });
              properties[setterName] = existing.concat(incoming);
            } else {
              properties[setterName] = answer.value;
            }
          });
          document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
            detail: { nodeID: nodeId, properties: properties }
          }));
        }
      );
    },
    linkRecord: function(menu: any): void {
      var nodeId = menu.targetNode.getID();
      (window as any).editor.getRecordLinkProvider().openPicker(nodeId,
        function(recordRef: string, _details: any) {
          document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
            // The snapshot reset travels with the new ref, so undo restores both.
            detail: { nodeID: nodeId, properties: { setLinkedRecordRef: recordRef, setLinkedRecordSnapshot: {} } }
          }));
        }
      );
    },
    createNewRecord: function(menu: any): void {
      var nodeId = menu.targetNode.getID();
      (window as any).editor.getRecordLinkProvider().createNew(nodeId,
        function(recordRef: string, answers: {linkId: string, value: any}[]) {
          document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
            // The snapshot reset travels with the new ref, so undo restores both.
            detail: { nodeID: nodeId, properties: { setLinkedRecordRef: recordRef, setLinkedRecordSnapshot: {} } }
          }));
          (window as any).editor._dispatchLinkedRecordRefresh(nodeId, answers);
        }
      );
    },
    editRecord: function(menu: any): void {
      var nodeId = menu.targetNode.getID();
      var node = (window as any).editor.getView().getNode(nodeId);
      var recordRef = node && node.getLinkedRecordRef ? node.getLinkedRecordRef() : '';
      if (!recordRef) {
        return;
      }
      (window as any).editor.getRecordLinkProvider().openEditor(nodeId,
        function(answers: {linkId: string, value: any}[]) {
          (window as any).editor._dispatchLinkedRecordRefresh(nodeId, answers);
        }
      );
    }
  };

  /**
   * Dispatches an `{linkId, value}[]` answer bag through the same per-linkId setter-resolution
   * priority `importClinicalData` uses (see record-link-provider design D3) - shared by
   * `createNewRecord`/`editRecord`, which reuse the exact answer-bag shape and dispatch path
   * `generalize-patient-provider-import` established for patient-provider's onImported.
   */
  _dispatchQuestionnaireAnswers(nodeId: any, answers: {linkId: string, value: any}[]): void {
    if (!answers || answers.length === 0) {
      return;
    }
    var n = (window as any).editor.getView().getNode(nodeId);
    var properties: any = {};
    answers.forEach(function(answer: any) {
      var linkId = answer.linkId;
      var setterName = (window as any).editor._resolveQuestionnaireSetter(linkId);
      if (RESERVED_LEGEND_TARGETS.hasOwnProperty(linkId)) {
        var target = RESERVED_LEGEND_TARGETS[linkId];
        var existing = (n && n[target.getter]) ? n[target.getter]().slice(0) : [];
        var existingIds = new Set(existing);
        var incoming = (answer.value || [])
          .filter(function(v: any) { return !existingIds.has(v.id); })
          .map(function(v: any) { return v.id; });
        properties[setterName] = existing.concat(incoming);
      } else {
        properties[setterName] = answer.value;
      }
    });
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
      detail: { nodeID: nodeId, properties: properties }
    }));
  }

  /**
   * Applies a linked record's answers (record-link-provider `onDone`/`onCreated`): the record's
   * changes since its last refresh are applied - set, cleared (only where the node still holds
   * the record's value) or, for legend lists, reconciled - and nothing entered in the diagram is
   * wiped. See linked-record-round-trip, and linkedRecordRefresh.ts for the rules. Unlike
   * _dispatchQuestionnaireAnswers (patient-provider's one-off import, which merges), only real
   * changes are sent, as one flagged event, and a refresh with no changes adds no undo step.
   */
  _dispatchLinkedRecordRefresh(nodeId: any, answers: {linkId: string, value: any}[]): void {
    var editor = (window as any).editor;
    var node = editor.getView().getNode(nodeId);
    if (!node) {
      return;
    }
    // Getter names don't always mirror setters (setHPO/getPhenotypes).
    var getterFor: any = {};
    Object.keys(RESERVED_LEGEND_TARGETS).forEach(function(linkId: string) {
      getterFor[RESERVED_LEGEND_TARGETS[linkId].setter] = RESERVED_LEGEND_TARGETS[linkId].getter;
    });
    Object.keys(MAPS_TO_FIELD_TARGETS).forEach(function(field: string) {
      getterFor[MAPS_TO_FIELD_TARGETS[field].setter] = MAPS_TO_FIELD_TARGETS[field].getter;
    });
    var resolveSetter = function(linkId: string): string {
      return editor._resolveQuestionnaireSetter(linkId);
    };
    var current = function(setter: string): any {
      var getter = getterFor[setter] || setter.replace(/^set/, 'get');
      return typeof node[getter] === 'function' ? node[getter]() : undefined;
    };
    var itemFor = function(linkId: string): any {
      var config = editor._questionnaireConfig;
      return config && config.items.find(function(i: any) { return i.linkId === linkId; });
    };
    var isReserved = function(linkId: string): boolean {
      return RESERVED_LEGEND_TARGETS.hasOwnProperty(linkId);
    };
    // Reserved legends store sanitised IDs (terminology.sanitizeID, e.g. "HP:1" -> "HP_C_1"),
    // so compare through the same function; custom legend items store {system, code, display}.
    var sanitise = function(linkId: string, id: any): string {
      var terminology = editor.getQuestionnaireTerminology(linkId);
      var raw = id === undefined || id === null ? '' : String(id);
      return terminology && typeof terminology.sanitizeID === 'function' ? terminology.sanitizeID(raw) : raw;
    };
    // An answer for a linkId the effective Questionnaire doesn't declare has no setter on the node.
    var usable = (answers || []).filter(function(answer: any) {
      return answer && typeof node[resolveSetter(answer.linkId)] === 'function';
    });
    var previousSnapshot = node.getLinkedRecordSnapshot();
    var result = computeLinkedRecordRefresh({
      answers: usable,
      resolveSetter: resolveSetter,
      isLegend: function(linkId: string): boolean {
        var item = itemFor(linkId);
        return isReserved(linkId)
          || !!(item && item.mapping && (item.mapping.kind === 'legendCondition' || item.mapping.kind === 'legendObservation'));
      },
      incomingLegendKey: function(linkId: string, entry: any): string {
        return isReserved(linkId) ? sanitise(linkId, entry && typeof entry === 'object' ? entry.id : entry) : String(entry && entry.code);
      },
      storedLegendKey: function(linkId: string, entry: any): string {
        return isReserved(linkId) ? sanitise(linkId, entry) : String(entry && entry.code);
      },
      legendSetterEntry: function(linkId: string, entry: any): any {
        return isReserved(linkId) ? (entry && typeof entry === 'object' ? entry.id : entry) : entry;
      },
      current: current,
      snapshot: previousSnapshot
    });
    var snapshotChanged = JSON.stringify(result.snapshot) !== JSON.stringify(previousSnapshot);
    if (!result.valuesChanged && !snapshotChanged) {
      return;
    }

    // Record fields (other than the ones being changed) whose node value matches the record now,
    // so a setter side effect that wipes one (e.g. clearing life status also clears the death
    // date) can be put back afterwards.
    var holding: string[] = [];
    Object.keys(result.snapshot).forEach(function(linkId: string) {
      var setter = resolveSetter(linkId);
      if (!result.properties.hasOwnProperty(setter) && !isReserved(linkId)
          && typeof node[setter] === 'function' && sameValue(setter, current(setter), result.snapshot[linkId])) {
        holding.push(linkId);
      }
    });

    var properties: any = result.properties;
    if (snapshotChanged) {
      properties.setLinkedRecordSnapshot = result.snapshot;
    }
    document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
      detail: {
        nodeID: nodeId,
        properties: properties,
        linkedRecordRefresh: true,
        // Only the bookkeeping changed - nothing the user could see or want to undo.
        noUndoRedo: !result.valuesChanged
      }
    }));

    var restore: any = {};
    holding.forEach(function(linkId: string) {
      var setter = resolveSetter(linkId);
      if (!sameValue(setter, current(setter), result.snapshot[linkId])) {
        restore[setter] = result.snapshot[linkId];
      }
    });
    if (Object.keys(restore).length > 0) {
      document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
        detail: { nodeID: nodeId, properties: restore, linkedRecordRefresh: true }
      }));
    }
  }

  getQuestionnaireConfig(): any {
    return this._questionnaireConfig;
  }

  getQuestionnaireTerminology(linkId: any): any {
    switch (linkId) {
    case 'disorders':
      return this._disorderTerminology;
    case 'candidate_genes':
      return this._geneTerminology;
    case 'hpo_positive':
      return this._phenotypeTerminology;
    default:
      return this._questionnaireTerminologies[linkId];
    }
  }

  getQuestionnaireLegend(linkId: any): any {
    switch (linkId) {
    case 'disorders':
      return this._disorderLegend;
    case 'candidate_genes':
      return this._geneLegend;
    case 'hpo_positive':
      return this._phenotypeLegend;
    default:
      return this._questionnaireLegends[linkId];
    }
  }

  getNode(nodeID: any): any {
    return this.getView().getNode(nodeID);
  }

  flagClosing(isClosing: any): void {
    this._closing = isClosing;
  }

  getView(): any {
    return this._view;
  }

  getVersionUpdater(): any {
    return this._versionUpdater;
  }

  getGraph(): any {
    return this._graphModel;
  }

  getController(): any {
    return this._controller;
  }

  getActionStack(): any {
    return this._actionStack;
  }

  getNodetypeSelectionBubble(): any {
    return this._nodetypeSelectionBubble;
  }

  getSiblingSelectionBubble(): any {
    return this._siblingSelectionBubble;
  }

  getWorkspace(): any {
    return this._workspace;
  }

  getLegend(termType: any): any {
    switch (termType){
    case DisorderTermType:
      return this.getDisorderLegend();
    case PhenotypeTermType:
      return this.getPhenotypeLegend();
    case GeneTermType:
      return this.getGeneLegend();
    }
    console.log('Unknown term type ' + termType);
    return null;
  }

  getDisorderLegend(): any {
    return this._disorderLegend;
  }

  getPhenotypeLegend(): any {
    return this._phenotypeLegend;
  }

  getGeneLegend(): any {
    return this._geneLegend;
  }

  getFhirTerminologyHelper(): any {
    return this._fhirTerminologyHelper;
  }

  getPaper(): any {
    return this.getWorkspace().getPaper();
  }

  isReadOnlyMode(): any {
    if (this.isUnsupportedBrowser()) {
      return true;
    }
    return false;
  }

  isUnsupportedBrowser(): any {
    if (!document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1')) {
      return true;
    }
    if (!(window as any).JSON) {
      alert('Your browser is not supported and is unable to load and display any pedigrees.\n\n' +
                  'Suported browsers include Internet Explorer version 9 and higher, Safari version 4 and higher, '+
                  'Firefox version 3.6 and higher, Opera version 10.5 and higher, any version of Chrome and most '+
                  'other modern browsers (including mobile). IE8 is able to display pedigrees in read-only mode.');
      (window as any).stop && (window as any).stop();
      return true;
    }
    return false;
  }

  getSaveLoadEngine(): any {
    return this._saveLoadEngine;
  }

  getPatientProvider(): any {
    return this._patientProvider;
  }

  getRecordLinkProvider(): any {
    return this._recordLinkProvider;
  }

  getTemplateSelector(): any {
    return this._templateSelector;
  }

  getImportSelector(): any {
    return this._importSelector;
  }

  getExportSelector(): any {
    return this._exportSelector;
  }

  isAnyMenuVisible(): any {
    if (this.getNodeMenu().isVisible() || this.getNodeGroupMenu().isVisible() || this.getPartnershipMenu().isVisible()) {
      return;
    }
  }

  generateNodeMenu(): any {
    if (this.isReadOnlyMode()) {
      return null;
    }
    var built = this._buildFieldDescriptors();
    return new NodeMenu(built.fields, built.tabs);
  }

  getNodeMenu(): any {
    return this._nodeMenu;
  }

  generateNodeGroupMenu(): any {
    if (this.isReadOnlyMode()) {
      return null;
    }
    var _this = this;
    return new NodeMenu([
      {
        'name' : 'identifier',
        'label' : '',
        'type'  : 'hidden'
      },
      {
        'name' : 'gender',
        'label' : 'Gender',
        'type' : 'radio',
        'columns': 3,
        'values' : [
          { 'actual' : 'M', 'displayed' : 'Male' },
          { 'actual' : 'F', 'displayed' : 'Female' },
          { 'actual' : 'U', 'displayed' : 'Unknown' }
        ],
        'default' : 'U',
        'function' : 'setGender'
      },
      {
        'name' : 'numInGroup',
        'label': 'Number of persons in this group',
        'type' : 'select',
        'values' : [{'actual': 1, displayed: 'N'}, {'actual': 2, displayed: '2'}, {'actual': 3, displayed: '3'},
          {'actual': 4, displayed: '4'}, {'actual': 5, displayed: '5'}, {'actual': 6, displayed: '6'},
          {'actual': 7, displayed: '7'}, {'actual': 8, displayed: '8'}, {'actual': 9, displayed: '9'}],
        'function' : 'setNumPersons'
      },
      {
        'name' : 'external_ids',
        'label': 'Identifier(s)',
        'type' : 'text',
        'function' : 'setExternalID'
      },
      {
        'name' : 'disorders',
        'label' : 'Known disorders<br>(common to all individuals in the group)',
        'type' : 'disease-picker',
        'function' : 'setDisorders'
      },
      {
        'name' : 'comments',
        'label' : 'Comments',
        'type' : 'textarea',
        'rows' : 2,
        'function' : 'setComments'
      },
      {
        'name' : 'state',
        'label' : 'All individuals in the group are',
        'type' : 'radio',
        'values' : [
          { 'actual' : 'alive', 'displayed' : 'Alive' },
          { 'actual' : 'aborted', 'displayed' : 'Aborted' },
          { 'actual' : 'deceased', 'displayed' : 'Deceased' },
          { 'actual' : 'miscarriage', 'displayed' : 'Miscarriage' }
        ],
        'default' : 'alive',
        'function' : 'setLifeStatus'
      },
      {
        'name' : 'evaluatedGrp',
        'label' : 'Documented evaluation',
        'type' : 'checkbox',
        'function' : 'setEvaluated'
      },
      {
        'name' : 'adopted',
        'label' : 'Adopted',
        'type' : 'checkbox',
        'function' : 'setAdopted'
      }
    ], []);
  }

  getNodeGroupMenu(): any {
    return this._nodeGroupMenu;
  }

  generatePartnershipMenu(): any {
    if (this.isReadOnlyMode()) {
      return null;
    }
    var _this = this;
    return new NodeMenu([
      {
        'label' : 'Heredity options',
        'name' : 'childlessSelect',
        'values' : [{'actual': 'none', displayed: 'None'},{'actual': 'childless', displayed: 'Childless'},{'actual': 'infertile', displayed: 'Infertile'}],
        'type' : 'select',
        'function' : 'setChildlessStatus'
      },
      {
        'name' : 'consangr',
        'label' : 'Consanguinity of this relationship',
        'type' : 'radio',
        'values' : [
          { 'actual' : 'A', 'displayed' : 'Automatic' },
          { 'actual' : 'Y', 'displayed' : 'Yes' },
          { 'actual' : 'N', 'displayed' : 'No' }
        ],
        'default' : 'A',
        'function' : 'setConsanguinity'
      },
      {
        'name' : 'broken',
        'label' : 'Separated',
        'type' : 'checkbox',
        'function' : 'setBrokenStatus'
      }
    ], [], 'relationship-menu');
  }

  getPartnershipMenu(): any {
    return this._partnershipMenu;
  }

  getOmimServiceUrl(): string {
    return this._omimServiceUrl;
  }

  getHpoServiceUrl(): string {
    return this._hpoServiceUrl;
  }

  convertGraphCoordToCanvasCoord(x: any, y: any): any {
    var scale = PedigreeEditorParameters.attributes.layoutScale;
    return { x: x * scale.xscale,
      y: y * scale.yscale };
  }

  _initialiseTerminology(termType: any, options: any): any {
    const defaultIdRegex = /.+/;
    const defaultSearchCount = 20;
    const defaultTermOptions: any = {
      'disorder': {
        'type' : 'CTSS',
        'ctssBaseUrl' : this._omimServiceUrl,
        'valueColumn' : 'id',
        'textColumn' : 'name'
      },
      'phenotype': {
        'type' : 'CTSS',
        'validIdRegex' : /^HP:(\d)+$/i,
        'ctssBaseUrl' : this._hpoServiceUrl,
        'valueColumn' : 'id',
        'textColumn' : 'name'
      },
      'gene': {
        'type' : 'Empty'
      }
    };

    if (options.hasOwnProperty(termType + 'Terminology')){
      return options[termType + 'Terminology'];
    }
    let resultTerminology: any;
    let termOptions = options.hasOwnProperty(termType + 'Options') ? options[termType + 'Options'] : Object.assign({}, defaultTermOptions[termType]);
    switch (termOptions.type){
    case 'CTSS':
      resultTerminology = new CTSSTerminology(termType,
        termOptions.validIdRegex ? termOptions.validIdRegex : defaultIdRegex,
        termOptions.searchCount ? termOptions.searchCount : defaultSearchCount,
        termOptions.ctssBaseUrl, termOptions.valueColumn, termOptions.textColumn);
      break;
    case 'FHIR':
      resultTerminology =  new FHIRTerminology(termType, termOptions.codeSystem,
        termOptions.validIdRegex ? termOptions.validIdRegex : defaultIdRegex,
        termOptions.searchCount ? termOptions.searchCount : defaultSearchCount,
        termOptions.fhirBaseUrl, termOptions.valueSet,
        termOptions.lookupAjaxOptions ? termOptions.lookupAjaxOptions : {},
        termOptions.searchAjaxOptions ? termOptions.searchAjaxOptions : {});
      break;
    case 'Bioportal':
      resultTerminology = new BioportalTerminology(termType,
        termOptions.validIdRegex ? termOptions.validIdRegex : defaultIdRegex,
        termOptions.searchCount ? termOptions.searchCount : defaultSearchCount,
        termOptions.bioportalBaseUrl, termOptions.ontology, termOptions.apiKey,
        termOptions.lookupAjaxOptions ? termOptions.lookupAjaxOptions : {},
        termOptions.searchAjaxOptions ? termOptions.searchAjaxOptions : {});
      break;
    case 'Delegating':
      resultTerminology = new DelegatingTerminology(termType,
        termOptions.validIdRegex ? termOptions.validIdRegex : defaultIdRegex,
        termOptions.searchCount ? termOptions.searchCount : defaultSearchCount,
        termOptions.lookupUrlFn, termOptions.processLookupResponseFn, termOptions.lookupAjaxOptionsFn,
        termOptions.searchUrlFn, termOptions.processSearchResponseFn, termOptions.searchAjaxOptionsFn);
      break;
    case 'Static':
      resultTerminology = new StaticTerminology(termType,
        termOptions.validIdRegex ? termOptions.validIdRegex : defaultIdRegex,
        termOptions.searchCount ? termOptions.searchCount : defaultSearchCount,
        termOptions.terms
      );
      break;
    case 'Empty':
      resultTerminology = new EmptyTerminology(termType,
        termOptions.validIdRegex ? termOptions.validIdRegex : defaultIdRegex,
        termOptions.searchCount ? termOptions.searchCount : defaultSearchCount);
      break;
    default:
      console.error('Unknown terminology type ' + termOptions.type);
      resultTerminology = new EmptyTerminology(termType, defaultIdRegex, defaultSearchCount);
    }
    return resultTerminology;
  }
}
