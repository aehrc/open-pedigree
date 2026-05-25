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

  constructor(options: any) {
    options = options || {};

    var returnUrl = options.returnUrl || 'https://github.com/phenotips/open-pedigree';

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

    (window as any).editor = this;

    this._graphModel = DynamicPositionedGraph.makeEmpty(PedigreeEditorParameters.attributes.layoutRelativePersonWidth, PedigreeEditorParameters.attributes.layoutRelativeOtherWidth);

    this._workspace = new Workspace();
    this._nodeMenu = this.generateNodeMenu();
    this._nodeGroupMenu = this.generateNodeGroupMenu();
    this._partnershipMenu = this.generatePartnershipMenu();
    this._nodetypeSelectionBubble = new NodetypeSelectionBubble(false);
    this._siblingSelectionBubble  = new NodetypeSelectionBubble(true);
    this._disorderLegend = new DisorderLegend(this._initialiseTerminology(DisorderTermType, options));
    this._geneLegend = new GeneLegend(this._initialiseTerminology(GeneTermType, options));
    this._phenotypeLegend = new PhenotypeLegend(this._initialiseTerminology(PhenotypeTermType, options));

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
  }

  autosave(patientDataUrl: any): any {
    return () => {
      editor.getSaveLoadEngine().save(patientDataUrl);
    };
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
    var _this = this;
    return new NodeMenu([
      {
        'name' : 'identifier',
        'label' : '',
        'type'  : 'hidden',
        'tab': 'Personal'
      },
      {
        'name' : 'gender',
        'label' : 'Gender',
        'type' : 'radio',
        'tab': 'Personal',
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
        'name' : 'first_name',
        'label': 'First name',
        'type' : 'text',
        'tab': 'Personal',
        'function' : 'setFirstName'
      },
      {
        'name' : 'last_name',
        'label': 'Last name',
        'type' : 'text',
        'tab': 'Personal',
        'function' : 'setLastName'
      },
      {
        'name' : 'external_id',
        'label': 'Identifier',
        'type' : 'text',
        'tab': 'Personal',
        'function' : 'setExternalID'
      },
      {
        'name' : 'carrier',
        'label' : 'Carrier status',
        'type' : 'radio',
        'tab': 'Clinical',
        'values' : [
          { 'actual' : '', 'displayed' : 'Not affected' },
          { 'actual' : 'carrier', 'displayed' : 'Carrier' },
          { 'actual' : 'affected', 'displayed' : 'Affected' },
          { 'actual' : 'presymptomatic', 'displayed' : 'Pre-symptomatic' }
        ],
        'default' : '',
        'function' : 'setCarrierStatus'
      },
      {
        'name' : 'evaluated',
        'label' : 'Documented evaluation',
        'type' : 'checkbox',
        'tab': 'Clinical',
        'function' : 'setEvaluated'
      },
      {
        'name' : 'disorders',
        'label' : 'Disorders',
        'type' : 'disease-picker',
        'tab': 'Clinical',
        'function' : 'setDisorders'
      },
      {
        'name' : 'candidate_genes',
        'label' : 'Genes',
        'type' : 'gene-picker',
        'tab': 'Clinical',
        'function' : 'setGenes'
      },
      {
        'name' : 'hpo_positive',
        'label' : 'Phenotypic features',
        'type' : 'hpo-picker',
        'tab': 'Clinical',
        'function' : 'setHPO'
      },
      {
        'name' : 'date_of_birth',
        'label' : 'Date of birth',
        'type' : 'date-picker',
        'tab': 'Personal',
        'format' : 'dd/MM/yyyy',
        'function' : 'setBirthDate'
      },
      {
        'name' : 'date_of_death',
        'label' : 'Date of death',
        'type' : 'date-picker',
        'tab': 'Personal',
        'format' : 'dd/MM/yyyy',
        'function' : 'setDeathDate'
      },
      {
        'name' : 'state',
        'label' : 'Individual is',
        'type' : 'radio',
        'tab': 'Personal',
        'columns': 3,
        'values' : [
          { 'actual' : 'alive', 'displayed' : 'Alive' },
          { 'actual' : 'stillborn', 'displayed' : 'Stillborn' },
          { 'actual' : 'deceased', 'displayed' : 'Deceased' },
          { 'actual' : 'miscarriage', 'displayed' : 'Miscarriage' },
          { 'actual' : 'unborn', 'displayed' : 'Unborn' },
          { 'actual' : 'aborted', 'displayed' : 'Aborted' }
        ],
        'default' : 'alive',
        'function' : 'setLifeStatus'
      },
      {
        'name' : 'gestation_age',
        'label' : 'Gestation age',
        'type' : 'select',
        'tab': 'Personal',
        'range' : {'start': 0, 'end': 50, 'item' : ['week', 'weeks']},
        'nullValue' : true,
        'function' : 'setGestationAge'
      },
      {
        'label' : 'Heredity options',
        'name' : 'childlessSelect',
        'values' : [{'actual': 'none', displayed: 'None'},{'actual': 'childless', displayed: 'Childless'},{'actual': 'infertile', displayed: 'Infertile'}],
        'type' : 'select',
        'tab': 'Personal',
        'function' : 'setChildlessStatus'
      },
      {
        'name' : 'adopted',
        'label' : 'Adopted',
        'type' : 'checkbox',
        'tab': 'Personal',
        'function' : 'setAdopted'
      },
      {
        'name' : 'monozygotic',
        'label' : 'Monozygotic twin',
        'type' : 'checkbox',
        'tab': 'Personal',
        'function' : 'setMonozygotic'
      },
      {
        'name' : 'nocontact',
        'label' : 'Not in contact with proband',
        'type' : 'checkbox',
        'tab': 'Personal',
        'function' : 'setLostContact'
      },
      {
        'name' : 'placeholder',
        'label' : 'Placeholder node',
        'type' : 'checkbox',
        'tab': 'Personal',
        'function' : 'makePlaceholder'
      },
      {
        'name' : 'comments',
        'label' : 'Comments',
        'type' : 'textarea',
        'tab': 'Clinical',
        'rows' : 2,
        'function' : 'setComments'
      }
    ], ['Personal', 'Clinical']);
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
