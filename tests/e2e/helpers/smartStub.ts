import type { Page } from '@playwright/test';

export interface SmartStubOptions {
    patientId?: string;
    scopes?: string;
    patient?: object;
    composition?: object | null;
    rejectReady?: boolean;
    fhirRoutes?: Record<string, object>;
}

export async function stubSmartClient(page: Page, options: SmartStubOptions = {}): Promise<void> {
    const {
        patientId = 'test-patient-1',
        scopes = 'launch openid fhirUser user/Patient.read user/Condition.read patient/Composition.read patient/Composition.write',
        patient = { resourceType: 'Patient', id: patientId, name: [{ use: 'official', given: ['Test'], family: 'Patient' }], gender: 'unknown' },
        composition = null,
        rejectReady = false,
        fhirRoutes = {},
    } = options;

    const tokenResponse = { scope: scopes, access_token: 'stub-token', token_type: 'Bearer' };
    const serverUrl = 'https://stub-fhir.example.com';

    const compositionBundle = composition
        ? { resourceType: 'Bundle', total: 1, entry: [{ resource: composition }] }
        : { resourceType: 'Bundle', total: 0, entry: [] };

    const defaultRoutes: Record<string, object> = {
        [`Patient/${patientId}`]: patient,
        [`Composition?subject=Patient/${patientId}`]: compositionBundle,
        ...fhirRoutes,
    };

    await page.addInitScript(({ serverUrl, tokenResponse, defaultRoutes, rejectReady, patientId, patient }) => {
        // Expose saved POST body so tests can read it for round-trip verification
        (window as any).__smartStubLastPost__ = null;

        const stubClient = {
            getState: (key: string) => key === 'serverUrl' ? serverUrl : null,
            state: { serverUrl, tokenResponse },
            patient: {
                read: () => Promise.resolve(patient),
            },
            request: (urlOrOpts: any) => {
                const url = typeof urlOrOpts === 'string' ? urlOrOpts : urlOrOpts.url;
                const method: string = (urlOrOpts && urlOrOpts.method) || 'GET';
                const cleanUrl = url.replace(serverUrl + '/', '').replace(/^\//, '');

                // Capture POST to Composition — store body and return a created resource
                if (method === 'POST' && cleanUrl === 'Composition') {
                    try {
                        const saved = JSON.parse(urlOrOpts.body || '{}');
                        saved.id = 'stub-saved-comp';
                        (window as any).__smartStubLastPost__ = saved;
                        return Promise.resolve({ resourceType: 'Composition', id: 'stub-saved-comp' });
                    } catch (e) {
                        return Promise.resolve({ resourceType: 'Composition', id: 'stub-saved-comp' });
                    }
                }

                // Capture PUT to Composition/{id}
                if (method === 'PUT' && cleanUrl.startsWith('Composition/')) {
                    try {
                        const saved = JSON.parse(urlOrOpts.body || '{}');
                        (window as any).__smartStubLastPost__ = saved;
                    } catch (e) {}
                    return Promise.resolve({ resourceType: 'Composition', id: cleanUrl.split('/')[1] });
                }

                for (const [pattern, response] of Object.entries(defaultRoutes)) {
                    if (cleanUrl.startsWith(pattern) || cleanUrl === pattern) {
                        return Promise.resolve(response);
                    }
                }
                return Promise.resolve({ resourceType: 'Bundle', total: 0, entry: [] });
            },
        };

        const FHIR = {
            oauth2: {
                ready: () => rejectReady
                    ? Promise.reject(new Error('Stub: OAuth ready rejected'))
                    : Promise.resolve(stubClient),
                authorize: () => {},
            },
        };
        (window as any).FHIR = FHIR;
    }, { serverUrl, tokenResponse, defaultRoutes, rejectReady, patientId, patient });
}
