import URI from 'urijs';
import TemplateSelector from './view/templateSelector';
import PedigreeExportModule from './model/export';

// (export.ts's default export is typed as a function; its methods are added to it)
const PedigreeExport: any = PedigreeExportModule;

/**
 * A save/load backend for a page that hands the pedigree to and from somewhere else: the formats,
 * close-on-save and the template chooser are here, and the host supplies only the transport.
 *
 * The backend reads its options from `patientDataUrl`, `local:<key>?format=<f>&closeOnSave`:
 * - `format` picks the import and export (GA4GH (`fhir`, `GA4GH`; legacy `fhir_v1` is read and
 *   saved as GA4GH), `PED`, `PEDX`, `DADA2`, `DADA2X`, or the internal JSON when absent);
 * - `closeOnSave` (`true`, or present without a value) closes the window once a save is delivered.
 *
 * The transport:
 * - `receive(key)` gives the stored `{value, context}` for the key, or null for nothing stored. The
 *   `context` is the host's own and goes back with each save.
 * - `send(key, {value, svg, context})` delivers a save.
 * Either may return its result directly or as a Promise. A rejected or throwing `receive` loads
 * nothing (the template chooser); a rejected or throwing `send` means the save wasn't delivered:
 * the window stays open, and the user is told - with the error's `pedigreeMessage` when it has
 * one (e.g. the host refused the pedigree and says why), else NOT_SENT_MESSAGE.
 *
 * A save while this backend's load is still waiting for `receive` isn't sent (it would send the
 * canvas from before the pedigree arrived): it ends at once and the user is asked to try again.
 * So `receive` must settle - a transport that can wait on something else gives it a timeout.
 */
export interface PedigreeTransport {
  receive(key: string): any;
  send(key: string, data: { value: any; svg: any; context?: any }): any;
}

export const STILL_LOADING_MESSAGE = 'The pedigree is still loading. Try saving again in a moment.';

export const NOT_SENT_MESSAGE = 'The pedigree could not be sent back (the page that opened this editor '
  + 'may have been closed or reloaded). Your changes are still here: keep this window open and try '
  + 'Save again, or use Export to keep a copy.';

const IMPORT_FORMATS = ['fhir', 'fhir_v1', 'GA4GH', 'PED', 'PEDX', 'DADA2', 'DADA2X'];

// Runs `then` on a value, or once a Promise of it resolves; `fail` on a throw or rejection. A plain
// value is handled straight away, so a synchronous transport behaves synchronously. An error in
// `then` itself is logged, not passed to `fail`: the transport did its part.
function settle(produce: () => any, then: (value: any) => void, fail: (err: any) => void): void {
  const handle = (value: any) => {
    try {
      then(value);
    } catch (err) {
      console.error(err);
    }
  };
  let result;
  try {
    result = produce();
  } catch (err) {
    fail(err);
    return;
  }
  if (result && typeof result.then === 'function') {
    result.then(handle, fail);
    return;
  }
  handle(result);
}

// The key and options of a `local:` patientDataUrl, or null for any other.
function parseLocalUrl(patientDataUrl: any): { key: string; format: string; closeOnSave: boolean } | null {
  if (!patientDataUrl) {
    return null;
  }
  const uri = new URI(patientDataUrl);
  if (uri.protocol() !== 'local') {
    return null;
  }
  const key = uri.path();
  uri.normalizeQuery();
  // null when absent, '' when present without a value (e.g. "?closeOnSave")
  const options = new URLSearchParams(uri.search());
  const closeOnSave = options.get('closeOnSave');
  return {
    key,
    format: options.get('format') || 'internal',
    closeOnSave: closeOnSave === 'true' || closeOnSave === '',
  };
}

