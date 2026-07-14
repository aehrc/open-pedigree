import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('pedigree/model/export', () => ({
    default: {
        exportAsGA4GH: vi.fn().mockReturnValue(
            '{"resourceType":"Bundle","type":"document","entry":[{"fullUrl":"urn:uuid:comp-1","resource":{"resourceType":"Composition","id":"comp-1","section":[],"author":[]}}]}'
        )
    }
}));

import SmartFhirBackend, { bundleToContainedComposition } from 'pedigree/SmartFhirBackend';

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

describe('SmartFhirBackend.load — 401 handling', () => {
    beforeEach(() => {
        global.window = global.window || {};
        global.window.editor = undefined;
    });

    afterEach(() => vi.restoreAllMocks());

    it('shows re-launch message on 401 during load', async () => {
        const err401 = Object.assign(new Error('Unauthorized'), { status: 401 });
        const client = makeClient({ request: vi.fn().mockRejectedValue(err401) });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.load(args);
        await new Promise(r => setTimeout(r, 20));

        const msg = document.getElementById('smart-relaunch-message');
        expect(msg).not.toBeNull();
        expect(args.onFailure).not.toHaveBeenCalled();
        msg && msg.remove();
    });

    it('calls onFailure (not relaunch) on non-401 load error', async () => {
        const err = new Error('network fail');
        const client = makeClient({ request: vi.fn().mockRejectedValue(err) });
        const backend = new SmartFhirBackend(client);
        const args = makeArgs();

        backend.load(args);
        await new Promise(r => setTimeout(r, 20));

        expect(args.onFailure).toHaveBeenCalled();
        expect(document.getElementById('smart-relaunch-message')).toBeNull();
    });
});

describe('bundleToContainedComposition', () => {
    const PATIENT_ID = 'test-patient';

    const makeBundle = (extra = {}) => ({
        resourceType: 'Bundle',
        type: 'document',
        entry: [
            {
                fullUrl: 'urn:uuid:comp-1',
                resource: {
                    resourceType: 'Composition',
                    id: 'comp-1',
                    section: [
                        { entry: [{ reference: 'urn:uuid:pat-1' }, { reference: 'urn:uuid:fmh-1' }] }
                    ],
                    author: [],
                    subject: {}
                }
            },
            {
                fullUrl: 'urn:uuid:pat-1',
                resource: { resourceType: 'Patient', id: 'ind-proband' }
            },
            {
                fullUrl: 'urn:uuid:fmh-1',
                resource: { resourceType: 'FamilyMemberHistory', id: 'fmh-father' }
            },
            ...(extra.entries || [])
        ]
    });

    it('extracts Composition and wraps other resources as contained', () => {
        const result = bundleToContainedComposition(makeBundle(), PATIENT_ID);
        expect(result.resourceType).toBe('Composition');
        expect(result.contained).toHaveLength(2);
        expect(result.contained.map((r) => r.resourceType).sort()).toEqual(['FamilyMemberHistory', 'Patient']);
    });

    it('rewrites section entry references to #id form', () => {
        const result = bundleToContainedComposition(makeBundle(), PATIENT_ID);
        const refs = result.section[0].entry.map((e) => e.reference);
        expect(refs).toEqual(['#ind-proband', '#fmh-father']);
    });

    it('sets subject and author from patientId', () => {
        const result = bundleToContainedComposition(makeBundle(), PATIENT_ID);
        expect(result.subject).toEqual({ reference: 'Patient/' + PATIENT_ID });
        expect(result.author).toEqual([{ display: 'Open Pedigree' }]);
    });

    it('also rewrites ResourceType/id style references', () => {
        const bundle = makeBundle();
        bundle.entry[0].resource.section[0].entry[0].reference = 'Patient/ind-proband';
        const result = bundleToContainedComposition(bundle, PATIENT_ID);
        expect(result.section[0].entry[0].reference).toBe('#ind-proband');
    });

    it('throws when no Composition entry in bundle', () => {
        const bundle = { resourceType: 'Bundle', entry: [
            { fullUrl: 'urn:uuid:pat-1', resource: { resourceType: 'Patient', id: 'p1' } }
        ]};
        expect(() => bundleToContainedComposition(bundle, PATIENT_ID)).toThrow('No Composition found');
    });

    it('assigns fallback id to resources without an id', () => {
        const bundle = makeBundle();
        delete bundle.entry[1].resource.id;
        const result = bundleToContainedComposition(bundle, PATIENT_ID);
        const patient = result.contained.find((r) => r.resourceType === 'Patient');
        expect(patient.id).toMatch(/^contained-/);
    });
});
