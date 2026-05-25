import AbstractTerm from "pedigree/terminology/abstractTerm";

export var GeneTermType = 'gene';

export default class GeneTerm extends AbstractTerm {
    constructor(id: any, name: any, callWhenReady?: any) {
        super(GeneTermType, id, name, callWhenReady);
    }
}
