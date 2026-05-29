import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('pedigree/model/export', () => ({
    default: {
        exportAsGA4GH: vi.fn().mockReturnValue(
            '{"resourceType":"Bundle","type":"document","entry":[{"fullUrl":"urn:uuid:comp-1","resource":{"resourceType":"Composition","id":"comp-1","section":[],"author":[]}}]}'
        )
    }
}));

import SmartFhirBackend from 'pedigree/SmartFhirBackend';

const GA4GH_PROFILE = 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree';

function makeClient(overrides = {}) {
    return {
        patient: { read: vi.fn().mockResolvedValue({ id: 'p1' }) },
        request: vi.fn(),
        state: {},
        ...overrides,
    };
}

function makeArgs(overrides = {}) {
    return {
        setSaveInProgress: vi.fn(),
        svgData: null,
        jsonData: '{}',
        patientDataUrl: '',
        onSuccess: vi.fn(),
        onFailure: vi.fn(),
        ...overrides,
    };
}

describe('SmartFhirBackend.load', () => {
    let sessionStorageData = {};

    beforeEach(() => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(k => sessionStorageData[k] ?? null);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { sessionStorageData[k] = v; });
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(k => { delete sessionStorageData[k]; });
        sessionStorageData = {};

        global.window = global.window || {};
        global.window.editor = undefined;
    });

    afterEach(() => vi.restoreAllMocks());

    it('calls onFailure when Composition bundle is empty', async () => {
        const client = makeClient({ request: vi.fn().mockResolvedValue({ entry: [] }) });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.load(args);
        await new Promise(r => setTimeout(r, 20));

        expect(args.onFailure).toHaveBeenCalled();
    });

    it('calls onFailure when bundle has no entry property', async () => {
        const client = makeClient({ request: vi.fn().mockResolvedValue({}) });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.load(args);
        await new Promise(r => setTimeout(r, 20));

        expect(args.onFailure).toHaveBeenCalled();
    });

    it('stores Composition ID in sessionStorage when Composition found', async () => {
        const composition = { resourceType: 'Composition', id: 'comp-42' };
        const client = makeClient({ request: vi.fn().mockResolvedValue({ entry: [{ resource: composition }] }) });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.load(args);
        await new Promise(r => setTimeout(r, 20));

        expect(sessionStorageData['smart_composition_p1']).toBe('comp-42');
    });

    it('calls onFailure when client.request rejects', async () => {
        const client = makeClient({ request: vi.fn().mockRejectedValue(new Error('network fail')) });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.load(args);
        await new Promise(r => setTimeout(r, 20));

        expect(args.onFailure).toHaveBeenCalled();
    });
});

describe('SmartFhirBackend.save', () => {
    let sessionStorageData = {};

    beforeEach(() => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(k => sessionStorageData[k] ?? null);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { sessionStorageData[k] = v; });
        sessionStorageData = {};

        global.window = global.window || {};
        global.window.editor = {
            getGraph: () => ({ DG: {} }),
        };

    });

    afterEach(() => vi.restoreAllMocks());

    it('POSTs on first save and stores Composition ID', async () => {
        const client = makeClient({
            request: vi.fn()
                .mockResolvedValueOnce({ id: 'p1' })
                .mockResolvedValueOnce({ id: 'new-comp-1' }),
        });
        client.patient.read = vi.fn().mockResolvedValue({ id: 'p1' });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.save(args);
        await new Promise(r => setTimeout(r, 50));

        const requestCall = client.request.mock.calls.find(c => c[0] && c[0].method === 'POST');
        expect(requestCall).toBeTruthy();
        expect(requestCall[0].url).toBe('Composition');
    });

    it('PUTs on subsequent save when Composition ID in sessionStorage', async () => {
        sessionStorageData['smart_composition_p1'] = 'existing-comp-99';

        const client = makeClient({
            request: vi.fn().mockResolvedValue({ id: 'existing-comp-99' }),
        });
        client.patient.read = vi.fn().mockResolvedValue({ id: 'p1' });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.save(args);
        await new Promise(r => setTimeout(r, 50));

        const requestCall = client.request.mock.calls.find(c => c[0] && c[0].method === 'PUT');
        expect(requestCall).toBeTruthy();
        expect(requestCall[0].url).toBe('Composition/existing-comp-99');
    });

    it('shows re-launch message on 401', async () => {
        const err401 = Object.assign(new Error('Unauthorized'), { status: 401 });
        const client = makeClient({
            request: vi.fn().mockRejectedValue(err401),
        });
        client.patient.read = vi.fn().mockResolvedValue({ id: 'p1' });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.save(args);
        await new Promise(r => setTimeout(r, 50));

        const msg = document.getElementById('smart-relaunch-message');
        expect(msg).not.toBeNull();
        msg && msg.remove();
    });
});
