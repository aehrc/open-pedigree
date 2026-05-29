import AbstractPatientProvider from 'pedigree/patientProvider/AbstractPatientProvider';
import { NativeModal } from 'pedigree/view/nativeModal';

function selectBestName(patient: any): any {
    if (!patient.name || patient.name.length === 0) return null;
    const nameUseOrder = ['official', 'usual', '', 'nickname', 'old', 'maiden', 'temp', 'anonymous'];
    let bestName: any = null;
    let bestScore = -1;
    for (const humanName of patient.name) {
        const score = nameUseOrder.indexOf(humanName.use || '');
        if (score > bestScore) { bestName = humanName; bestScore = score; }
    }
    return bestName || patient.name[0];
}

function extractPatientNameParts(patient: any): { firstName: string, lastName: string } {
    const best = selectBestName(patient);
    if (!best) return { firstName: patient.id || 'Unknown', lastName: '' };
    const firstName = (best.given && best.given.length > 0) ? best.given[0] : (best.text || patient.id || 'Unknown');
    const lastName = best.family || '';
    return { firstName, lastName };
}

function extractPatientDisplayName(patient: any): string {
    const { firstName, lastName } = extractPatientNameParts(patient);
    return lastName ? firstName + ' ' + lastName : firstName;
}

function extractPatientDetails(patient: any): {firstName: string, lastName?: string, gender?: string, birthDate?: string, lifeStatus?: string} {
    const { firstName, lastName } = extractPatientNameParts(patient);
    const details: any = { firstName };
    if (lastName) details.lastName = lastName;
    if (patient.gender === 'male') details.gender = 'M';
    else if (patient.gender === 'female') details.gender = 'F';
    if (patient.birthDate) details.birthDate = patient.birthDate;
    if (patient.deceasedBoolean === true || patient.deceasedDateTime) details.lifeStatus = 'deceased';
    return details;
}

function patientIdFromRef(fhirRef: string): string {
    return fhirRef.startsWith('Patient/') ? fhirRef.slice('Patient/'.length) : fhirRef;
}

export default class FHIRPatientProvider extends AbstractPatientProvider {
    _fhirBaseUrl: string;
    _smartClient: any;

    constructor(options: any) {
        super();
        options = options || {};
        this._smartClient = options.smartClient || null;
        if (this._smartClient) {
            this._fhirBaseUrl = (this._smartClient.getState('serverUrl') || '').replace(/\/$/, '');
        } else {
            this._fhirBaseUrl = (options.fhirBaseUrl || '').replace(/\/$/, '');
        }
    }

    isConfigured(): boolean { return true; }
    canImportClinicalData(): boolean { return true; }

    _request(url: string): Promise<any> {
        if (this._smartClient) {
            return this._smartClient.request(url);
        }
        return fetch(url, { headers: { 'Accept': 'application/fhir+json' } })
            .then(r => { if (!r.ok) throw 'HTTP ' + r.status; return r.json(); });
    }

    lookupPatient(fhirRef: string, onSuccess: (displayName: string) => void, onError: (reason: string) => void): void {
        this._request(this._fhirBaseUrl + '/' + fhirRef)
            .then(patient => onSuccess(extractPatientDisplayName(patient)))
            .catch((e: any) => onError(String(e)));
    }

