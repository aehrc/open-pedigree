import AbstractRecordLinkProvider from 'pedigree/recordLinkProvider/AbstractRecordLinkProvider';

export default class EmptyRecordLinkProvider extends AbstractRecordLinkProvider {
    isConfigured(): boolean { return false; }
    canLink(_nodeId: number): boolean { return false; }
    canCreateNew(_nodeId: number): boolean { return false; }
    openPicker(_nodeId: number, _onLinked: any): void {}
    openEditor(_nodeId: number, _onDone: any): void {}
    createNew(_nodeId: number, _onCreated: any): void {}
}
