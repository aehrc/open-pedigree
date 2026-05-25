import Controller from 'pedigree/controller';
import SaveLoadEngine from 'pedigree/saveLoadEngine';
import View from 'pedigree/view';
import DynamicPositionedGraph from 'pedigree/model/dynamicGraph';
// helpers is a named-export module; unused default import removed
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

import '../style/editor.css';
import TerminologyManager from 'pedigree/terminology/terminologyManger';
import {DisorderTermType} from 'pedigree/terminology/disorderTerm';
import FHIRTerminology from 'pedigree/terminology/FHIRTerminology';
import {PhenotypeTermType} from 'pedigree/terminology/phenotypeTerm';
import {GeneTermType} from 'pedigree/terminology/geneTerm';

/**
 * The main class of the Pedigree Editor, responsible for initializing all the basic elements of the app.
 * Contains wrapper methods for the most commonly used functions.
 * This class should be initialized only once.
 *
 * @class PedigreeEditor
 * @constructor
 */

export default class PedigreeEditor {
    _patientDataUrl: any;
    DEBUG_MODE: any;
    _graphModel: any;
    _workspace: any;
    _nodeMenu: any;
    _nodeGroupMenu: any;
    _partnershipMenu: any;
    _nodetypeSelectionBubble: any;
    _siblingSelectionBubble: any;
    _disorderLegend: any;
    _geneLegend: any;
    _hpoLegend: any;
    _view: any;
    _actionStack: any;
    _templateSelector: any;
    _importSelector: any;
    _exportSelector: any;
    _versionUpdater: any;
    _saveLoadEngine: any;
    _controller: any;

    _omimServiceUrl: any;
    _hpoServiceUrl: any;

