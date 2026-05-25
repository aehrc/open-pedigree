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
    typeListElement.insert(_addTypeOption(false,  'GA4GH FHIR', 'GA4GH'));
    typeListElement.insert(_addTypeOption(false,  'SVG', 'svg'));
    typeListElement.insert(_addTypeOption(false,  'PDF', 'pdf'));
    typeListElement.insert(_addTypeOption(false,  'DADA2', 'DADA2'));

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

    var configListElementPrivacy = new (Element as any)('table', {'id': 'privacyOptions', 'style': 'display:none'});
    var privLabel = new (Element as any)('label', {'class': 'export-config-header'}).insert('Privacy export options:');
    configListElementPrivacy.insert(privLabel.wrap('td').wrap('tr'));
    configListElementPrivacy.insert(_addConfigOption(true,  'privacy-options', 'export-subconfig-label', 'All data', 'all'));
    configListElementPrivacy.insert(_addConfigOption(false, 'privacy-options', 'export-subconfig-label', 'Remove personal information (name and age)', 'nopersonal'));
    configListElementPrivacy.insert(_addConfigOption(false, 'privacy-options', 'export-subconfig-label', 'Remove personal information and free-form comments', 'minimal'));

    var _addSelectOption = function (name: any, cssClass: any, labelText: any, options: any) {
      var optionWrapper = new (Element as any)('tr');
      var input = new (Element as any)('select', {'name': name });
      for (let op of options){
        input.insert(new (Element as any)('option', op.options).insert(op.label));
      }
      var label = new (Element as any)('label', {'class': cssClass}).insert(labelText).insert(input);
      optionWrapper.insert(label.wrap('td'));
      return optionWrapper;
    };

    var configListElementPDF = new (Element as any)('table', {'id': 'pdfOptions', 'style': 'display:none'});
    var pdfLabel = new (Element as any)('label', {'class': 'export-config-header'}).insert('PDF export options:');
    configListElementPDF.insert(pdfLabel.wrap('td').wrap('tr'));
    configListElementPDF.insert(_addSelectOption('pdf-page-size', 'export-subconfig-label', 'Page Size ',
      [
        {label: 'A3', options: {value: 'A3'}},
        {label: 'A4', options: {value: 'A4', selected: true}},
        {label: 'A5', options: {value: 'A5'}},
        {label: 'Executive', options: {value: 'EXECUTIVE'}},
        {label: 'Legal', options: {value: 'LEGAL'}},
        {label: 'Letter', options: {value: 'LETTER'}},
        {label: 'Tabloid', options: {value: 'TABLOID'}}
      ]));
    configListElementPDF.insert(_addSelectOption('pdf-page-orientation', 'export-subconfig-label', 'Page Orientation ',
      [
        {label: 'Landscape', options: {value: 'landscape', selected: true}},
        {label: 'Portrait', options: {value: 'portrait'}}
      ]));
    configListElementPDF.insert(_addSelectOption('pdf-legend-pos', 'export-subconfig-label', 'Legend Position ',
      [
        {label: 'Top Left', options: {value: 'TopLeft'}},
        {label: 'Top Right', options: {value: 'TopRight', selected: true}},
        {label: 'Bottom Left', options: {value: 'BottomLeft'}},
        {label: 'Bottom Right', options: {value: 'BottomRight'}}
      ]));

    var promptConfig = new (Element as any)('div', {'class': 'import-section'}).update('Options:');
    var dataSection3 = new (Element as any)('div', {'class': 'import-block'});
    dataSection3.insert(promptConfig).insert(configListElementPED).insert(configListElementPrivacy).insert(configListElementPDF);
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
    this.dialog = new (window as any).PhenoTips.widgets.ModalPopup(mainDiv, {close: {method : this.hide.bind(this), keys : closeShortcut}}, {extraClassName: 'pedigree-import-chooser', title: 'Pedigree export', displayCloseButton: true});
  }

  /*
     * Disables unapplicable options on input type selection
     */
  disableEnableOptions(): any {
    var exportType = ($$('input:checked[type=radio][name="export-type"]') as any)[0].value;

    var pedOptionsTable = $('pedOptions');
    var privacyOptionsTable = $('privacyOptions');
    var pdfOptionsTable = $('pdfOptions');

    if (exportType == 'ped') {
      pedOptionsTable.show();
      privacyOptionsTable.hide();
    } else if (exportType == 'DADA2') {
      pedOptionsTable.hide();
      privacyOptionsTable.hide();
    } else {
      pedOptionsTable.hide();
      privacyOptionsTable.show();
    }
    if (exportType == 'pdf') {
      pdfOptionsTable.show();
    } else {
      pdfOptionsTable.hide();
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

    var exportType = ($$('input:checked[type=radio][name="export-type"]') as any)[0].value;

    if (exportType == 'ped') {
      var idGenerationSetting = ($$('input:checked[type=radio][name="ped-options"]') as any)[0].value;
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
      var privacySetting = ($$('input:checked[type=radio][name="privacy-options"]') as any)[0].value;
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
        var pageSize = ($$('select[name="pdf-page-size"]') as any)[0].value;
        var layout = ($$('select[name="pdf-page-orientation"]') as any)[0].value;
        var legendPos = ($$('select[name="pdf-legend-pos"]') as any)[0].value;
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
