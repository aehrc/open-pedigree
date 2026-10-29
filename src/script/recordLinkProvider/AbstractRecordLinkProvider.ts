// The node menu's record-link actions (the Linked Record tab's buttons).
export type RecordLinkAction = 'linkRecord' | 'createNewRecord' | 'editRecord';

// One linked record's current state, as fetchLinkedRows answers it: its answers (as openEditor's
// onDone would pass them), or why there are none - the record no longer exists (`missing`), or
// the ref names a record this host won't read from here (`otherRecord`).
export type LinkedRow = { answers?: {linkId: string, value: any}[], missing?: boolean, otherRecord?: boolean };

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

    // onLinked's optional answers are the linked record's values, applied as for onCreated's -
    // without them only the ref is stored, and values arrive with the first openEditor refresh.
    abstract openPicker(nodeId: number, onLinked: (recordRef: string, details?: Record<string, any>, answers?: {linkId: string, value: any}[]) => void): void;

    abstract openEditor(nodeId: number, onDone: (answers: {linkId: string, value: any}[]) => void): void;

    // onCreated's first argument mirrors openPicker's onLinked(recordRef, ...): a brand-new
    // record has its own ref the moment it's created, and the editor needs it immediately to
    // set the node's linkedRecordRef - unlike openEditor's onDone, which edits an
    // already-linked record whose ref the editor already has.
    abstract createNew(nodeId: number, onCreated: (recordRef: string, answers: {linkId: string, value: any}[]) => void): void;

    // Optional: a host-specific button label for one of the record-link actions (e.g. a REDCap
    // host's "Edit in REDCap"), or undefined to keep the editor's generic default. Not abstract,
    // and the editor only calls it if present: this class isn't exported from the bundle, so
    // hosts outside this repo supply a duck-typed provider object. Called when the Questionnaire
    // is parsed (not per node or per menu render), so labels can't depend on the node; a throw
    // is caught and treated as "no label".
    getActionLabel(_action: RecordLinkAction): string | undefined {
        return undefined;
    }

    // Optional, absent by default: several linked records' current state at once, keyed by ref.
    // When present (and isConfigured()), the editor calls it once after opening a pedigree with
    // linked people, to tell the user whose records have changed since the pedigree last took
    // them in (see staleLinkedRows.ts). A ref left out of the answer is unknown, and not reported.
    // Without it, nothing is checked. Duck-typed like getActionLabel.
    fetchLinkedRows?(refs: string[]): Promise<{ [ref: string]: LinkedRow }>;
}
