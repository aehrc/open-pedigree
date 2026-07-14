import AbstractPatientProvider from 'pedigree/patientProvider/AbstractPatientProvider';
import FHIRPatientProvider from 'pedigree/patientProvider/FHIRPatientProvider';
import EmptyPatientProvider from 'pedigree/patientProvider/EmptyPatientProvider';

function hasScope(client: any, scope: string): boolean {
    const granted: string = (client.state && client.state.tokenResponse && client.state.tokenResponse.scope) || '';
    return granted.split(/\s+/).includes(scope);
}

function extractDisplayName(patient: any): string {
    if (!patient || !patient.name || patient.name.length === 0) return patient && patient.id || 'Unknown';
    const name = patient.name.find((n: any) => n.use === 'official' || n.use === 'usual') || patient.name[0];
    const given = name.given && name.given.length > 0 ? name.given[0] : '';
    const family = name.family || '';
    return (given + (given && family ? ' ' : '') + family).trim() || name.text || patient.id || 'Unknown';
}

export default class SmartPatientProvider extends AbstractPatientProvider {
    _delegate: AbstractPatientProvider;
    _client: any;

    constructor(client: any) {
        super();
        if (!client) {
            console.warn('[SmartPatientProvider] No SMART client provided — falling back to EmptyPatientProvider');
            this._client = null;
            this._delegate = new EmptyPatientProvider();
            return;
        }
        this._client = client;
        this._delegate = new FHIRPatientProvider({ smartClient: client });
    }

    isConfigured(): boolean {
        return this._delegate.isConfigured();
    }

    canImportClinicalData(): boolean {
        if (!this._client) return false;
        return hasScope(this._client, 'user/Condition.read');
    }

    canLinkProband(): boolean { return false; }

    canSearchFamilyMembers(): boolean {
        if (!this._client) return false;
        return hasScope(this._client, 'user/Patient.read');
    }

    lookupPatient(fhirRef: string, onSuccess: (displayName: string) => void, onError: (reason: string) => void): void {
        this._delegate.lookupPatient(fhirRef, onSuccess, onError);
    }

    openPatientPickerModal(nodeId: number, onSelected: (fhirRef: string, details: any) => void): void {
        this._delegate.openPatientPickerModal(nodeId, onSelected);
    }

    openClinicalImportModal(nodeId: number, fhirRef: string, onImported: (disorders: {id: string, name: string}[]) => void): void {
        this._delegate.openClinicalImportModal(nodeId, fhirRef, onImported);
    }

    async prepopulateProband(probandNodeId: number): Promise<void> {
        if (!this._client) return;
        try {
            const node = (window as any).editor && (window as any).editor.getView().getNode(probandNodeId);
            if (node && node.getLinkedPatientRef && node.getLinkedPatientRef()) {
                return;
            }
            const patient = await this._client.patient.read();
            if (!patient || !patient.id) return;
            const fhirRef = 'Patient/' + patient.id;
            const displayName = extractDisplayName(patient);
            const nameParts = displayName.split(' ');
            const firstName = nameParts[0] || displayName;
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
            const properties: any = { setLinkedPatientRef: fhirRef, setFirstName: firstName };
            if (lastName) properties.setLastName = lastName;
            if (patient.gender === 'male') properties.setGender = 'M';
            else if (patient.gender === 'female') properties.setGender = 'F';
            if (patient.birthDate) properties.setBirthDate = patient.birthDate;
            document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', {
                detail: { nodeID: probandNodeId, properties }
            }));
        } catch (e) {
            console.warn('[SmartPatientProvider] prepopulateProband failed:', e);
        }
    }
}
