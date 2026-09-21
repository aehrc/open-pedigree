// All nodeId-taking methods deliberately stay nodeId-only (no separate recordRef parameter),
// including openEditor - a node's linked recordRef (set via openPicker's onLinked, or by
// createNew's caller) is retrievable by any method's implementation via
// `(window as any).editor.getView().getNode(nodeId).getLinkedRecordRef()`, the same pattern
// SmartPatientProvider already uses to read node state from inside a concrete provider. See
// record-link-provider design.md's D2 note for the full reasoning.
export default abstract class AbstractRecordLinkProvider {
    abstract isConfigured(): boolean;
    abstract canLink(nodeId: number): boolean;
    abstract canCreateNew(nodeId: number): boolean;

    abstract openPicker(nodeId: number, onLinked: (recordRef: string, details?: Record<string, any>) => void): void;

    abstract openEditor(nodeId: number, onDone: (answers: {linkId: string, value: any}[]) => void): void;

    abstract createNew(nodeId: number, onCreated: (answers: {linkId: string, value: any}[]) => void): void;
}
