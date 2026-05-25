import Legend from 'pedigree/view/legend';

/**
 * Class responsible for keeping track of HPO terms and their properties, and for
 * caching disorders data as loaded from the terminology.
 * This information is graphically displayed in a 'Legend' box
 *
 * @class PhenotypeLegend
 * @constructor
 */
export default class PhenotypeLegend extends Legend {

  constructor(terminology: any) {
    super('Phenotypes', terminology);
  }

  _getPrefix(id?: any): any {
    return 'hpo';
  }

  /**
   * Retrieve the color associated with the given object
   *
   * @method getObjectColor
   * @param {String|Number} id ID of the object
   * @return {String} CSS color value for that disorder
   */
  getObjectColor(id: any): string {
    return '#CCCCCC';
  }
}
