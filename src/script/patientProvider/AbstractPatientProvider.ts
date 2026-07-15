export default abstract class AbstractPatientProvider {
    abstract isConfigured(): boolean;
    abstract canImportClinicalData(): boolean;

    canSearchFamilyMembers(): boolean { return true; }
    canLinkProband(): boolean { return true; }
    canLinkPatient(nodeId: number): boolean {
        return this.isConfigured() && (nodeId === 0 ? this.canLinkProband() : this.canSearchFamilyMembers());
    }

    abstract lookupPatient(patientRef: string, onSuccess: (displayName: string) => void, onError: (reason: string) => void): void;

    abstract openPatientPickerModal(nodeId: number, onSelected: (patientRef: string, details: {firstName: string, lastName?: string, gender?: string, birthDate?: string, lifeStatus?: string}) => void): void;

    abstract openClinicalImportModal(nodeId: number, patientRef: string, onImported: (answers: {linkId: string, value: any}[]) => void): void;
}
