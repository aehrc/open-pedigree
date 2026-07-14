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
    super('Phenotypes', terminology, 'hpo');
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

  /**
   * Phenotypes have always used a fixed grey swatch, never a per-value assigned colour -
   * opt out of the base class's generic colour assignment/dispatch entirely.
   *
   * @method _ensureColorAssigned
   */
  _ensureColorAssigned(id: any): void {
    // no-op
  }
}
