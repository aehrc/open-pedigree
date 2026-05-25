import TemplateSelector from 'pedigree/view/templateSelector';

function unescapeRestData(data: any): any {
  var tempNode = document.createElement('div');
  tempNode.innerHTML = data.replace(/&amp;/, '&');
  return (tempNode as any).innerText || (tempNode as any).text || tempNode.textContent;
}

function getSelectorFromXML(responseXML: any, selectorName: any, attributeName: any, attributeValue: any): any {
  if (responseXML.querySelector) {
    return responseXML.querySelector(selectorName + '[' + attributeName + '=\'' + attributeValue + '\']');
  } else {
    var query = '//' + selectorName + '[@' + attributeName + '=\'' + attributeValue + '\']';
    try {
      return responseXML.selectSingleNode(query);
    } catch (e) {
      alert('your browser is unsupported');
      (window as any).stop && (window as any).stop();
      throw 'Unsupported browser';
    }
  }
}

function getSubSelectorTextFromXML(responseXML: any, selectorName: any, attributeName: any, attributeValue: any, subselectorName: any): any {
  var selector = getSelectorFromXML(responseXML, selectorName, attributeName, attributeValue);

  var value = selector.innerText || selector.text || selector.textContent;

  if (!value) {
    value = '';
  }

  return value;
}

