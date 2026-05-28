import AbstractPatientProvider from 'pedigree/patientProvider/AbstractPatientProvider';

export default class EmptyPatientProvider extends AbstractPatientProvider {
    isConfigured(): boolean { return false; }
    canImportClinicalData(): boolean { return false; }
    lookupPatient(_fhirRef: string, _onSuccess: (displayName: string) => void, _onError: (reason: string) => void): void {}
    openPatientPickerModal(_nodeId: number, _onSelected: any): void {}
    openClinicalImportModal(_nodeId: number, _fhirRef: string, _onImported: any): void {}
}
