import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('pedigree/model/export', () => ({
    default: {
        exportAsSVG: vi.fn().mockReturnValue('<svg/>'),
        exportAsGA4GH: vi.fn().mockReturnValue('GA4GH-DATA'),
        exportAsPED: vi.fn().mockReturnValue('PED-DATA'),
        exportAsDADA2: vi.fn().mockReturnValue('DADA2-DATA'),
        exportAsPEDX: vi.fn().mockReturnValue('PEDX-DATA'),
        exportAsDADA2X: vi.fn().mockReturnValue('DADA2X-DATA'),
    }
}));
vi.mock('pedigree/view/templateSelector', () => ({ default: vi.fn() }));

import TemplateSelector from 'pedigree/view/templateSelector';
import { createTransportBackend, NOT_SENT_MESSAGE } from 'pedigree/transportBackend';

const URL_CLOSING = 'local:pedigreeData?format=GA4GH&closeOnSave=true';

// A transport whose receive/send results the test settles by hand.
function deferredTransport() {
    const t = { received: [], sent: [] };
    t.receive = vi.fn((key) => new Promise((resolve, reject) => t.received.push({ key, resolve, reject })));
    t.send = vi.fn((key, data) => new Promise((resolve, reject) => t.sent.push({ key, data, resolve, reject })));
    return t;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createTransportBackend', () => {
    let close, alertSpy, engine;

    beforeEach(() => {
        TemplateSelector.mockClear();
        globalThis.editor = {
            getView: () => ({ withoutGenerationNumbering: (fn) => fn() }),
            getGraph: () => ({ DG: {} }),
            getVersionUpdater: () => ({ updateToCurrentVersion: (d) => d }),
            flagClosing: vi.fn(),
        };
        close = vi.spyOn(window, 'close').mockImplementation(() => {});
        alertSpy = vi.fn();
        globalThis.alert = alertSpy;
        engine = {
            createGraphFromImportData: vi.fn().mockReturnValue(true),
            createGraphFromSerializedData: vi.fn(),
        };
    });

    afterEach(() => {
        delete globalThis.editor;
        delete globalThis.alert;
        close.mockRestore();
    });

    const saveArgs = (patientDataUrl = URL_CLOSING) => ({ patientDataUrl, setSaveInProgress: vi.fn(), jsonData: 'INTERNAL-DATA' });

    it('closes the window once the save is delivered, and not before', async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        const args = saveArgs();
        backend.save(args);
        expect(t.sent).toHaveLength(1);
        expect(t.sent[0].key).toBe('pedigreeData');
        expect(t.sent[0].data).toEqual({ value: 'GA4GH-DATA', svg: '<svg/>' });
        await flush();
        expect(close).not.toHaveBeenCalled();
        expect(args.setSaveInProgress).toHaveBeenLastCalledWith(true);

        t.sent[0].resolve();
        await flush();
        expect(close).toHaveBeenCalledTimes(1);
        expect(args.setSaveInProgress).toHaveBeenLastCalledWith(false);
        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('keeps the window open, ends the save and tells the user when the save is not delivered', async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        const args = saveArgs();
        backend.save(args);
        t.sent[0].reject(new Error('no answer'));
        await flush();
        expect(close).not.toHaveBeenCalled();
        expect(args.setSaveInProgress).toHaveBeenLastCalledWith(false);
        expect(alertSpy).toHaveBeenCalledWith(NOT_SENT_MESSAGE);
    });

    it('treats a send that throws as not delivered', () => {
        const backend = createTransportBackend({ receive: () => null, send: () => { throw new Error('gone'); } });
        const args = saveArgs();
        backend.save(args);
        expect(close).not.toHaveBeenCalled();
        expect(args.setSaveInProgress).toHaveBeenLastCalledWith(false);
        expect(alertSpy).toHaveBeenCalledWith(NOT_SENT_MESSAGE);
    });

    it('does not close a delivered save when closeOnSave is off', async () => {
        const backend = createTransportBackend({ receive: () => null, send: () => Promise.resolve() });
        backend.save(saveArgs('local:pedigreeData?format=PED'));
        await flush();
        expect(close).not.toHaveBeenCalled();
    });

    it('sends back the context it received, in the format the URL names', async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        backend.load.call(engine, { patientDataUrl: 'local:pedigreeData?format=PED' });
        t.received[0].resolve({ value: 'STORED', context: { field: 'pedigree_diagram' } });
        await flush();
        expect(engine.createGraphFromImportData).toHaveBeenCalledWith('STORED', 'PED', {}, false, true);

        backend.save(saveArgs('local:pedigreeData?format=PED'));
        expect(t.sent[0].data).toEqual({ value: 'PED-DATA', svg: '<svg/>', context: { field: 'pedigree_diagram' } });
    });

    it('exports DADA2', () => {
        const t = deferredTransport();
        createTransportBackend(t).save(saveArgs('local:pedigreeData?format=DADA2'));
        expect(t.sent[0].data.value).toBe('DADA2-DATA');
    });

    it('holds a save until its load has settled', async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        backend.load.call(engine, { patientDataUrl: URL_CLOSING });
        backend.save(saveArgs());
        await flush();
        expect(t.send).not.toHaveBeenCalled();

        t.received[0].resolve({ value: 'STORED', context: { field: 'f' } });
        await flush();
        expect(engine.createGraphFromImportData).toHaveBeenCalled();
        expect(t.sent).toHaveLength(1);
        expect(t.sent[0].data.context).toEqual({ field: 'f' });
    });

    it('shows the template chooser when nothing is received', async () => {
        const t = deferredTransport();
        createTransportBackend(t).load.call(engine, { patientDataUrl: URL_CLOSING });
        t.received[0].resolve(null);
        await flush();
        expect(TemplateSelector).toHaveBeenCalledTimes(1);
        expect(engine.createGraphFromImportData).not.toHaveBeenCalled();
    });

    it('shows the template chooser when receive rejects, and a later save is not held', async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        backend.load.call(engine, { patientDataUrl: URL_CLOSING });
        t.received[0].reject(new Error('no opener'));
        await flush();
        expect(TemplateSelector).toHaveBeenCalledTimes(1);

        backend.save(saveArgs());
        expect(t.sent).toHaveLength(1);
    });

    it('handles a synchronous transport synchronously', () => {
        const sent = [];
        const backend = createTransportBackend({
            receive: () => ({ value: 'STORED' }),
            send: (key, data) => { sent.push(data); },
        });
        backend.load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        expect(engine.createGraphFromSerializedData).toHaveBeenCalledWith('STORED');
        backend.save(saveArgs());
        expect(sent).toHaveLength(1);
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('does nothing for a patientDataUrl that is not local:', () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        const args = saveArgs('https://example.org/pedigree');
        backend.save(args);
        expect(t.send).not.toHaveBeenCalled();
        expect(args.setSaveInProgress).not.toHaveBeenCalled();
        backend.load.call(engine, { patientDataUrl: 'https://example.org/pedigree' });
        expect(t.receive).not.toHaveBeenCalled();
        expect(TemplateSelector).toHaveBeenCalledTimes(1);
    });
});