function exportAs(format: string, jsonData: any, svg: any): any {
  const DG = (window as any).editor.getGraph().DG;
  // The Legacy FHIR format (fhir_v1) is read but no longer written: it's saved as GA4GH.
  if (format === 'fhir' || format === 'GA4GH' || format === 'fhir_v1') {
    return PedigreeExport.exportAsGA4GH(DG, 'all', null, svg);
  } else if (format === 'PED') {
    return PedigreeExport.exportAsPED(DG, 'all');
  } else if (format === 'DADA2') {
    return PedigreeExport.exportAsDADA2(DG);
  } else if (format === 'PEDX') {
    return PedigreeExport.exportAsPEDX(DG, 'all', svg);
  } else if (format === 'DADA2X') {
    return PedigreeExport.exportAsDADA2X(DG, svg);
  }
  return jsonData;
}

export function createTransportBackend(transport: PedigreeTransport): any {
  // While true, the pedigree hasn't arrived from `receive` yet, and a save isn't sent.
  let loading = false;

  const backend: any = {
    _context: undefined,

    save: function (args: any) {
      const options = parseLocalUrl(args.patientDataUrl);
      if (!options) {
        return;
      }
      if (loading) {
        console.warn('[SAVE] Skipped: the pedigree has not arrived yet');
        alert(STILL_LOADING_MESSAGE);
        return;
      }
      args.setSaveInProgress(true);
      backend._save(args, options);
    },

    _save: function (args: any, options: any) {
      const editor = (window as any).editor;
      let svg = null;
      try {
        // the export version of the svg has been cleaned up to remove urls and extra content not shown
        // in the image.
        // (the saved image never has generation numbering: it's view state)
        svg = editor.getView().withoutGenerationNumbering(() => PedigreeExport.exportAsSVG(editor.getGraph().DG));
      } catch (err) {
        console.log('Error creating svg');
        console.log(err);
      }
      let data: any;
      try {
        data = { value: exportAs(options.format, args.jsonData, svg), svg: svg };
        if (backend._context) {
          data.context = backend._context;
        }
      } catch (err) {
        console.log('Error exporting pedigree:');
        console.log(err);
        args.setSaveInProgress(false);
        alert('Error exporting pedigree: ' + err);
        return;
      }
      settle(() => transport.send(options.key, data), () => {
        console.log('[SAVE] sent : ' + options.key + ' as ' + options.format);
        args.setSaveInProgress(false);
        if (options.closeOnSave) {
          console.log('Attempt to close the window');
          editor.flagClosing(true);
          window.close();
          editor.flagClosing(false);
        }
      }, (err) => {
        console.warn('[SAVE] not delivered: ' + options.key, err);
        args.setSaveInProgress(false);
        alert(err && typeof err.pedigreeMessage === 'string' ? err.pedigreeMessage : NOT_SENT_MESSAGE);
      });
    },

    load: function (args: any) {
      const options = parseLocalUrl(args.patientDataUrl);
      if (!options) {
        new TemplateSelector(true);
        return;
      }
      console.log('initiating load process : ' + options.key + ' as ' + options.format);
      const engine = this;
      // A fresh load forgets the last one's context: a save goes back with what this one got.
      backend._context = undefined;
      // (a transport must settle receive - e.g. with a timeout - or saving stays refused)
      loading = true;
      settle(() => transport.receive(options.key), (data) => {
        loading = false;
        backend._display(engine, data, options.format);
      }, (err) => {
        loading = false;
        console.warn('[LOAD] nothing received: ' + options.key, err);
        new TemplateSelector(true);
      });
    },

    _display: function (engine: any, data: any, format: string) {
      let clear = true;
      let createCalled = false;
      try {
        if (data) {
          backend._context = data.context ? data.context : undefined;
          let jsonData = data.value;
          if (jsonData && jsonData.length > 0) {
            createCalled = true;
            if (IMPORT_FORMATS.indexOf(format) !== -1) {
              if (engine.createGraphFromImportData(jsonData, format, {}, false /* add to undo stack */, true /*center around 0*/)) {
                // loaded
                clear = false;
              }
            } else {
              jsonData = (window as any).editor.getVersionUpdater().updateToCurrentVersion(jsonData);
              engine.createGraphFromSerializedData(jsonData);
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
      if (!createCalled) {
        console.log('No data to load');
        console.log('Clearing graph');
      }
      if (clear) {
        new TemplateSelector(true);
      }
    },
  };
  return backend;
}
