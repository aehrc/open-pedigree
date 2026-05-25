import FhirTerminologyHelper from 'pedigree/FhirTerminologyHelper';

export default class DefaultFhirTerminologyHelper extends FhirTerminologyHelper {
  _disorderCS: any;
  _phenotypeCS: any;
  _geneCS: any;

  constructor(
    disorderCS: any = 'http://www.omim.org',
    phenotypeCS: any = 'http://purl.obolibrary.org/obo/hp.fhir',
    geneCS: any = null
  ) {
    super();
    this._disorderCS = disorderCS;
    this._phenotypeCS = phenotypeCS;
    this._geneCS = geneCS;
  }

  _getCodeableConceptFromLegend(code: any, legend: any, codeSystem: any): any {
    const cachedTerm = legend.getTerm(code);
    if (cachedTerm.isUnknown()) {
      console.log('Unknown term, just use text', cachedTerm);
      return { text: code };
    } else {
      return {
        coding: [
          {
            system: codeSystem,
            code: code,
            display: cachedTerm.getName(),
          },
        ],
      };
    }
  }

  getCodeableConceptFromDisorder(disorder: any): any {
    return this._getCodeableConceptFromLegend(disorder, editor.getDisorderLegend(), this._disorderCS);
  }

  getCodeableConceptFromPhenotype(phenotype: any): any {
    return this._getCodeableConceptFromLegend(phenotype, editor.getPhenotypeLegend(), this._phenotypeCS);
  }

  getCodeableConceptFromGene(gene: any): any {
    return this._getCodeableConceptFromLegend(gene, editor.getGeneLegend(), this._geneCS);
  }

  _getCodeFromCodeableConcept(codeSystem: any, codeableConcept: any, returnNullOnNoMatch: any): any {
    let foundCode = false;
    let code = undefined;

    if (codeableConcept.coding) {
      for (const coding of codeableConcept.coding) {
        if (!code && coding.display) {
          code = coding.display;
        }
        if (coding.system && coding.system === codeSystem) {
          code = coding.code;
          foundCode = true;
          break;
        }
      }
    }
    if (!foundCode && codeableConcept.text) {
      code = codeableConcept.text;
    }
    if (!foundCode && returnNullOnNoMatch) {
      return null;
    }
    return code;
  }

  getDisorderFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return this._getCodeFromCodeableConcept(this._disorderCS, codeableConcept, returnNullOnNoMatch);
  }

  getPhenotypeFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return this._getCodeFromCodeableConcept(this._phenotypeCS, codeableConcept, returnNullOnNoMatch);
  }

  getGeneFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return this._getCodeFromCodeableConcept(this._geneCS, codeableConcept, returnNullOnNoMatch);
  }
}
