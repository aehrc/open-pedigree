import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FHIRPatientProvider from 'pedigree/patientProvider/FHIRPatientProvider';

function makeSmartClient(serverUrl = 'https://fhir.example.com') {
    return {
        getState: vi.fn(k => k === 'serverUrl' ? serverUrl : null),
        request: vi.fn().mockResolvedValue({ entry: [] }),
    };
}

describe('FHIRPatientProvider with smartClient', () => {
    afterEach(() => vi.restoreAllMocks());

    it('derives fhirBaseUrl from smartClient.getState("serverUrl")', () => {
        const smartClient = makeSmartClient('https://ehr.example.com/fhir');
        const provider = new FHIRPatientProvider({ smartClient });
        expect(provider._fhirBaseUrl).toBe('https://ehr.example.com/fhir');
    });

    it('routes lookupPatient through smartClient.request', async () => {
        const patient = { id: 'p1', name: [{ use: 'official', given: ['Jane'], family: 'Smith' }] };
        const smartClient = makeSmartClient();
        smartClient.request = vi.fn().mockResolvedValue(patient);

        const provider = new FHIRPatientProvider({ smartClient });
        const onSuccess = vi.fn();
        provider.lookupPatient('Patient/p1', onSuccess, vi.fn());
        await new Promise(r => setTimeout(r, 20));

        expect(smartClient.request).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining('Jane'));
    });

    it('does not call fetch when smartClient is provided', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch');
        const smartClient = makeSmartClient();
        smartClient.request = vi.fn().mockResolvedValue({ id: 'p1', name: [] });

        const provider = new FHIRPatientProvider({ smartClient });
        provider.lookupPatient('Patient/p1', vi.fn(), vi.fn());
        await new Promise(r => setTimeout(r, 20));

        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('FHIRPatientProvider with fhirBaseUrl (no regression)', () => {
    afterEach(() => vi.restoreAllMocks());

    it('uses fetch when only fhirBaseUrl provided', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: 'p1', name: [{ given: ['Bob'] }] }),
        });

        const provider = new FHIRPatientProvider({ fhirBaseUrl: 'https://fhir.example.com' });
        provider.lookupPatient('Patient/p1', vi.fn(), vi.fn());
        await new Promise(r => setTimeout(r, 20));

        expect(fetchSpy).toHaveBeenCalled();
    });

    it('stores fhirBaseUrl from options directly', () => {
        const provider = new FHIRPatientProvider({ fhirBaseUrl: 'https://fhir.example.com/r4' });
        expect(provider._fhirBaseUrl).toBe('https://fhir.example.com/r4');
    });
});
