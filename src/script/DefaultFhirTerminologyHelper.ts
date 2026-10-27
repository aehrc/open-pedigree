import FhirTerminologyHelper from 'pedigree/FhirTerminologyHelper';

// The editor's legend for seeding saved names (see _getCodeFromCodeableConcept), or null outside
// an editor - seeding is optional, so reading a coding never fails for want of one.
function editorLegend(getter: 'getDisorderLegend' | 'getPhenotypeLegend' | 'getGeneLegend'): any {
  const host: any = typeof editor !== 'undefined' ? editor : null;
  return host && typeof host[getter] === 'function' ? host[getter]() : null;
}

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
    // With no code system configured for the legend (e.g. genes by default) there's no valid
    // coding to make, so the code is written as text.
    if (!codeSystem) {
      return { text: code };
    }
    // A term not confirmed by its terminology (its name not loaded, or its lookup failed) is
    // written as text: coding it would claim the legend's code system for a code that may belong
    // to another (e.g. a SNOMED CT code under the HPO terminology). A saved coding's display names
    // its term on load (see _getCodeFromCodeableConcept), so a coded pedigree stays coded.
    if (cachedTerm.isUnknown()) {
      console.log('Unknown term, just use text', cachedTerm);
      return { text: code };
    }
    return { coding: [{ system: codeSystem, code: code, display: cachedTerm.getName() }] };
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

  _getCodeFromCodeableConcept(codeSystem: any, codeableConcept: any, returnNullOnNoMatch: any, getLegend?: () => any): any {
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
          // A saved coding's display names the term straight away, so it doesn't wait on (or
          // depend on) a lookup to be named and exported coded again.
          const legend = coding.display && getLegend ? getLegend() : null;
          if (legend && typeof legend.seedTermName === 'function') {
            legend.seedTermName(coding.code, coding.display);
          }
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
    return this._getCodeFromCodeableConcept(this._disorderCS, codeableConcept, returnNullOnNoMatch, () => editorLegend('getDisorderLegend'));
  }

  getPhenotypeFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return this._getCodeFromCodeableConcept(this._phenotypeCS, codeableConcept, returnNullOnNoMatch, () => editorLegend('getPhenotypeLegend'));
  }

  getGeneFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return this._getCodeFromCodeableConcept(this._geneCS, codeableConcept, returnNullOnNoMatch, () => editorLegend('getGeneLegend'));
  }
}
