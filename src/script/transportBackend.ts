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
 * the window stays open, and the user is told.
 */
export interface PedigreeTransport {
  receive(key: string): any;
  send(key: string, data: { value: any; svg: any; context?: any }): any;
}

export const NOT_SENT_MESSAGE = 'The pedigree could not be sent back (the page that opened this editor '
  + 'may have been closed or reloaded). Your changes are still here: keep this window open and try '
  + 'Save again, or use Export to keep a copy.';

const IMPORT_FORMATS = ['fhir', 'fhir_v1', 'GA4GH', 'PED', 'PEDX', 'DADA2', 'DADA2X'];

// Runs `then` on a value, or once a Promise of it resolves; `fail` on a throw or rejection. A plain
// value is handled straight away, so a synchronous transport behaves synchronously.
function settle(produce: () => any, then: (value: any) => void, fail: (err: any) => void): any {
  let result;
  try {
    result = produce();
  } catch (err) {
    fail(err);
    return undefined;
  }
  if (result && typeof result.then === 'function') {
    return result.then(then, fail);
  }
  then(result);
  return undefined;
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
  // A save waits for this backend's load to settle, so it never sends an empty canvas over a
  // pedigree that is still arriving.
  let loading: Promise<void> | null = null;

  const backend: any = {
    _context: undefined,

    save: function (args: any) {
      const options = parseLocalUrl(args.patientDataUrl);
      if (!options) {
        return;
      }
      args.setSaveInProgress(true);
      if (loading) {
        loading.then(() => backend._save(args, options));
      } else {
        backend._save(args, options);
      }
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
        alert(NOT_SENT_MESSAGE);
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
      let done: () => void = () => {};
      const pending = new Promise<void>((resolve) => { done = resolve; });
      let settled = false;
      const finish = () => {
        settled = true;
        done();
        if (loading === pending) {
          loading = null;
        }
      };
      settle(() => transport.receive(options.key), (data) => {
        try {
          backend._display(engine, data, options.format);
        } finally {
          finish();
        }
      }, (err) => {
        console.warn('[LOAD] nothing received: ' + options.key, err);
        try {
          new TemplateSelector(true);
        } finally {
          finish();
        }
      });
      if (!settled) {
        loading = pending;
      }
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
