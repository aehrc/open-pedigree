import { NativeModal } from 'pedigree/view/nativeModal';

/**
 * The UI Element for importing pedigrees from text representationin various formats
 *
 * @class ImportSelector
 */

export default class ImportSelector {
  importValue: any;
  dialog: any;

  constructor() {
    if (editor.isReadOnlyMode()) {
      return;
    }

    var _this = this;

    var mainDiv = document.createElement('div');
    mainDiv.className = 'import-selector';

    var promptImport = document.createElement('div');
    promptImport.className = 'import-section';
    promptImport.textContent = 'Import data:';
    this.importValue = document.createElement('textarea');
    this.importValue.id = 'import';
    this.importValue.className = 'import-textarea';
    mainDiv.appendChild(promptImport);
    mainDiv.appendChild(this.importValue);

    if (!!(window as any).FileReader && !!(window as any).FileList) {
      // only show the upload link if browser supports FileReader/DOM File API
      // Of the browsers suported by pedigree editor, IE9 and Safari 4 & 5 do not support file API
      var uploadFileSelector = document.createElement('input');
      uploadFileSelector.type = 'file';
      uploadFileSelector.id = 'pedigreeInputFile';
      uploadFileSelector.style.display = 'none';
      uploadFileSelector.addEventListener('change', function(this: any, event: any) {
        _this.handleFileUpload(this.files);
        try {
          this.value = '';  // clear file selector
        } catch (err) {
          // some older browsers do not allow setting value of a file input element and may generate a security error
        }
      });
      var uploadLink = document.createElement('div');
      uploadLink.className = 'import-upload';
      uploadLink.innerHTML = '(<a>Select a local file to be imported</a>)';
      uploadLink.addEventListener('click', function(event: any) {
        var fileElem = document.getElementById('pedigreeInputFile');
        fileElem.click();
      });
      mainDiv.appendChild(uploadFileSelector);
      mainDiv.appendChild(uploadLink);
    }

    var _addTypeOption = function (checked: any, labelText: any, value: any) {
      var optionWrapper = document.createElement('tr');
      var td = document.createElement('td');
      var label = document.createElement('label');
      label.className = 'import-type-label';
      var input = document.createElement('input');
      input.type = 'radio';
      input.value = value;
      input.name = 'select-type';
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
    //TODO: typeListElement.appendChild(_addTypeOption(true, "Autodetect", "auto"));
    typeListElement.appendChild(_addTypeOption(true,  'PED or LINKAGE (pre- or post- makeped)', 'ped'));
    typeListElement.appendChild(_addTypeOption(false, 'GEDCOM', 'gedcom'));
    typeListElement.appendChild(_addTypeOption(false, 'BOADICEA', 'BOADICEA'));
    typeListElement.appendChild(_addTypeOption(false, 'GA4GH FHIR(JSON)', 'GA4GH'));
    typeListElement.appendChild(_addTypeOption(false, 'DADA2', 'DADA2'));

    var promptType = document.createElement('div');
    promptType.className = 'import-section';
    promptType.textContent = 'Data format:';
    var dataSection2 = document.createElement('div');
    dataSection2.className = 'import-block';
    dataSection2.appendChild(promptType);
    dataSection2.appendChild(typeListElement);
    mainDiv.appendChild(dataSection2);

    var _addConfigOption = function (checked: any, labelText: any, value: any) {
      var optionWrapper = document.createElement('tr');
      var td = document.createElement('td');
      var label = document.createElement('label');
      label.className = 'import-config-label';
      var input = document.createElement('input');
      input.type = 'radio';
      input.value = value;
      input.name = 'select-options';
      if (checked) {
        input.checked = true;
      }
      label.appendChild(input);
      label.appendChild(document.createTextNode(labelText));
      td.appendChild(label);
      optionWrapper.appendChild(td);
      return optionWrapper;
    };
    var configListElement = document.createElement('table');
    configListElement.id = 'import-type';
    configListElement.appendChild(_addConfigOption(true,  'Treat non-standard phenotype values as new disorders', 'accept'));
    configListElement.appendChild(_addConfigOption(false, 'Treat non-standard phenotype values as "no information"', 'dontaccept'));

    var markEvaluated = document.createElement('input');
    markEvaluated.type = 'checkbox';
    markEvaluated.value = '1';
    markEvaluated.name = 'mark-evaluated';
    var markLabel1Row = document.createElement('tr');
    var markLabel1Td = document.createElement('td');
    var markLabel1 = document.createElement('label');
    markLabel1.className = 'import-mark-label1';
    markLabel1.appendChild(markEvaluated);
    markLabel1.appendChild(document.createTextNode("Mark all patients with known disorder status with 'documented evaluation' mark"));
    markLabel1Td.appendChild(markLabel1);
    markLabel1Row.appendChild(markLabel1Td);
    configListElement.appendChild(markLabel1Row);

    var markExternal = document.createElement('input');
    markExternal.type = 'checkbox';
    markExternal.value = '1';
    markExternal.name = 'mark-external';
    markExternal.checked = true;
    var markLabel2Row = document.createElement('tr');
    var markLabel2Td = document.createElement('td');
    var markLabel2 = document.createElement('label');
    markLabel2.className = 'import-mark-label2';
    markLabel2.appendChild(markExternal);
    markLabel2.appendChild(document.createTextNode("Save individual IDs as given in the input data as 'external ID'"));
    markLabel2Td.appendChild(markLabel2);
    markLabel2Row.appendChild(markLabel2Td);
    configListElement.appendChild(markLabel2Row);

    var promptConfig = document.createElement('div');
    promptConfig.className = 'import-section';
    promptConfig.textContent = 'Options:';
    var dataSection3 = document.createElement('div');
    dataSection3.className = 'import-block';
    dataSection3.appendChild(promptConfig);
    dataSection3.appendChild(configListElement);
    mainDiv.appendChild(dataSection3);

    //TODO: [x] auto-combine multiple unaffected children when the number of children is greater than [5]

    var buttons = document.createElement('div');
    buttons.className = 'buttons import-block-bottom';

    var importBtnWrapper = document.createElement('span');
    importBtnWrapper.className = 'buttonwrapper';
    var importBtnEl = document.createElement('input');
    importBtnEl.type = 'button';
    importBtnEl.name = 'import';
    importBtnEl.value = 'Import';
    importBtnEl.className = 'button';
    importBtnEl.id = 'import_button';
    importBtnWrapper.appendChild(importBtnEl);
    buttons.appendChild(importBtnWrapper);

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
    importBtnEl.addEventListener('click', function(event: any) {
      _this._onImportStarted();
    });

    var closeShortcut = ['Esc'];
    this.dialog = new NativeModal(mainDiv, {close: {method : this.hide.bind(this), keys : closeShortcut}}, {extraClassName: 'pedigree-import-chooser', title: 'Pedigree import', displayCloseButton: true});
  }

  /*
     * Populates the text input box with the selected file content (asynchronously)
     */
  handleFileUpload(files: any): any {
    for (var i = 0, numFiles = files.length; i < numFiles; i++) {
      var nextFile = files[i];
      console.log('loading file: ' + nextFile.name + ', size: ' + nextFile.size);

      var _this = this;
      var fr = new FileReader();
      fr.onload = function(e: any) {
        _this.importValue.value = e.target.result;  // e.target.result should contain the text
      };
      fr.readAsText(nextFile);
    }
  }

  /*
     * Disables unapplicable options on input type selection
     */
  disableEnableOptions(): any {
    var importType = (document.querySelector('input:checked[type=radio][name="select-type"]') as any).value;
    var pedOnlyOptions = Array.from(document.querySelectorAll('input[type=radio][name="select-options"]'));
    for (var i = 0; i < pedOnlyOptions.length; i++) {
      (pedOnlyOptions[i] as any).disabled = importType != 'ped';
    }
    var pedAndGedcomOption = document.querySelector('input[type=checkbox][name="mark-evaluated"]') as any;
    if (importType != 'ped' && importType != 'gedcom') {
      pedAndGedcomOption.disabled = true;
    } else {
      pedAndGedcomOption.disabled = false;
    }

    var saveExternalID = document.querySelector('input[type=checkbox][name="mark-external"]') as any;
    if (importType != 'DADA2'){
      saveExternalID.disabled = false;
    } else {
      saveExternalID.disabled = true;
    }
  }

  /**
     * Loads the template once it has been selected
     *
     * @param event
     * @param pictureBox
     * @private
     */
  _onImportStarted(): any {
    var importValue = this.importValue.value;
    console.log('Importing:\n' + importValue);

    this.hide();

    if (!importValue || importValue == '') {
      alert('Nothing to import!');
      return;
    }

    var importType = (document.querySelector('input:checked[type=radio][name="select-type"]') as any).value;
    console.log('Import type: ' + importType);

    var importMark = (document.querySelector('input[type=checkbox][name="mark-evaluated"]') as any).checked;

    var externalIdMark = (document.querySelector('input[type=checkbox][name="mark-external"]') as any).checked;

    var optionSelected = (document.querySelector('input:checked[type=radio][name="select-options"]') as any).value;
    var acceptUnknownPhenotypes = (optionSelected == 'accept');

    var importOptions = { 'markEvaluated': importMark, 'externalIdMark': externalIdMark, 'acceptUnknownPhenotypes': acceptUnknownPhenotypes };

    editor.getSaveLoadEngine().createGraphFromImportData(importValue, importType, importOptions,
      false /* add to undo stack */, true /*center around 0*/);
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
    this.importValue.value = '';
    this.dialog.closeDialog();
  }
}
