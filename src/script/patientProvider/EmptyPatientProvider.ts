import AbstractPatientProvider from 'pedigree/patientProvider/AbstractPatientProvider';

export default class EmptyPatientProvider extends AbstractPatientProvider {
    isConfigured(): boolean { return false; }
    canImportClinicalData(): boolean { return false; }
    lookupPatient(_patientRef: string, _onSuccess: (displayName: string) => void, _onError: (reason: string) => void): void {}
    openPatientPickerModal(_nodeId: number, _onSelected: any): void {}
    openClinicalImportModal(_nodeId: number, _patientRef: string, _onImported: any): void {}
}