    constructor(options: any) {
        options = options || {};

        // URL to load patient data from and save data to
        this._patientDataUrl = options.patientDataUrl || '';
        var patientDataUrl = this._patientDataUrl;
        // URL to redirect the browser to on cancel/close
        var returnUrl = options.returnUrl || 'https://github.com/phenotips/open-pedigree';
        this.DEBUG_MODE = Boolean(options.DEBUG_MODE);
        this._omimServiceUrl = options.omimServiceUrl || '';
        this._hpoServiceUrl  = options.hpoServiceUrl  || '';

        if (!TerminologyManager.hasType(DisorderTermType)){
            // initialise default disorder terminology
            TerminologyManager.addTerminology(DisorderTermType, new FHIRTerminology(
                DisorderTermType, 'http://www.omim.org', /[0-9]+/, 20, 'https://tx.ontoserver.csiro.au/fhir/', 'http://www.omim.org/vs'));
        }
        if (!TerminologyManager.hasType(PhenotypeTermType)){
            // initialise default phenotype terminology
            TerminologyManager.addTerminology(PhenotypeTermType, new FHIRTerminology(
                PhenotypeTermType, 'http://purl.obolibrary.org/obo/hp.owl', /^(http:\/\/)|(HP:)/, 20, 'https://tx.ontoserver.csiro.au/fhir/', 'http://purl.obolibrary.org/obo/hp.owl?vs'));
        }
        if (!TerminologyManager.hasType(GeneTermType)){
            // initialise default gene terminology
            TerminologyManager.addTerminology(GeneTermType, new FHIRTerminology(
                GeneTermType, 'http://purl.bioontology.org/ontology/HGNC/hgnc.owl', /[0-9]+/, 20, 'https://tx.ontoserver.csiro.au/fhir/', 'http://www.genenames.org'));
        }

        (window as any).editor = this;

        // initialize main data structure which holds the graph structure
        this._graphModel = DynamicPositionedGraph.makeEmpty(PedigreeEditorParameters.attributes.layoutRelativePersonWidth, PedigreeEditorParameters.attributes.layoutRelativeOtherWidth);

        //initialize the elements of the app
        this._workspace = new Workspace();
        this._nodeMenu = this.generateNodeMenu();
        this._nodeGroupMenu = this.generateNodeGroupMenu();
        this._partnershipMenu = this.generatePartnershipMenu();
        this._nodetypeSelectionBubble = new NodetypeSelectionBubble(false);
        this._siblingSelectionBubble  = new NodetypeSelectionBubble(true);
        this._disorderLegend = new DisorderLegend();
        this._geneLegend = new GeneLegend();
        this._hpoLegend = new PhenotypeLegend();

        this._view = new View();

        this._actionStack = new ActionStack();
        this._templateSelector = new TemplateSelector(false);
        this._importSelector = new ImportSelector();
        this._exportSelector = new ExportSelector();
        this._versionUpdater = new VersionUpdater();
        this._saveLoadEngine = new SaveLoadEngine();

        // load proband data and load the graph after proband data is available
        this._saveLoadEngine.load(this._patientDataUrl, this._saveLoadEngine);

        this._controller = new Controller();

        //attach actions to buttons on the top bar
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
            if (returnUrl === '#CloseWindow'){
                console.log('Attempt to close the window');
                window.close();
            }
            else if (returnUrl) {
                (window as any).location = returnUrl;
            }
        });

        var unsupportedBrowserButton = document.getElementById('action-readonlymessage');
        unsupportedBrowserButton && unsupportedBrowserButton.addEventListener('click', function(event: any) {
            alert('Your browser does not support all the features required for ' +
                        'Pedigree Editor, so pedigree is displayed in read-only mode (and may have quirks).\n\n' +
                        'Supported browsers include Firefox v3.5+, Internet Explorer v9+, ' +
                        'Chrome, Safari v4+, Opera v10.5+ and most mobile browsers.');
        });
    }

    reloadPatient(): any {
        this._saveLoadEngine.load(this._patientDataUrl, this._saveLoadEngine);
    }

    getOmimServiceUrl(): any {
        return this._omimServiceUrl;
    }

    getHpoServiceUrl(): any {
        return this._hpoServiceUrl;
    }

    /**
     * Returns the graph node with the corresponding nodeID
     * @method getNode
     * @param {Number} nodeID The id of the desired node
     * @return {AbstractNode} the node whose id is nodeID
     */
    getNode(nodeID: any): any {
        return this.getView().getNode(nodeID);
    }

    /**
     * @method getView
     * @return {View} (responsible for managing graphical representations of nodes and interactive elements)
     */
    getView(): any {
        return this._view;
    }

    /**
     * @method getVersionUpdater
     * @return {VersionUpdater}
     */
    getVersionUpdater(): any {
        return this._versionUpdater;
    }

    /**
     * @method getGraph
     * @return {DynamicPositionedGraph} (data model: responsible for managing nodes and their positions)
     */
    getGraph(): any {
        return this._graphModel;
    }

    /**
     * @method getController
     * @return {Controller} (responsible for managing user input and corresponding data changes)
     */
    getController(): any {
        return this._controller;
    }

    /**
     * @method getActionStack
     * @return {ActionStack} (responsible for undoing and redoing actions)
     */
    getActionStack(): any {
        return this._actionStack;
    }

    /**
     * @method getNodetypeSelectionBubble
     * @return {NodetypeSelectionBubble} (floating window with initialization options for new nodes)
     */
    getNodetypeSelectionBubble(): any {
        return this._nodetypeSelectionBubble;
    }

    /**
     * @method getSiblingSelectionBubble
     * @return {NodetypeSelectionBubble} (floating window with initialization options for new sibling nodes)
     */
    getSiblingSelectionBubble(): any {
        return this._siblingSelectionBubble;
    }

    /**
     * @method getWorkspace
     * @return {Workspace}
     */
    getWorkspace(): any {
        return this._workspace;
    }

    /**
     * @method getDisorderLegend
     * @return {Legend} Responsible for managing and displaying the disorder legend
     */
    getDisorderLegend(): any {
        return this._disorderLegend;
    }

    /**
     * @method getHPOLegend
     * @return {Legend} Responsible for managing and displaying the phenotype/HPO legend
     */
    getHPOLegend(): any {
        return this._hpoLegend;
    }

    /**
     * @method getGeneLegend
     * @return {Legend} Responsible for managing and displaying the candidate genes legend
     */
    getGeneLegend(): any {
        return this._geneLegend;
    }

    getLegend(type: any): any {
        if (type == DisorderTermType){
            return this._disorderLegend;
        }
        else if (type == PhenotypeTermType){
            return this._hpoLegend;
        }
        else if (type == GeneTermType){
            return this._geneLegend;
        }
        return undefined;
    }

    /**
     * @method getPaper
     * @return {Workspace.paper} Raphael paper element
     */
    getPaper(): any {
        return this.getWorkspace().getPaper();
    }

    /**
     * @method isReadOnlyMode
     * @return {Boolean} True iff pedigree drawn should be read only with no handles
     *                   (read-only mode is used for IE8 as well as for template display and
     *                   print and export versions).
     */
    isReadOnlyMode(): any {
        if (this.isUnsupportedBrowser()) {
            return true;
        }
        return false;
    }

    isUnsupportedBrowser(): any {
        // http://voormedia.com/blog/2012/10/displaying-and-detecting-support-for-svg-images
        if (!document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1')) {
            // implies unpredictable behavior when using handles & interactive elements,
            // and most likely extremely slow on any CPU
            return true;
        }
        // http://kangax.github.io/es5-compat-table/
        if (!window.JSON) {
            alert('Your browser is not supported and is unable to load and display any pedigrees.\n\n' +
                        'Suported browsers include Internet Explorer version 9 and higher, Safari version 4 and higher, '+
                        'Firefox version 3.6 and higher, Opera version 10.5 and higher, any version of Chrome and most '+
                        'other modern browsers (including mobile). IE8 is able to display pedigrees in read-only mode.');
            window.stop && window.stop();
            return true;
        }
        return false;
    }

    /**
     * @method getSaveLoadEngine
     * @return {SaveLoadEngine} Engine responsible for saving and loading operations
     */
    getSaveLoadEngine(): any {
        return this._saveLoadEngine;
    }

    /**
     * @method getTemplateSelector
     * @return {TemplateSelector}
     */
    getTemplateSelector(): any {
        return this._templateSelector;
    }

    /**
     * @method getImportSelector
     * @return {ImportSelector}
     */
    getImportSelector(): any {
        return this._importSelector;
    }

    /**
     * @method getExportSelector
     * @return {ExportSelector}
     */
    getExportSelector(): any {
        return this._exportSelector;
    }

    /**
     * Returns true if any of the node menus are visible
     * (since some UI interactions should be disabled while menu is active - e.g. mouse wheel zoom)
     *
     * @method isAnyMenuVisible
     */
    isAnyMenuVisible(): any {
        if (this.getNodeMenu().isVisible() || this.getNodeGroupMenu().isVisible() || this.getPartnershipMenu().isVisible()) {
            return;
        }
    }

    /**
     * Creates the context menu for Person nodes
     *
     * @method generateNodeMenu
     * @return {NodeMenu}
     */
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
                'function' : 'setPhenotypes'
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
        ], ['Personal', 'Clinical'], null);
    }

    /**
     * @method getNodeMenu
     * @return {NodeMenu} Context menu for nodes
     */
    getNodeMenu(): any {
        return this._nodeMenu;
    }

    /**
     * Creates the context menu for PersonGroup nodes
     *
     * @method generateNodeGroupMenu
     * @return {NodeMenu}
     */
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
        ], [], null);
    }

    /**
     * @method getNodeGroupMenu
     * @return {NodeMenu} Context menu for nodes
     */
    getNodeGroupMenu(): any {
        return this._nodeGroupMenu;
    }

    /**
     * Creates the context menu for Partnership nodes
     *
     * @method generatePartnershipMenu
     * @return {NodeMenu}
     */
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

    /**
     * @method getPartnershipMenu
     * @return {NodeMenu} The context menu for Partnership nodes
     */
    getPartnershipMenu(): any {
        return this._partnershipMenu;
    }

    /**
     * @method convertGraphCoordToCanvasCoord
     * @return [x,y] coordinates on the canvas
     */
    convertGraphCoordToCanvasCoord(x: any, y: any): any {
        var scale = PedigreeEditorParameters.attributes.layoutScale;
        return { x: x * scale.xscale,
            y: y * scale.yscale };
    }
}
