import PedigreeExport from 'pedigree/model/export';

const GA4GH_PEDIGREE_PROFILE = 'http://purl.org/ga4gh/pedigree-fhir-ig/StructureDefinition/Pedigree';
const SESSION_KEY_PREFIX = 'smart_composition_';

export function bundleToContainedComposition(bundle: any, patientId: string): any {
    const compositionEntry = (bundle.entry || []).find(
        (e: any) => e.resource && e.resource.resourceType === 'Composition'
    );
    if (!compositionEntry) throw new Error('No Composition found in GA4GH Bundle');

    const composition = JSON.parse(JSON.stringify(compositionEntry.resource));

    // Build map from urn:uuid fullUrl → resource (excluding the Composition itself)
    const urlToResource: Record<string, any> = {};
    for (const entry of bundle.entry || []) {
        if (entry.fullUrl && entry.resource && entry.resource.resourceType !== 'Composition') {
            urlToResource[entry.fullUrl] = entry.resource;
        }
    }

    // Assign stable IDs to each referenced resource and collect as contained
    const urlToId: Record<string, string> = {};
    const contained: any[] = [];
    let counter = 1;
    for (const [url, resource] of Object.entries(urlToResource)) {
        const id = (resource as any).id || `contained-${counter++}`;
        contained.push({ ...(resource as any), id });
        urlToId[url] = id;
        // Also map "ResourceType/id" → id so section entries like "Patient/ind-father"
        // get rewritten to "#ind-father" even when the Bundle fullUrl is just "ind-father"
        if ((resource as any).resourceType && id) {
            urlToId[(resource as any).resourceType + '/' + id] = id;
        }
    }

    // Rewrite references in section.entry to #id (contained references)
    const rewriteRef = (ref: string) => urlToId[ref] ? '#' + urlToId[ref] : ref;
    for (const section of composition.section || []) {
        for (const entry of section.entry || []) {
            if (entry.reference) entry.reference = rewriteRef(entry.reference);
        }
    }

    composition.contained = contained;
    composition.author = [{ display: 'Open Pedigree' }];
    composition.subject = { reference: 'Patient/' + patientId };
    return composition;
}

export default class SmartFhirBackend {
    _client: any;
    _patientId: string;

    constructor(client: any) {
        this._client = client;
        this._patientId = '';
    }

    _sessionKey(): string {
        return SESSION_KEY_PREFIX + this._patientId;
    }

    _storedCompositionId(): string | null {
        return sessionStorage.getItem(this._sessionKey());
    }

    _storeCompositionId(id: string): void {
        sessionStorage.setItem(this._sessionKey(), id);
    }

    async _resolvePatientId(): Promise<string> {
        if (this._patientId) return this._patientId;
        const patient = await this._client.patient.read();
        this._patientId = patient.id;
        return this._patientId;
    }

    save(args: any): void {
        const me = this;
        args.setSaveInProgress(true);

        Promise.resolve()
            .then(() => me._resolvePatientId())
            .then(patientId => {
                const svg = args.svgData || null;
                const ga4ghResult = PedigreeExport.exportAsGA4GH(
                    (window as any).editor.getGraph().DG, 'all', 'Patient/' + patientId, svg
                );

                // Convert Bundle → Composition with contained resources + fix subject/author
                const parsed = typeof ga4ghResult === 'string' ? JSON.parse(ga4ghResult) : ga4ghResult;
                const composition = parsed.resourceType === 'Bundle'
                    ? bundleToContainedComposition(parsed, patientId)
                    : parsed;
                if (!composition || composition.resourceType !== 'Composition') {
                    throw new Error('GA4GH export did not produce a Composition resource');
                }

                const existingId = me._storedCompositionId();

                if (existingId) {
                    composition.id = existingId;
                    return me._client.request({
                        url: 'Composition/' + existingId,
                        method: 'PUT',
                        body: JSON.stringify(composition),
                        headers: { 'Content-Type': 'application/fhir+json' }
                    });
                } else {
                    return me._client.request({
                        url: 'Composition',
                        method: 'POST',
                        body: JSON.stringify(composition),
                        headers: { 'Content-Type': 'application/fhir+json' }
                    }).then((result: any) => {
                        const id = result && result.id;
                        if (id) me._storeCompositionId(id);
                        return result;
                    });
                }
            })
            .catch((err: any) => {
                const status = err && (err.status || (err.response && err.response.status));
                if (status === 401) {
                    me._showRelaunchMessage();
                } else {
                    console.error('[SmartFhirBackend] save error:', err);
                    alert('Error saving pedigree. Please try again.');
                }
            })
            .finally(() => {
                args.setSaveInProgress(false);
            });
    }

    load(args: any): void {
        const me = this;

        me._resolvePatientId()
            .then(patientId => {
                const url = 'Composition?subject=Patient/' + encodeURIComponent(patientId)
                    + '&_profile=' + encodeURIComponent(GA4GH_PEDIGREE_PROFILE)
                    + '&_sort=-date&_count=1';
                return me._client.request(url);
            })
            .then((bundle: any) => {
                const entries = bundle && bundle.entry;
                if (!entries || entries.length === 0) {
                    args.onFailure();
                    return;
                }
                const composition = entries[0].resource;
                if (composition && composition.id) {
                    me._storeCompositionId(composition.id);
                }
                const jsonData = JSON.stringify(composition);
                const sle = (window as any).editor && (window as any).editor.getSaveLoadEngine();
                if (sle && sle.createGraphFromImportData) {
                    sle.createGraphFromImportData(jsonData, 'GA4GH', {}, false, true);
                } else {
                    args.onSuccess(jsonData);
                }
            })
            .catch((err: any) => {
                const status = err && (err.status || (err.response && err.response.status));
                if (status === 401) {
                    me._showRelaunchMessage();
                } else {
                    console.error('[SmartFhirBackend] load error:', err);
                    args.onFailure();
                }
            });
    }

    _showRelaunchMessage(): void {
        const existing = document.getElementById('smart-relaunch-message');
        if (existing) return;
        const msg = document.createElement('div');
        msg.id = 'smart-relaunch-message';
        msg.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:200000;background:#b00020;color:#fff;'
            + 'padding:12px 16px;font-size:14px;text-align:center;';
        msg.textContent = 'Your session has expired. Please re-launch the application from the EHR.';
        document.body.appendChild(msg);
    }
}
