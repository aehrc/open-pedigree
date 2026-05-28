export default abstract class AbstractPatientProvider {
    abstract isConfigured(): boolean;
    abstract canImportClinicalData(): boolean;

    abstract lookupPatient(fhirRef: string, onSuccess: (displayName: string) => void, onError: (reason: string) => void): void;

    abstract openPatientPickerModal(nodeId: number, onSelected: (fhirRef: string, details: {firstName: string, lastName?: string, gender?: string, birthDate?: string, lifeStatus?: string}) => void): void;

    abstract openClinicalImportModal(nodeId: number, fhirRef: string, onImported: (disorders: {id: string, name: string}[]) => void): void;
}
