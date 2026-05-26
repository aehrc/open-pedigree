import { saveAs } from 'file-saver';
import PedigreeExport from 'pedigree/model/export';
import { NativeModal } from 'pedigree/view/nativeModal';

/**
 * The UI Element for exporting pedigrees
 *
 * @class ExportSelector
 */

export default class ExportSelector {
    dialog: any;

    constructor() {
        var _this = this;

        var mainDiv = document.createElement('div');
        mainDiv.className = 'import-selector';

        var _addTypeOption = function (checked: any, labelText: any, value: any) {
            var optionWrapper = document.createElement('tr');
            var td = document.createElement('td');
            var label = document.createElement('label');
            label.className = 'import-type-label';
            var input = document.createElement('input');
            input.type = 'radio';
            input.value = value;
            input.name = 'export-type';
            input.addEventListener('click', _this.disableEnableOptions);
            if (checked) {
                input.checked = true;
            }
            label.appendChild(input);
            label.appendChild(document.createTextNode(labelText));
            td.appendChild(label);
            optionWrapper.appendChild(td);
            return optionWrapper;
        };
        var typeListElement = document.createElement('table');
        typeListElement.appendChild(_addTypeOption(true,  'PED', 'ped'));
        typeListElement.appendChild(_addTypeOption(false,  'FHIR', 'fhir'));

        var fileDownload = document.createElement('a');
        fileDownload.id = 'downloadLink';
        fileDownload.style.display = 'none';
        mainDiv.appendChild(fileDownload);

        var promptType = document.createElement('div');
        promptType.className = 'import-section';
        promptType.textContent = 'Data format:';
        var dataSection2 = document.createElement('div');
        dataSection2.className = 'import-block';
        dataSection2.appendChild(promptType);
        dataSection2.appendChild(typeListElement);
        mainDiv.appendChild(dataSection2);

        var _addConfigOption = function (checked: any, name: any, cssClass: any, labelText: any, value: any) {
            var optionWrapper = document.createElement('tr');
            var td = document.createElement('td');
            var label = document.createElement('label');
            label.className = cssClass;
            var input = document.createElement('input');
            input.type = 'radio';
            input.value = value;
            input.name = name;
            if (checked) {
                input.checked = true;
            }
            label.appendChild(input);
            label.appendChild(document.createTextNode(labelText));
            td.appendChild(label);
            optionWrapper.appendChild(td);
            return optionWrapper;
        };
        var configListElementPED = document.createElement('table');
        configListElementPED.id = 'pedOptions';
        var pedHeaderRow = document.createElement('tr');
        var pedHeaderTd = document.createElement('td');
        var pedHeaderLabel = document.createElement('label');
        pedHeaderLabel.className = 'export-config-header';
        pedHeaderLabel.textContent = 'Which of the following fields should be used to generate person IDs?';
        pedHeaderTd.appendChild(pedHeaderLabel);
        pedHeaderRow.appendChild(pedHeaderTd);
        configListElementPED.appendChild(pedHeaderRow);
        configListElementPED.appendChild(_addConfigOption(true,  'ped-options', 'export-subconfig-label', 'External ID', 'external'));
        configListElementPED.appendChild(_addConfigOption(false, 'ped-options', 'export-subconfig-label', 'Name', 'name'));
        configListElementPED.appendChild(_addConfigOption(false, 'ped-options', 'export-subconfig-label', 'None, generate new numeric ID for everyone', 'newid'));

        var promptConfig = document.createElement('div');
        promptConfig.className = 'import-section';
        promptConfig.textContent = 'Options:';
        var dataSection3 = document.createElement('div');
        dataSection3.className = 'import-block';
        dataSection3.appendChild(promptConfig);
        dataSection3.appendChild(configListElementPED);
        mainDiv.appendChild(dataSection3);

        var buttons = document.createElement('div');
        buttons.className = 'buttons import-block-bottom';

        var exportBtnWrapper = document.createElement('span');
        exportBtnWrapper.className = 'buttonwrapper';
        var exportBtnEl = document.createElement('input');
        exportBtnEl.type = 'button';
        exportBtnEl.name = 'export';
        exportBtnEl.value = 'Export';
        exportBtnEl.className = 'button';
        exportBtnEl.id = 'export_button';
        exportBtnWrapper.appendChild(exportBtnEl);
        buttons.appendChild(exportBtnWrapper);

        var cancelBtnWrapper = document.createElement('span');
        cancelBtnWrapper.className = 'buttonwrapper';
        var cancelBtnEl = document.createElement('input');
        cancelBtnEl.type = 'button';
        cancelBtnEl.name = 'cancel';
        cancelBtnEl.value = 'Cancel';
        cancelBtnEl.className = 'button secondary';
        cancelBtnWrapper.appendChild(cancelBtnEl);
        buttons.appendChild(cancelBtnWrapper);

        mainDiv.appendChild(buttons);

        cancelBtnEl.addEventListener('click', function(event: any) {
            _this.hide();
        });
        exportBtnEl.addEventListener('click', function(event: any) {
            _this._onExportStarted();
        });

        var closeShortcut = ['Esc'];
        this.dialog = new NativeModal(mainDiv, {close: {method : this.hide.bind(this), keys : closeShortcut}}, {extraClassName: 'pedigree-import-chooser', title: 'Pedigree export', displayCloseButton: true});
    }

    /*
     * Disables unapplicable options on input type selection
     */
    disableEnableOptions(): any {
        var exportType = (document.querySelector('input:checked[type=radio][name="export-type"]') as any).value;
        var pedOptionsTable = document.getElementById('pedOptions');

        if (exportType == 'ped') {
            pedOptionsTable.style.display = '';
        } else {
            pedOptionsTable.style.display = 'none';
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

        var exportType = (document.querySelector('input:checked[type=radio][name="export-type"]') as any).value;

        var exportString: any;
        var fileName: any;
        var mimeType: any;

        if (exportType == 'ped') {
            var idGenerationSetting = (document.querySelector('input:checked[type=radio][name="ped-options"]') as any).value;
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
