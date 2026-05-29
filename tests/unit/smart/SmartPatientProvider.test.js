import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SmartPatientProvider from 'pedigree/patientProvider/SmartPatientProvider';

function makeClient(scopes = 'user/Patient.read user/Condition.read') {
    return {
        patient: { read: vi.fn() },
        request: vi.fn(),
        getState: vi.fn(k => k === 'serverUrl' ? 'https://fhir.example.com' : null),
        state: { tokenResponse: { scope: scopes } },
    };
}

describe('SmartPatientProvider — canLinkProband', () => {
    it('always returns false regardless of granted scopes', () => {
        const provider = new SmartPatientProvider(makeClient('launch openid user/Patient.read user/Condition.read'));
        expect(provider.canLinkProband()).toBe(false);
    });

    it('returns false when no client provided', () => {
        const provider = new SmartPatientProvider(null);
        expect(provider.canLinkProband()).toBe(false);
    });
});

describe('SmartPatientProvider — canSearchFamilyMembers', () => {
    it('returns true when user/Patient.read is in granted scopes', () => {
        const provider = new SmartPatientProvider(makeClient('launch openid user/Patient.read'));
        expect(provider.canSearchFamilyMembers()).toBe(true);
    });

    it('returns false when user/Patient.read is absent', () => {
        const provider = new SmartPatientProvider(makeClient('launch openid user/Condition.read'));
        expect(provider.canSearchFamilyMembers()).toBe(false);
    });

    it('returns false when no client provided', () => {
        const provider = new SmartPatientProvider(null);
        expect(provider.canSearchFamilyMembers()).toBe(false);
    });
});

describe('SmartPatientProvider — canImportClinicalData', () => {
    it('returns true when user/Condition.read is in granted scopes', () => {
        const provider = new SmartPatientProvider(makeClient('launch openid user/Condition.read'));
        expect(provider.canImportClinicalData()).toBe(true);
    });

    it('returns false when user/Condition.read is absent', () => {
        const provider = new SmartPatientProvider(makeClient('launch openid user/Patient.read'));
        expect(provider.canImportClinicalData()).toBe(false);
    });

    it('returns false when no client provided', () => {
        const provider = new SmartPatientProvider(null);
        expect(provider.canImportClinicalData()).toBe(false);
    });
});

describe('SmartPatientProvider — prepopulateProband', () => {
    let dispatchedEvents;

    beforeEach(() => {
        dispatchedEvents = [];
        global.window = global.window || {};
        global.window.editor = undefined;
        vi.spyOn(document, 'dispatchEvent').mockImplementation(e => { dispatchedEvents.push(e); });
    });

    afterEach(() => vi.restoreAllMocks());

    it('links patient when proband has no linkedPatientRef', async () => {
        const client = makeClient();
        client.patient.read = vi.fn().mockResolvedValue({
            id: 'p1',
            name: [{ use: 'official', given: ['Jane'], family: 'Smith' }],
            gender: 'female',
        });
        global.window.editor = {
            getView: () => ({ getNode: () => ({ getLinkedPatientRef: () => '' }) }),
        };

        const provider = new SmartPatientProvider(client);
        await provider.prepopulateProband(0);

        expect(dispatchedEvents).toHaveLength(1);
        const detail = dispatchedEvents[0].detail;
        expect(detail.nodeID).toBe(0);
        expect(detail.properties.setLinkedPatientRef).toBe('Patient/p1');
        expect(detail.properties.setFirstName).toBe('Jane');
        expect(detail.properties.setLastName).toBe('Smith');
        expect(detail.properties.setGender).toBe('F');
    });

    it('does not fire event when proband already has a linkedPatientRef', async () => {
        const client = makeClient();
        global.window.editor = {
            getView: () => ({ getNode: () => ({ getLinkedPatientRef: () => 'Patient/existing-99' }) }),
        };

        const provider = new SmartPatientProvider(client);
        await provider.prepopulateProband(0);

        expect(dispatchedEvents).toHaveLength(0);
    });

    it('resolves without throwing when client.patient.read rejects', async () => {
        const client = makeClient();
        client.patient.read = vi.fn().mockRejectedValue(new Error('forbidden'));
        global.window.editor = {
            getView: () => ({ getNode: () => ({ getLinkedPatientRef: () => '' }) }),
        };

        const provider = new SmartPatientProvider(client);
        await expect(provider.prepopulateProband(0)).resolves.toBeUndefined();
        expect(dispatchedEvents).toHaveLength(0);
    });

    it('resolves without throwing when no client provided', async () => {
        const provider = new SmartPatientProvider(null);
        await expect(provider.prepopulateProband(0)).resolves.toBeUndefined();
    });
});
