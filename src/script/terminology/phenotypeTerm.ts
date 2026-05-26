import AbstractTerm from "pedigree/terminology/abstractTerm";

export var PhenotypeTermType = 'phenotype';

export default class PhenotypeTerm extends AbstractTerm {
    constructor(id: any, name: any, callWhenReady?: any) {
        super(PhenotypeTermType, id, name, callWhenReady);
    }
}
