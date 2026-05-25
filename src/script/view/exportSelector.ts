import { saveAs } from 'file-saver';
import PedigreeExport from 'pedigree/model/export';

/**
 * The UI Element for exporting pedigrees
 *
 * @class ExportSelector
 */

export default class ExportSelector {
    dialog: any;

    constructor() {
        var _this = this;

        var mainDiv = new (Element as any)('div', {'class': 'import-selector'});

        var _addTypeOption = function (checked: any, labelText: any, value: any) {
            var optionWrapper = new (Element as any)('tr');
            var input = new (Element as any)('input', {'type' : 'radio', 'value': value, 'name': 'export-type'});
            input.observe('click', _this.disableEnableOptions );
            if (checked) {
                (input as any).checked = true;
            }
            var label = new (Element as any)('label', {'class': 'import-type-label'}).insert(input).insert(labelText);
            optionWrapper.insert(label.wrap('td'));
            return optionWrapper;
        };
        var typeListElement = new (Element as any)('table');
        typeListElement.insert(_addTypeOption(true,  'PED', 'ped'));
        typeListElement.insert(_addTypeOption(false,  'FHIR', 'fhir'));

        var fileDownload = new (Element as any)('a', {'id': 'downloadLink', 'style': 'display:none'});
        mainDiv.insert(fileDownload);

        var promptType = new (Element as any)('div', {'class': 'import-section'}).update('Data format:');
        var dataSection2 = new (Element as any)('div', {'class': 'import-block'});
        dataSection2.insert(promptType).insert(typeListElement);
        mainDiv.insert(dataSection2);

        var _addConfigOption = function (checked: any, name: any, cssClass: any, labelText: any, value: any) {
            var optionWrapper = new (Element as any)('tr');
            var input = new (Element as any)('input', {'type' : 'radio', 'value': value, 'name': name });
            if (checked) {
                (input as any).checked = true;
            }
            var label = new (Element as any)('label', {'class': cssClass}).insert(input).insert(labelText);
            optionWrapper.insert(label.wrap('td'));
            return optionWrapper;
        };
        var configListElementPED = new (Element as any)('table', {'id': 'pedOptions'});
        var label = new (Element as any)('label', {'class': 'export-config-header'}).insert('Which of the following fields should be used to generate person IDs?');
        configListElementPED.insert(label.wrap('td').wrap('tr'));
        configListElementPED.insert(_addConfigOption(true,  'ped-options', 'export-subconfig-label', 'External ID', 'external'));
        configListElementPED.insert(_addConfigOption(false, 'ped-options', 'export-subconfig-label', 'Name', 'name'));
        configListElementPED.insert(_addConfigOption(false, 'ped-options', 'export-subconfig-label', 'None, generate new numeric ID for everyone', 'newid'));

        var promptConfig = new (Element as any)('div', {'class': 'import-section'}).update('Options:');
        var dataSection3 = new (Element as any)('div', {'class': 'import-block'});
        dataSection3.insert(promptConfig).insert(configListElementPED);
        mainDiv.insert(dataSection3);

        var buttons = new (Element as any)('div', {'class' : 'buttons import-block-bottom'});
        buttons.insert(new (Element as any)('input', {type: 'button', name : 'export', 'value': 'Export', 'class' : 'button', 'id': 'export_button'}).wrap('span', {'class' : 'buttonwrapper'}));
        buttons.insert(new (Element as any)('input', {type: 'button', name : 'cancel', 'value': 'Cancel', 'class' : 'button secondary'}).wrap('span', {'class' : 'buttonwrapper'}));
        mainDiv.insert(buttons);

        var cancelButton = buttons.down('input[name="cancel"]');
        cancelButton.observe('click', function(event: any) {
            _this.hide();
        });
        var exportButton = buttons.down('input[name="export"]');
        exportButton.observe('click', function(event: any) {
            _this._onExportStarted();
        });

        var closeShortcut = ['Esc'];
        this.dialog = new PhenoTips.widgets.ModalPopup(mainDiv, {close: {method : this.hide.bind(this), keys : closeShortcut}}, {extraClassName: 'pedigree-import-chooser', title: 'Pedigree export', displayCloseButton: true});
    }

    /*
     * Disables unapplicable options on input type selection
     */
    disableEnableOptions(): any {
        var exportType = ($$('input:checked[type=radio][name="export-type"]')[0] as any).value;

        var pedOptionsTable = $('pedOptions');

        if (exportType == 'ped') {
            pedOptionsTable.show();
        } else {
            pedOptionsTable.hide();
        }
    }

    /**
     * Loads the template once it has been selected
     *
     * @param event
     * @param pictureBox
     * @private
     */
    _onExportStarted(): any {
        this.hide();

        var exportType = ($$('input:checked[type=radio][name="export-type"]')[0] as any).value;

        var exportString: any;
        var fileName: any;
        var mimeType: any;

        if (exportType == 'ped') {
            var idGenerationSetting = ($$('input:checked[type=radio][name="ped-options"]')[0] as any).value;
            exportString = PedigreeExport.exportAsPED(editor.getGraph().DG, idGenerationSetting);
            fileName = 'open-pedigree.ped';
            mimeType = 'text/plain';
        }
        else if (exportType == 'fhir') {
            exportString = PedigreeExport.exportAsFHIR(editor.getGraph().DG);
            fileName = 'open-pedigree-fhir.json';
            mimeType = 'application/fhir+json';
        }

        saveAs(new Blob([exportString], {type: mimeType}), fileName);
    }

    /**
     * Displays the template selector
     *
     * @method show
     */
    show(): any {
        this.dialog.show();
    }

    /**
     * Removes the the template selector
     *
     * @method hide
     */
    hide(): any {
        this.dialog.closeDialog();
    }
}