    openPatientPickerModal(nodeId: number, onSelected: (fhirRef: string, details: {firstName: string, lastName?: string, gender?: string, birthDate?: string, lifeStatus?: string}) => void): void {
        const container = document.createElement('div');
        container.className = 'patient-picker-modal';

        const searchRow = document.createElement('div');
        searchRow.className = 'patient-picker-search-row';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search by name…';
        input.className = 'patient-picker-input';
        const searchBtn = document.createElement('button');
        searchBtn.textContent = 'Search';
        searchBtn.className = 'patient-picker-search-btn';
        searchRow.appendChild(input);
        searchRow.appendChild(searchBtn);

        const results = document.createElement('div');
        results.className = 'patient-picker-results';

        container.appendChild(searchRow);
        container.appendChild(results);

        const modal = new NativeModal(container, { close: { method: () => {} } }, { title: 'Select patient' });
        modal.show();

        const doSearch = () => {
            const query = input.value.trim();
            if (!query) return;
            results.textContent = 'Searching…';
            const url = this._fhirBaseUrl + '/Patient?name=' + encodeURIComponent(query) + '&_count=20';
            this._request(url)
                .then(bundle => {
                    results.innerHTML = '';
                    const entries = bundle.entry || [];
                    if (entries.length === 0) {
                        results.textContent = 'No patients found.';
                        return;
                    }
                    for (const entry of entries) {
                        const patient = entry.resource;
                        if (!patient || patient.resourceType !== 'Patient') continue;
                        const details = extractPatientDetails(patient);
                        const displayName = details.lastName ? details.firstName + ' ' + details.lastName : details.firstName;
                        const row = document.createElement('div');
                        row.className = 'patient-picker-result-row';
                        row.textContent = displayName;
                        row.style.cursor = 'pointer';
                        row.style.padding = '4px 8px';
                        row.addEventListener('mouseenter', () => { row.style.background = '#e8f0fe'; });
                        row.addEventListener('mouseleave', () => { row.style.background = ''; });
                        row.addEventListener('click', () => {
                            modal.closeDialog();
                            onSelected('Patient/' + patient.id, details);
                        });
                        results.appendChild(row);
                    }
                })
                .catch(e => { results.textContent = 'Search failed: ' + e; });
        };

        searchBtn.addEventListener('click', doSearch);
        input.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') doSearch(); });
    }

    openClinicalImportModal(nodeId: number, fhirRef: string, onImported: (disorders: {id: string, name: string}[]) => void): void {
        const patientId = patientIdFromRef(fhirRef);
        const container = document.createElement('div');
        container.className = 'clinical-import-modal';
        container.textContent = 'Loading conditions…';

        const modal = new NativeModal(container, { close: { method: () => {} } }, { title: 'Import from clinical record' });
        modal.show();

        const url = this._fhirBaseUrl + '/Condition?patient=' + encodeURIComponent(patientId) + '&_count=100';
        this._request(url)
            .then(bundle => {
                const entries = bundle.entry || [];
                const disorders: {id: string, name: string, checked: boolean}[] = [];
                for (const entry of entries) {
                    const cond = entry.resource;
                    if (!cond || cond.resourceType !== 'Condition') continue;
                    if (!cond.code || !cond.code.coding || cond.code.coding.length === 0) continue;
                    const coding = cond.code.coding[0];
                    const id = coding.code || '';
                    const name = coding.display || cond.code.text || id;
                    if (id) disorders.push({ id, name, checked: true });
                }

                container.innerHTML = '';

                if (disorders.length === 0) {
                    container.textContent = 'No conditions found for this patient.';
                    return;
                }

                const intro = document.createElement('p');
                intro.textContent = 'Select conditions to import (will be added to existing disorders):';
                container.appendChild(intro);

                const list = document.createElement('div');
                list.className = 'clinical-import-list';
                for (const d of disorders) {
                    const row = document.createElement('label');
                    row.style.display = 'block';
                    row.style.padding = '2px 0';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = d.checked;
                    (cb as any)._disorder = d;
                    row.appendChild(cb);
                    row.appendChild(document.createTextNode(' ' + d.name + ' (' + d.id + ')'));
                    list.appendChild(row);
                }
                container.appendChild(list);

                const importBtn = document.createElement('button');
                importBtn.textContent = 'Import selected';
                importBtn.style.marginTop = '8px';
                importBtn.addEventListener('click', () => {
                    const selected = Array.from(list.querySelectorAll('input[type=checkbox]'))
                        .filter((cb: any) => cb.checked)
                        .map((cb: any) => ({ id: cb._disorder.id, name: cb._disorder.name }));
                    modal.closeDialog();
                    onImported(selected);
                });
                container.appendChild(importBtn);
            })
            .catch(e => { container.textContent = 'Failed to load conditions: ' + e; });
    }
}