function escapeRegExp(string: any): any {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encodeHTMLEntities(string: any): any {
  let el = document.createElement('div');
  el.textContent = string;
  return el.innerHTML;
}

function uriAsRegex(uri: any): any {
  return escapeRegExp(
    encodeHTMLEntities(uri)
  );
}

function canvasToSvg(element: any): any {
  var bbox = element.firstElementChild.getBBox();

  return element.innerHTML
    .replace(/xmlns:xlink=".*?"/, '')
    .replace(/width=".*?"/, '')
    .replace(/height=".*?"/, '')
    .replace(/viewBox=".*?"/, 'viewBox="' + bbox.x + ' ' + bbox.y + ' ' + bbox.width + ' ' + bbox.height + '" width="' + bbox.width + '" height="' + bbox.height + '" xmlns:xlink="http://www.w3.org/1999/xlink"')
    .replaceAll(new RegExp(uriAsRegex(window.location.href), 'g'), '');
}

export default class SaveLoadEngine {
  _saveFunction: any;
  _loadFunction: any;
  _customBackend: any;
  _saveInProgress: any;

  _defaultSaveFunction(args: any): void {
    var me = this;
    args.setSaveInProgress(true);
    fetch(args.patientDataUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'property#data': args.jsonData, 'property#image': args.svgData })
    })
      .catch(err => console.log('[SAVE] Error: ' + err))
      .finally(() => {
        args.setSaveInProgress(false);
        me._saveInProgress = false;
      });
  }

  _defaultLoadFunction(args: any): void {
    var didLoadData = false;

    document.dispatchEvent(new CustomEvent('pedigree:load:start'));
    fetch(args.patientDataUrl, { method: 'GET' })
      .then(response => response.text())
      .then(text => {
        try {
          var parser = new DOMParser();
          var responseXML = parser.parseFromString(text, 'application/xml');
          var rawdata = getSubSelectorTextFromXML(responseXML, 'property', 'name', 'data', 'value');
          var jsonData = unescapeRestData(rawdata);
          if (jsonData.trim()) {
            console.log('[LOAD] recived JSON: ' + JSON.stringify(jsonData));
            args.onSuccess(jsonData);
            jsonData = editor.getVersionUpdater().updateToCurrentVersion(jsonData);
            didLoadData = true;
          }
        } catch (err) {
          console.log('[LOAD] Error parsing response: ' + err);
        }
      })
      .catch(err => console.log('[LOAD] Fetch error: ' + err))
      .finally(() => {
        if (!didLoadData) {
          new TemplateSelector(true);
        }
      });
  }

  constructor(options: any) {
    this._saveFunction = options.save || this._defaultSaveFunction.bind(this);
    this._loadFunction = options.load || this._defaultLoadFunction.bind(this);
    this._customBackend = (this._saveFunction.toString() !== this._defaultSaveFunction.toString())
      && (this._loadFunction.toString() !== this._defaultLoadFunction.toString());
    this._saveInProgress = false;
  }

  serialize(): any {
    return editor.getGraph().toJSON();
  }

  createGraphFromSerializedData(JSONString: any, noUndo?: any, centerAround0?: any): void {
    console.log('---- load: parsing data ----', JSONString);
    document.dispatchEvent(new CustomEvent('pedigree:load:start'));

    try {
      var changeSet = editor.getGraph().fromJSON(JSONString);
    } catch(err) {
      console.log('ERROR loading the graph: ', err);
      alert('Error loading the graph');
      document.dispatchEvent(new CustomEvent('pedigree:graph:clear'));
      document.dispatchEvent(new CustomEvent('pedigree:load:finish'));
      return;
    }

    if (editor.getView().applyChanges(changeSet, false)) {
      editor.getWorkspace().adjustSizeToScreen();
    }

    if (centerAround0) {
      editor.getWorkspace().centerAroundNode(0);
    }

    if (!noUndo) {
      editor.getActionStack().addState(null, null, JSONString);
    }

    document.dispatchEvent(new CustomEvent('pedigree:load:finish'));
  }

  createGraphFromImportData(importString: any, importType: any, importOptions: any, noUndo?: any, centerAround0?: any): any {
    console.log('---- import: parsing data ----');
    document.dispatchEvent(new CustomEvent('pedigree:load:start'));

    try {
      var changeSet = editor.getGraph().fromImport(importString, importType, importOptions);
      if (changeSet == null) {
        throw 'unable to create a pedigree from imported data';
      }
    } catch(err) {
      console.log('Error importing pedigree:');
      console.log(err);
      alert('Error importing pedigree: ' + err);
      document.dispatchEvent(new CustomEvent('pedigree:load:finish'));
      return false;
    }

    var JSONString: any;
    if (!noUndo) {
      JSONString = editor.getGraph().toJSON();
    }

    if (editor.getView().applyChanges(changeSet, false)) {
      editor.getWorkspace().adjustSizeToScreen();
    }

    if (centerAround0) {
      editor.getWorkspace().centerAroundNode(0);
    }

    if (!noUndo) {
      editor.getActionStack().addState(null, null, JSONString);
    }

    document.dispatchEvent(new CustomEvent('pedigree:load:finish'));
    return true;
  }

  setSaveInProgress(status: any): void {
    this._saveInProgress = status;
  }

  save(patientDataUrl: any): void {
    if (this._saveInProgress) {
      return;
    }

    var jsonData = this.serialize();

    console.log('[SAVE] data: ' + JSON.stringify(jsonData));

    var image = $('canvas');
    var background = image.getElementsByClassName('panning-background')[0];
    var backgroundPosition = background.nextSibling;
    var backgroundParent =  background.parentNode;
    backgroundParent.removeChild(background);

    this._saveFunction({
      patientDataUrl: patientDataUrl,
      jsonData: jsonData,
      setSaveInProgress: this.setSaveInProgress.bind(this),
      svgData: canvasToSvg(image)
    });
    backgroundParent.insertBefore(background, backgroundPosition);
  }

  _displayData(jsonData: any): void {
    this.createGraphFromSerializedData(
      editor.getVersionUpdater().updateToCurrentVersion(jsonData)
    );
  }

  load(patientDataUrl: any): void {
    console.log('initiating load process');
    if (patientDataUrl || this._customBackend) {
      this._loadFunction({
        patientDataUrl: patientDataUrl,
        onSuccess: this._displayData.bind(this),
        onFailure: () => { new TemplateSelector(true); }
      });
    } else {
      new TemplateSelector(true);
    }
  }
}
