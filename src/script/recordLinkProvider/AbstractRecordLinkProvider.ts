export default abstract class AbstractRecordLinkProvider {
    abstract isConfigured(): boolean;
    abstract canLink(nodeId: number): boolean;
    abstract canCreateNew(nodeId: number): boolean;

    abstract openPicker(nodeId: number, onLinked: (recordRef: string, details?: Record<string, any>) => void): void;

    abstract openEditor(nodeId: number, onDone: (answers: {linkId: string, value: any}[]) => void): void;

    abstract createNew(nodeId: number, onCreated: (answers: {linkId: string, value: any}[]) => void): void;
}
