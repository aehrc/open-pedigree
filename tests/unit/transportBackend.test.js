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
import { createTransportBackend, NOT_SENT_MESSAGE, RECEIVE_TIMEOUT_MS, SEND_TIMEOUT_MS } from 'pedigree/transportBackend';

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
    let close, alertSpy, engine, maxNodeId;

    beforeEach(() => {
        TemplateSelector.mockClear();
        maxNodeId = -1; // (an empty canvas)
        globalThis.editor = {
            getView: () => ({ withoutGenerationNumbering: (fn) => fn() }),
            getGraph: () => ({ DG: {}, getMaxNodeId: () => maxNodeId }),
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

    it('does not send a save made while its load is waiting, and saves normally once loaded', async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        backend.load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        const early = saveArgs('local:pedigreeData');
        backend.save(early);
        await flush();
        expect(t.send).not.toHaveBeenCalled();
        expect(early.setSaveInProgress).not.toHaveBeenCalledWith(true);
        // (skipped quietly, as the editor skips saves while waiting for its first load)
        expect(alertSpy).not.toHaveBeenCalled();

        t.received[0].resolve({ value: 'STORED', context: { field: 'f' } });
        await flush();
        expect(engine.createGraphFromSerializedData).toHaveBeenCalledWith('STORED');
        // (the early save is never sent later, with the canvas from before the load)
        expect(t.send).not.toHaveBeenCalled();

        backend.save(saveArgs('local:pedigreeData'));
        expect(t.sent).toHaveLength(1);
        expect(t.sent[0].data.context).toEqual({ field: 'f' });
    });

    it("shows the host's own message when it refuses a save", async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        const args = saveArgs();
        backend.save(args);
        t.sent[0].reject(Object.assign(new Error('refused'), { pedigreeMessage: 'Too large for the form.' }));
        await flush();
        expect(alertSpy).toHaveBeenCalledWith('Too large for the form.');
        expect(close).not.toHaveBeenCalled();
        expect(args.setSaveInProgress).toHaveBeenLastCalledWith(false);
    });

    it("forgets the last load's context when a later load gets nothing", async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        backend.load.call(engine, { patientDataUrl: URL_CLOSING });
        t.received[0].resolve({ value: 'STORED', context: { field: 'x' } });
        await flush();
        backend.load.call(engine, { patientDataUrl: URL_CLOSING });
        t.received[1].resolve(null);
        await flush();
        backend.save(saveArgs());
        expect(t.sent[0].data.context).toBeUndefined();
    });

    it('a failure after delivery is logged, not reported as not delivered, and the save has ended', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        close.mockImplementation(() => { throw new Error('boom'); });
        const backend = createTransportBackend({ receive: () => null, send: () => Promise.resolve() });
        const args = saveArgs();
        backend.save(args);
        await flush();
        expect(alertSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();
        expect(args.setSaveInProgress).toHaveBeenLastCalledWith(false);
        // (not left flagged as closing, which would drop the leave-page warning)
        expect(globalThis.editor.flagClosing).toHaveBeenLastCalledWith(false);
        errorSpy.mockRestore();
    });

    it('falls back to the generic message when the host gives an empty one', async () => {
        const t = deferredTransport();
        createTransportBackend(t).save(saveArgs());
        t.sent[0].reject(Object.assign(new Error('refused'), { pedigreeMessage: '  ' }));
        await flush();
        expect(alertSpy).toHaveBeenCalledWith(NOT_SENT_MESSAGE);
    });

    it("ignores an earlier load's late answer", async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        backend.load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        backend.load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        t.received[0].resolve({ value: 'OLD', context: { field: 'old' } });
        await flush();
        expect(engine.createGraphFromSerializedData).not.toHaveBeenCalled();
        backend.save(saveArgs('local:pedigreeData'));
        expect(t.send).not.toHaveBeenCalled();

        t.received[1].resolve({ value: 'NEW', context: { field: 'new' } });
        await flush();
        expect(engine.createGraphFromSerializedData).toHaveBeenCalledWith('NEW');
        backend.save(saveArgs('local:pedigreeData'));
        expect(t.sent[0].data.context).toEqual({ field: 'new' });
    });

    it('gives up on a receive that never settles, and ignores it if it answers later', async () => {
        vi.useFakeTimers();
        try {
            const t = deferredTransport();
            const backend = createTransportBackend(t);
            backend.load.call(engine, { patientDataUrl: 'local:pedigreeData' });
            vi.advanceTimersByTime(RECEIVE_TIMEOUT_MS - 1);
            expect(TemplateSelector).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);
            expect(TemplateSelector).toHaveBeenCalledTimes(1);

            backend.save(saveArgs('local:pedigreeData'));
            expect(t.sent).toHaveLength(1);

            t.received[0].resolve({ value: 'LATE' });
            await vi.runAllTimersAsync();
            expect(engine.createGraphFromSerializedData).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
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

    it('does not draw a late pedigree over one already on the canvas', async () => {
        const t = deferredTransport();
        createTransportBackend(t).load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        maxNodeId = 2; // (the user started drawing)
        t.received[0].resolve({ value: 'STORED' });
        await flush();
        expect(engine.createGraphFromSerializedData).not.toHaveBeenCalled();
    });

    it('treats a send that never settles as not delivered', async () => {
        vi.useFakeTimers();
        try {
            const t = deferredTransport();
            const args = saveArgs();
            createTransportBackend(t).save(args);
            vi.advanceTimersByTime(SEND_TIMEOUT_MS - 1);
            expect(alertSpy).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);
            expect(alertSpy).toHaveBeenCalledWith(NOT_SENT_MESSAGE);
            expect(args.setSaveInProgress).toHaveBeenLastCalledWith(false);

            // (a late answer changes nothing: the window stays open)
            t.sent[0].resolve();
            await vi.runAllTimersAsync();
            expect(close).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('an asynchronous load returns a Promise that settles once the pedigree is in; a synchronous one returns nothing', async () => {
        const t = deferredTransport();
        const pending = createTransportBackend(t).load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        expect(typeof pending.then).toBe('function');
        let settled = false;
        pending.then(() => { settled = true; });
        await flush();
        expect(settled).toBe(false);
        t.received[0].resolve({ value: 'STORED' });
        await flush();
        expect(settled).toBe(true);
        expect(engine.createGraphFromSerializedData).toHaveBeenCalledWith('STORED');

        const sync = createTransportBackend({ receive: () => null, send: () => {} }).load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        expect(sync).toBeUndefined();
    });

    it('does not put the template chooser over a pedigree already on the canvas when nothing arrives', async () => {
        const t = deferredTransport();
        createTransportBackend(t).load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        maxNodeId = 2;
        t.received[0].reject(new Error('no answer'));
        await flush();
        expect(TemplateSelector).not.toHaveBeenCalled();
    });

    it("keeps the host's context when a late pedigree isn't drawn", async () => {
        const t = deferredTransport();
        const backend = createTransportBackend(t);
        backend.load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        maxNodeId = 2;
        t.received[0].resolve({ value: 'STORED', context: { field: 'f' } });
        await flush();
        backend.save(saveArgs('local:pedigreeData'));
        expect(t.sent[0].data.context).toEqual({ field: 'f' });
    });
});
