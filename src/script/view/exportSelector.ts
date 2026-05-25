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
    typeListElement.appendChild(_addTypeOption(false,  'GA4GH FHIR', 'GA4GH'));
    typeListElement.appendChild(_addTypeOption(false,  'SVG', 'svg'));
    typeListElement.appendChild(_addTypeOption(false,  'PDF', 'pdf'));
    typeListElement.appendChild(_addTypeOption(false,  'DADA2', 'DADA2'));

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

    var configListElementPrivacy = document.createElement('table');
    configListElementPrivacy.id = 'privacyOptions';
    configListElementPrivacy.style.display = 'none';
    var privHeaderRow = document.createElement('tr');
    var privHeaderTd = document.createElement('td');
    var privHeaderLabel = document.createElement('label');
    privHeaderLabel.className = 'export-config-header';
    privHeaderLabel.textContent = 'Privacy export options:';
    privHeaderTd.appendChild(privHeaderLabel);
    privHeaderRow.appendChild(privHeaderTd);
    configListElementPrivacy.appendChild(privHeaderRow);
    configListElementPrivacy.appendChild(_addConfigOption(true,  'privacy-options', 'export-subconfig-label', 'All data', 'all'));
    configListElementPrivacy.appendChild(_addConfigOption(false, 'privacy-options', 'export-subconfig-label', 'Remove personal information (name and age)', 'nopersonal'));
    configListElementPrivacy.appendChild(_addConfigOption(false, 'privacy-options', 'export-subconfig-label', 'Remove personal information and free-form comments', 'minimal'));

    var _addSelectOption = function (name: any, cssClass: any, labelText: any, options: any) {
      var optionWrapper = document.createElement('tr');
      var td = document.createElement('td');
      var label = document.createElement('label');
      label.className = cssClass;
      label.appendChild(document.createTextNode(labelText));
      var select = document.createElement('select');
      select.name = name;
      for (let op of options) {
        var optEl = document.createElement('option');
        optEl.value = op.options.value;
        if (op.options.selected) {
          optEl.selected = true;
        }
        optEl.textContent = op.label;
        select.appendChild(optEl);
      }
      label.appendChild(select);
      td.appendChild(label);
      optionWrapper.appendChild(td);
      return optionWrapper;
    };

    var configListElementPDF = document.createElement('table');
    configListElementPDF.id = 'pdfOptions';
    configListElementPDF.style.display = 'none';
    var pdfHeaderRow = document.createElement('tr');
    var pdfHeaderTd = document.createElement('td');
    var pdfHeaderLabel = document.createElement('label');
    pdfHeaderLabel.className = 'export-config-header';
    pdfHeaderLabel.textContent = 'PDF export options:';
    pdfHeaderTd.appendChild(pdfHeaderLabel);
    pdfHeaderRow.appendChild(pdfHeaderTd);
    configListElementPDF.appendChild(pdfHeaderRow);
    configListElementPDF.appendChild(_addSelectOption('pdf-page-size', 'export-subconfig-label', 'Page Size ',
      [
        {label: 'A3', options: {value: 'A3'}},
        {label: 'A4', options: {value: 'A4', selected: true}},
        {label: 'A5', options: {value: 'A5'}},
        {label: 'Executive', options: {value: 'EXECUTIVE'}},
        {label: 'Legal', options: {value: 'LEGAL'}},
        {label: 'Letter', options: {value: 'LETTER'}},
        {label: 'Tabloid', options: {value: 'TABLOID'}}
      ]));
    configListElementPDF.appendChild(_addSelectOption('pdf-page-orientation', 'export-subconfig-label', 'Page Orientation ',
      [
        {label: 'Landscape', options: {value: 'landscape', selected: true}},
        {label: 'Portrait', options: {value: 'portrait'}}
      ]));
    configListElementPDF.appendChild(_addSelectOption('pdf-legend-pos', 'export-subconfig-label', 'Legend Position ',
      [
        {label: 'Top Left', options: {value: 'TopLeft'}},
        {label: 'Top Right', options: {value: 'TopRight', selected: true}},
        {label: 'Bottom Left', options: {value: 'BottomLeft'}},
        {label: 'Bottom Right', options: {value: 'BottomRight'}}
      ]));

    var promptConfig = document.createElement('div');
    promptConfig.className = 'import-section';
    promptConfig.textContent = 'Options:';
    var dataSection3 = document.createElement('div');
    dataSection3.className = 'import-block';
    dataSection3.appendChild(promptConfig);
    dataSection3.appendChild(configListElementPED);
    dataSection3.appendChild(configListElementPrivacy);
    dataSection3.appendChild(configListElementPDF);
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
    var privacyOptionsTable = document.getElementById('privacyOptions');
    var pdfOptionsTable = document.getElementById('pdfOptions');

    if (exportType == 'ped') {
      pedOptionsTable.style.display = '';
      privacyOptionsTable.style.display = 'none';
    } else if (exportType == 'DADA2') {
      pedOptionsTable.style.display = 'none';
      privacyOptionsTable.style.display = 'none';
    } else {
      pedOptionsTable.style.display = 'none';
      privacyOptionsTable.style.display = '';
    }
    if (exportType == 'pdf') {
      pdfOptionsTable.style.display = '';
    } else {
      pdfOptionsTable.style.display = 'none';
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

    if (exportType == 'ped') {
      var idGenerationSetting = (document.querySelector('input:checked[type=radio][name="ped-options"]') as any).value;
      var exportString = PedigreeExport.exportAsPED(editor.getGraph().DG, idGenerationSetting);
      var fileName = 'open-pedigree.ped';
      var mimeType = 'text/plain';
      saveAs(new Blob([exportString], {type: mimeType}), fileName);
    } else if (exportType == 'DADA2') {
      var exportString = PedigreeExport.exportAsDADA2(editor.getGraph().DG);
      var fileName = 'open-pedigree.dada2';
      var mimeType = 'text/plain';
      saveAs(new Blob([exportString], {type: mimeType}), fileName);
    } else {
      var privacySetting = (document.querySelector('input:checked[type=radio][name="privacy-options"]') as any).value;
      if (exportType == 'GA4GH') {
        var exportString = PedigreeExport.exportAsGA4GH(editor.getGraph().DG, privacySetting);
        var fileName = 'open-pedigree-GA4GH-fhir.json';
        var mimeType = 'application/fhir+json';
        saveAs(new Blob([exportString], {type: mimeType}), fileName);
      } else if (exportType == 'svg') {
        var exportString = PedigreeExport.exportAsSVG(editor.getGraph().DG, privacySetting);
        var fileName = 'open-pedigree.svg';
        var mimeType = 'image/svg+xml';
        saveAs(new Blob([exportString], {type: mimeType}), fileName);
      } else if (exportType == 'pdf') {
        var pageSize = (document.querySelector('select[name="pdf-page-size"]') as any).value;
        var layout = (document.querySelector('select[name="pdf-page-orientation"]') as any).value;
        var legendPos = (document.querySelector('select[name="pdf-legend-pos"]') as any).value;
        let pdf = PedigreeExport.exportAsPDF(editor.getGraph().DG, privacySetting, pageSize, layout, legendPos);
      }
    }
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
