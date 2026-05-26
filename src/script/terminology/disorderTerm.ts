import AbstractTerm from "pedigree/terminology/abstractTerm";

export var DisorderTermType = 'disorder';

export default class DisorderTerm extends AbstractTerm {
    constructor(id: any, name: any, callWhenReady?: any) {
        super(DisorderTermType, id, name, callWhenReady);
    }
}
