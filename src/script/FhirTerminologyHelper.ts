export default class FhirTerminologyHelper {
  constructor() {}

  getCodeableConceptFromDisorder(disorder: any): any {
    return null;
  }

  getCodeableConceptFromPhenotype(phenotype: any): any {
    return null;
  }

  getCodeableConceptFromGene(gene: any): any {
    return null;
  }

  getDisorderFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return null;
  }

  getPhenotypeFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return null;
  }

  getGeneFromCodeableConcept(codeableConcept: any, returnNullOnNoMatch: any): any {
    return null;
  }

  /**
   * A copy of a CodeableConcept read for a disorder, phenotype or gene, if it's coded only in
   * systems other than that legend's (e.g. saved under an earlier Default Terminology): the person
   * keeps it, and the term is written back with it rather than as text. Otherwise null.
   */
  codingToKeep(legend: 'disorder' | 'phenotype' | 'gene', codeableConcept: any): any {
    return null;
  }

  /** The code system phenotypes are coded in, or null if none. */
  getPhenotypeSystem(): any {
    return null;
  }

  /** The code system genes are coded in, or null if none. */
  getGeneSystem(): any {
    return null;
  }
}
