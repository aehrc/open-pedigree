import URI from 'urijs';
import TemplateSelector from 'pedigree/view/templateSelector';
import PedigreeExport from 'pedigree/model/export';

/**
 * SaveLoadEngine is responsible for automatic and manual save and load operations.
 *
 * @class SaveLoadEngine
 * @constructor
 */

function unescapeRestData (data: any) {
    // http://stackoverflow.com/questions/4480757/how-do-i-unescape-html-entities-in-js-change-lt-to
    var tempNode = document.createElement('div');
    tempNode.innerHTML = data.replace(/&amp;/, '&');
    return tempNode.innerText || (tempNode as any).text || tempNode.textContent;
}

function getSelectorFromXML(responseXML: any, selectorName: any, attributeName: any, attributeValue: any) {
    if (responseXML.querySelector) {
        // modern browsers
        return responseXML.querySelector(selectorName + '[' + attributeName + '=\'' + attributeValue + '\']');
    } else {
        // IE7 && IE8 && some other older browsers
        // http://www.w3schools.com/XPath/xpath_syntax.asp
        // http://msdn.microsoft.com/en-us/library/ms757846%28v=vs.85%29.aspx
        var query = '//' + selectorName + '[@' + attributeName + '=\'' + attributeValue + '\']';
        try {
            return responseXML.selectSingleNode(query);
        } catch (e) {
            // Firefox v3.0-
            alert('your browser is unsupported');
            window.stop && window.stop();
            throw 'Unsupported browser';
        }
    }
}

function getSubSelectorTextFromXML(responseXML: any, selectorName: any, attributeName: any, attributeValue: any, subselectorName: any) {
    var selector = getSelectorFromXML(responseXML, selectorName, attributeName, attributeValue);

    var value = selector.innerText || selector.text || selector.textContent;

    if (!value)     // fix IE behavior where (undefined || "" || undefined) == undefined
    {
        value = '';
    }

    return value;
}

function getParameterByName(url: any, name: any) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

export default class SaveLoadEngine {
    _saveInProgress: any;
    _context: any;

    constructor() {
        this._saveInProgress = false;
        this._context = undefined;
    }

    /**
     * Saves the state of the graph
     *
     * @return Serialization data for the entire graph
     */
    serialize(): any {
        return editor.getGraph().toJSON();
    }

