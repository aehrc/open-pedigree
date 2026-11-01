import { isLoadingName } from 'pedigree/terminology/loadingName';
import FhirTerminologyHelper from 'pedigree/FhirTerminologyHelper';

// The editor's legend for seeding saved names (see _getCodeFromCodeableConcept), or null outside
// an editor - seeding is optional, so reading a coding never fails for want of one.
function editorLegend(getter: 'getDisorderLegend' | 'getPhenotypeLegend' | 'getGeneLegend'): any {
  const host: any = typeof editor !== 'undefined' ? editor : null;
  return host && typeof host[getter] === 'function' ? host[getter]() : null;
}

type LegendKind = 'disorder' | 'phenotype' | 'gene';

// The codings a CodeableConcept carries, as a comparable key: which concept it is, whatever its
// display or text says.
function codingsKey(codeableConcept: any): string {
  return (codeableConcept.coding || []).map((c: any) => c.system + '|' + c.code).sort().join('\n');
}

export default class DefaultFhirTerminologyHelper extends FhirTerminologyHelper {
  _disorderCS: any;
  _phenotypeCS: any;
  _geneCS: any;
  // Codings read in a code system other than their legend's (e.g. saved under an earlier Default
  // Terminology), by legend and the id the term is shown by, so they're written back as read rather
  // than as text. null marks an id two different codings were read under: written as text.
  _foreignCodings: Record<LegendKind, Map<string, any>> = { disorder: new Map(), phenotype: new Map(), gene: new Map() };

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

  _getCodeableConceptFromLegend(code: any, legend: any, codeSystem: any, kind?: LegendKind): any {
    const foreign = kind ? this._foreignCodings[kind].get(code) : undefined;
    if (foreign) {
      return JSON.parse(JSON.stringify(foreign));
    }
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
    return this._getCodeableConceptFromLegend(disorder, editor.getDisorderLegend(), this._disorderCS, 'disorder');
  }

  getCodeableConceptFromPhenotype(phenotype: any): any {
    return this._getCodeableConceptFromLegend(phenotype, editor.getPhenotypeLegend(), this._phenotypeCS, 'phenotype');
  }

  getCodeableConceptFromGene(gene: any): any {
    return this._getCodeableConceptFromLegend(gene, editor.getGeneLegend(), this._geneCS, 'gene');
  }

  // Remembers a coding read in another code system under the id it's shown by (see _foreignCodings).
  _rememberForeignCoding(kind: LegendKind, id: string, codeableConcept: any): void {
    const known = this._foreignCodings[kind];
    if (!known.has(id)) {
      known.set(id, JSON.parse(JSON.stringify(codeableConcept)));
    } else if (known.get(id) !== null && codingsKey(known.get(id)) !== codingsKey(codeableConcept)) {
      console.warn('Two different codings are shown as "' + id + '"; writing it as text', known.get(id), codeableConcept);
      known.set(id, null);
    }
  }

  _getCodeFromCodeableConcept(codeSystem: any, codeableConcept: any, returnNullOnNoMatch: any, getLegend?: () => any, kind?: LegendKind): any {
    let foundCode = false;
    let code = undefined;

    if (codeableConcept.coding) {
      for (const coding of codeableConcept.coding) {
        // a coding in another system is read by its display - unless that's the placeholder an
        // older editor saved for a term it was still looking up, when the code is all there is
        if (!code && coding.display) {
          code = isLoadingName(coding.display) ? coding.code : coding.display;
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
    // another system's coding with no display (and no text): shown by its code, which is kept with
    // its own system (below), so it isn't written back under the legend's
    if (!foundCode && code === undefined && codeableConcept.coding) {
      code = codeableConcept.coding.find((c: any) => c.code)?.code;
    }
    if (!foundCode && returnNullOnNoMatch) {
      return null;
    }
    if (!foundCode && code !== undefined && kind && codingsKey(codeableConcept) !== '') {
      this._rememberForeignCoding(kind, code, codeableConcept);
    }
    return code;
  }


  getDisorderFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return this._getCodeFromCodeableConcept(this._disorderCS, codeableConcept, returnNullOnNoMatch, () => editorLegend('getDisorderLegend'), 'disorder');
  }

  getPhenotypeFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return this._getCodeFromCodeableConcept(this._phenotypeCS, codeableConcept, returnNullOnNoMatch, () => editorLegend('getPhenotypeLegend'), 'phenotype');
  }

  getPhenotypeSystem(): any {
    return this._phenotypeCS;
  }

  getGeneSystem(): any {
    return this._geneCS;
  }

  getGeneFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return this._getCodeFromCodeableConcept(this._geneCS, codeableConcept, returnNullOnNoMatch, () => editorLegend('getGeneLegend'), 'gene');
  }
}
