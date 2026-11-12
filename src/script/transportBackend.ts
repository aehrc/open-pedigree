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
 * - `receive(key)` gives the stored `{value, context}` for the key, or null for nothing stored.
 *   `value` is the stored text (JSON as a string, or PED text), as `send` gives it. The `context`
 *   is the host's own and goes back with each save.
 * - `send(key, {value, svg, context})` delivers a save.
 * Either may return its result directly or as a Promise. A rejected or throwing `receive` loads
 * nothing (the template chooser); a rejected or throwing `send` means the save wasn't delivered:
 * the window stays open, and the user is told - with the error's `pedigreeMessage` when it has
 * one (e.g. the host refused the pedigree and says why), else NOT_SENT_MESSAGE.
 *
 * A save while this backend's load is still waiting for `receive` isn't sent (it would send the
 * canvas from before the pedigree arrived): it is skipped, as the editor skips saves while it
 * waits for its first load. A load gives up on a `receive` that hasn't settled after
 * RECEIVE_TIMEOUT_MS, and an answer after that is ignored. An asynchronous load returns a Promise
 * that settles when it's done, so the editor keeps its loading cover up until then. A save treats a `send` that hasn't
 * settled after SEND_TIMEOUT_MS as not delivered. A pedigree that arrives once the canvas already
 * has one (e.g. the user started drawing) isn't drawn over it.
 */
export interface PedigreeTransport {
  receive(key: string): any;
  send(key: string, data: { value: any; svg: any; context?: any }): any;
}

// How long a load waits for `receive` before giving up (the template chooser), and a save for
// `send` before treating it as not delivered.
export const RECEIVE_TIMEOUT_MS = 30000;
export const SEND_TIMEOUT_MS = 30000;

export const NOT_SENT_MESSAGE = 'The pedigree could not be sent back (the page that opened this editor '
  + 'may have been closed or reloaded). Your changes are still here: keep this window open and try '
  + 'Save again, or use Export to keep a copy.';

const IMPORT_FORMATS = ['fhir', 'fhir_v1', 'GA4GH', 'PED', 'PEDX', 'DADA2', 'DADA2X'];

// Whether the editor's canvas has no pedigree yet (its own rule, when it has one).
function canvasIsEmpty(): boolean {
  const editor = (window as any).editor;
  if (!editor) {
    return true;
  }
  if (typeof editor._graphIsEmpty === 'function') {
    return editor._graphIsEmpty();
  }
  const graph = editor.getGraph && editor.getGraph();
  return !graph || graph.getMaxNodeId() < 0;
}

// Runs `then` on a value, or once a Promise of it resolves; `fail` on a throw or rejection. A plain
// value is handled straight away, so a synchronous transport behaves synchronously. An error in
// `then` itself is logged, not passed to `fail`: the transport did its part.
function settle(produce: () => any, then: (value: any) => void, fail: (err: any) => void): void {
  const guarded = (fn: (arg: any) => void) => (arg: any) => {
    try {
      fn(arg);
    } catch (err) {
      console.error(err);
    }
  };
  let result;
  try {
    result = produce();
  } catch (err) {
    guarded(fail)(err);
    return;
  }
  if (result && typeof result.then === 'function') {
    result.then(guarded(then), guarded(fail));
    return;
  }
  guarded(then)(result);
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
  // Which load is current: an answer to an earlier one is ignored.
  let currentLoad = 0;

  const backend: any = {
    _context: undefined,

    save: function (args: any) {
      const options = parseLocalUrl(args.patientDataUrl);
      if (!options) {
        return;
      }
      if (loading) {
        console.warn('[SAVE] Skipped: the pedigree has not arrived yet');
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
      // Settles once: the transport's answer, or the timeout.
      let answered = false;
      const once = (fn: (arg: any) => void) => (arg: any) => {
        if (!answered) {
          answered = true;
          clearTimeout(sendTimer);
          fn(arg);
        }
      };
      let sendTimer: any = null;
      const delivered = once(() => {
        console.log('[SAVE] sent : ' + options.key + ' as ' + options.format);
        args.setSaveInProgress(false);
        if (options.closeOnSave) {
          console.log('Attempt to close the window');
          editor.flagClosing(true);
          try {
            window.close();
          } finally {
            editor.flagClosing(false);
          }
        }
      });
      const notDelivered = once((err: any) => {
        console.warn('[SAVE] not delivered: ' + options.key, err);
        args.setSaveInProgress(false);
        const hostMessage = err && typeof err.pedigreeMessage === 'string' ? err.pedigreeMessage.trim() : '';
        alert(hostMessage || NOT_SENT_MESSAGE);
      });
      settle(() => transport.send(options.key, data), delivered, notDelivered);
      if (!answered) {
        sendTimer = setTimeout(() => notDelivered(new Error('send did not settle')), SEND_TIMEOUT_MS);
      }
    },

    load: function (args: any) {
      const options = parseLocalUrl(args.patientDataUrl);
      if (!options) {
        new TemplateSelector(true);
        return;
      }
      console.log('initiating load process : ' + options.key + ' as ' + options.format);
      const engine = this;
      const thisLoad = ++currentLoad;
      // A fresh load forgets the last one's context: a save goes back with what this one got.
      backend._context = undefined;
      loading = true;
      let timer: any = null;
      let done: () => void = () => {};
      const finished = new Promise<void>((resolve) => { done = resolve; });
      // Runs once, for the current load only.
      const settled = (fn: () => void) => {
        if (thisLoad !== currentLoad || !loading) {
          return;
        }
        clearTimeout(timer);
        loading = false;
        try {
          fn();
        } finally {
          done();
        }
      };
      const nothing = (err: any) => settled(() => {
        console.warn('[LOAD] nothing received: ' + options.key, err);
        if (canvasIsEmpty()) {
          new TemplateSelector(true);
        }
      });
      settle(() => transport.receive(options.key), (data) => settled(() => {
        backend._context = data && data.context ? data.context : undefined;
        if (!canvasIsEmpty()) {
          // (as the editor's own deferred first load does: never replace a pedigree already there)
          console.warn('[LOAD] Not drawn: the canvas already has a pedigree');
          return;
        }
        backend._display(engine, data, options.format);
      }), nothing);
      if (loading && thisLoad === currentLoad) {
        timer = setTimeout(() => nothing(new Error('receive did not settle')), RECEIVE_TIMEOUT_MS);
        // (the editor waits for this, under its loading cover)
        return finished;
      }
      return undefined;
    },

    _display: function (engine: any, data: any, format: string) {
      let clear = true;
      let createCalled = false;
      try {
        if (data) {
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