    createGraphFromSerializedData(JSONString: any, noUndo?: any, centerAround0?: any): any {
        console.log('---- load: parsing data ----');
        document.dispatchEvent(new CustomEvent('pedigree:load:start'));

        var changeSet;
        try {
            changeSet = editor.getGraph().fromJSON(JSONString);
        } catch(err) {
            console.log('ERROR loading the graph: ', err);
            alert('Error loading the graph');
            document.dispatchEvent(new CustomEvent('pedigree:graph:clear'));
            document.dispatchEvent(new CustomEvent('pedigree:load:finish'));
            return false;
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

    createGraphFromImportData(importString: any, importType: any, importOptions: any, noUndo?: any, centerAround0?: any): any {
        console.log('---- import: parsing data ----');
        document.dispatchEvent(new CustomEvent('pedigree:load:start'));

        var changeSet;
        try {
            changeSet = editor.getGraph().fromImport(importString, importType, importOptions);
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

    save(patientDataUrl: any): any {
        if (this._saveInProgress) {
            return;
        }   // Don't send parallel save requests

        var me = this;

        if (patientDataUrl) {
            document.dispatchEvent(new CustomEvent('pedigree:save:start'));
            var image = document.getElementById('canvas') as HTMLElement;
            var background = image.getElementsByClassName('panning-background')[0] as HTMLElement;
            var backgroundPosition = background.nextSibling;
            var backgroundParent = background.parentNode as HTMLElement;
            backgroundParent.removeChild(background);
            var bbox = (image.firstElementChild as any).getBBox();
            var pedigreeImage = image.innerHTML.replace(/xmlns:xlink=".*?"/, '')
                .replace(/width=".*?"/, '')
                .replace(/height=".*?"/, '')
                .replace(/viewBox=".*?"/, 'viewBox="' + bbox.x + ' ' + bbox.y + ' ' + bbox.width + ' ' + bbox.height + '" width="' + bbox.width + '" height="' + bbox.height + '" xmlns:xlink="http://www.w3.org/1999/xlink"');
            var context = window.location.href.replace(/&/g,'&amp;');
            pedigreeImage = pedigreeImage.split(context).join('');

            var uri = new URI(patientDataUrl);
            if (uri.protocol() == 'local' ) {
                var localStorageKey = uri.path();
                uri.normalizeQuery();
                var options = uri.search();
                var format = getParameterByName(options, 'format') || 'internal';
                var closeOnSave = getParameterByName(options, 'closeOnSave');
                var jsonData: any = null;
                if (format === 'fhir'){
                    var patientFhirRef = null;
                    jsonData = PedigreeExport.exportAsFHIR(editor.getGraph().DG, 'all', patientFhirRef, pedigreeImage);
                }
                else {
                    jsonData = this.serialize();
                }
                var data = {} as any;
                data.value = jsonData;
                if (this._context){
                    data.context = this._context;
                }
                localStorage.setItem(localStorageKey, JSON.stringify(data, null, 2));

                console.log('[SAVE] to local storage : ' + localStorageKey + ' as ' + format);
                document.dispatchEvent(new CustomEvent('pedigree:save:complete'));
                if (closeOnSave === 'true' || closeOnSave === ''){
                    console.log('Attempt to close the window');
                    window.close();
                }
            }
            else {
                var jsonData2 = this.serialize();

                console.log('[SAVE] data: ' + JSON.stringify(jsonData2,null, 2));

                me._saveInProgress = true;
                fetch(patientDataUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ 'property#data': jsonData2, 'property#image': pedigreeImage })
                })
                    .catch(err => console.log('[SAVE] Error: ' + err))
                    .finally(() => {
                        me._saveInProgress = false;
                        document.dispatchEvent(new CustomEvent('pedigree:save:complete'));
                    });
            }
            backgroundParent.insertBefore(background, backgroundPosition);
        }
    }

    load(patientDataUrl: any): any {

        console.log('initiating load process');
        var _this = this;
        var didLoadData = false;
        if (patientDataUrl) {
            var uri = new URI(patientDataUrl);
            if (uri.protocol() == 'local' ){
                var localStorageKey = uri.path();
                uri.normalizeQuery();
                var options = uri.search();
                var format = getParameterByName(options, 'format') || 'internal';

                console.log('initiating load process from local storage : ' + localStorageKey + ' as ' + format);

                var data = JSON.parse(localStorage.getItem(localStorageKey) as any);
                var clear = true;
                var createCalled = false;
                if (data){
                    if(data.context){
                        this._context = data.context;
                    }
                    else {
                        this._context = undefined;
                    }

                    var jsonData  = data.value;
                    if (jsonData){
                        createCalled = true;
                        if (format === 'fhir'){
                            if (this.createGraphFromImportData(jsonData, format, {}, false /* add to undo stack */, true /*center around 0*/)){
                                // loaded
                                clear = false;
                            }
                        }
                        else {
                            jsonData = editor.getVersionUpdater().updateToCurrentVersion(jsonData);
                            this.createGraphFromSerializedData(jsonData);
                            // the createGraphFromSerializedData method will clear if it errors
                            clear = false;
                        }
                    }
                }
                if (createCalled){
                    if (clear){
                        // empty
                        new TemplateSelector(true);
                    }
                }
                else {
                    console.log('No data to load');
                    console.log('Clearing graph');
                    new TemplateSelector(true);
                }
            }
            else {
                document.dispatchEvent(new CustomEvent('pedigree:load:start'));
                fetch(patientDataUrl, { method: 'GET' })
                    .then(response => response.text())
                    .then(text => {
                        try {
                            var parser = new DOMParser();
                            var responseXML = parser.parseFromString(text, 'application/xml');
                            var rawdata  = getSubSelectorTextFromXML(responseXML, 'property', 'name', 'data', 'value');
                            var jsonData = unescapeRestData(rawdata);
                            if (jsonData.trim()) {
                                console.log('[LOAD] recived JSON: ' + JSON.stringify(jsonData));

                                jsonData = editor.getVersionUpdater().updateToCurrentVersion(jsonData);

                                _this.createGraphFromSerializedData(jsonData);

                                didLoadData = true;
                            }
                        } catch (err) {
                            console.log('[LOAD] Error parsing response: ' + err);
                        }
                    })
                    .catch(err => console.log('[LOAD] Fetch error: ' + err))
                    .finally(() => {
                        if (!didLoadData) {
                            // If load failed, just open templates
                            new TemplateSelector(true);
                        }
                    });
            }
        } else {
            new TemplateSelector(true);
        }
    }
}
