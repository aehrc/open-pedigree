import TemplateSelector from "./view/templateSelector";
import PedigreeExport from "./model/export";


function getParameterByName(url, name) {
    name = name.replace(/[[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) {
        return null;
    }
    if (!results[2]) {
        return '';
    }
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

const LocalStorageBackend = {

    _context: undefined,

    save: function (args) {
        args.setSaveInProgress(true);

        if (args.patientDataUrl) {
            const uri = new URI(args.patientDataUrl);
            if (uri.protocol() === 'local') {
                const localStorageKey = uri.path();
                uri.normalizeQuery();
                const options = uri.search();
                const format = getParameterByName(options, 'format') || 'internal';
                const closeOnSave = getParameterByName(options, 'closeOnSave');

                let svg = null;
                try {
                    // the export version of the svg has been cleaned up to remove urls and extra content not shown
                    // in the image.
                    svg = PedigreeExport.exportAsSVG(editor.getGraph().DG);
                } catch (err) {
                    console.log('Error creating svg');
                    console.log(err);
                }
                let jsonData;
                try {
                    jsonData = null;
                    if (format === 'fhir_v1') {
                        // var patientFhirRef = (this._context) ? this._context.patientFhirRef : null;
                        jsonData = PedigreeExport.exportAsFHIR(editor.getGraph().DG, 'all', null, svg);
                    } else if (format === 'fhir' || format === 'GA4GH') {
                        jsonData = PedigreeExport.exportAsGA4GH(editor.getGraph().DG, 'all', null, svg);
                    } else if (format === 'PED') {
                        jsonData = PedigreeExport.exportAsPED(editor.getGraph().DG, 'all');
                    } else if (format === 'DADA2') {
                        jsonData = PedigreeExport.exportAsDADA2(editor.getGraph().DG);
                    } else if (format === 'PEDX') {
                        jsonData = PedigreeExport.exportAsPEDX(editor.getGraph().DG, 'all', svg);
                    } else if (format === 'DADA2X') {
                        jsonData = PedigreeExport.exportAsDADA2X(editor.getGraph().DG, svg);
                    } else {
                        jsonData = args.jsonData;
                    }
                    const data = {
                        value: jsonData,
                        svg: svg
                    };
                    if (LocalStorageBackend._context) {
                        data.context = LocalStorageBackend._context;
                    }
                    localStorage.setItem(localStorageKey, JSON.stringify(data, null, 2));

                    console.log('[SAVE] to local storage : ' + localStorageKey + ' as ' + format);
                    args.setSaveInProgress(false)
                    if (closeOnSave === 'true' || closeOnSave === '') {
                        console.log('Attempt to close the window');
                        editor.flagClosing(true);
                        window.close();
                        editor.flagClosing(false);
                    }
                } catch (err) {
                    console.log('Error exporting pedigree:');
                    console.log(err);
                    alert('Error exporting pedigree: ' + err);
                }
            }
        }
    },

    load: function (args) {

        if (args.patientDataUrl) {
            const uri = new URI(args.patientDataUrl);
            if (uri.protocol() === 'local') {
                const localStorageKey = uri.path();
                uri.normalizeQuery();
                const options = uri.search();
                const format = getParameterByName(options, 'format') || 'internal';

                console.log('initiating load process from local storage : ' + localStorageKey + ' as ' + format);

                const data = JSON.parse(localStorage.getItem(localStorageKey));
                let clear = true;
                let createCalled = false;
                try {
                    if (data) {
                        if (data.context) {
                            LocalStorageBackend._context = data.context;
                        } else {
                            LocalStorageBackend._context = undefined;
                        }

                        let jsonData = data.value;
                        if (jsonData && jsonData.length > 0) {
                            createCalled = true;
                            if (format === 'fhir' || format === 'fhir_v1' || format === 'GA4GH' || format === 'PED' ||
                                format === 'PEDX' || format === 'DADA2' || format === 'DADA2X') {
                                if (this.createGraphFromImportData(jsonData, format, {}, false /* add to undo stack */, true /*center around 0*/)) {
                                    // loaded
                                    clear = false;
                                }
                            } else {
                                jsonData = editor.getVersionUpdater().updateToCurrentVersion(jsonData);
                                this.createGraphFromSerializedData(jsonData);
                                // the createGraphFromSerializedData method will clear if it errors
                                clear = false;
                            }
                        }
                    }
                } catch (err) {
                    console.log('Error loading pedigree:');
                    console.log(err);
                    alert('Error loading pedigree: ' + err);
                }
                if (createCalled) {
                    if (clear) {
                        // empty
                        new TemplateSelector(true);
                    }
                } else {
                    console.log('No data to load');
                    console.log('Clearing graph');
                    new TemplateSelector(true);
                }
            } else {
                new TemplateSelector(true);
            }
        } else {
            new TemplateSelector(true);
        }
    }
};

export default LocalStorageBackend;
