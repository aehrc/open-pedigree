import Raphael from 'pedigree/raphael';
import Legend from 'pedigree/view/legend';

/**
 * Class responsible for keeping track of candidate genes.
 * This information is graphically displayed in a 'Legend' box.
 *
 * @class GeneLegend
 * @constructor
 */
export default class GeneLegend extends Legend {

  constructor(terminology: any) {
    super('Candidate Genes', terminology);
  }

  _getPrefix(id?: any): any {
    return 'gene';
  }

  /**
   * Generate the element that will display information about the given disorder in the legend
   *
   * @method _generateElement
   * @param {String} geneID The id for the gene
   * @param {String} name The human-readable gene description
   * @return {HTMLLIElement} List element to be insert in the legend
   */
  _generateElement(geneID: any, name: any): any {
    if (!this._objectColors.hasOwnProperty(geneID)) {
      const color = this._generateColor(geneID);
      this._objectColors[geneID] = color;
      document.dispatchEvent(new CustomEvent('gene:color', { detail: {'id' : geneID, color: color} }));
    }

    return super._generateElement(geneID, name);
  }

  /**
   * Generates a CSS color.
   * Has preference for some predefined colors that can be distinguished in gray-scale
   * and are distint from disorder colors.
   *
   * @method generateColor
   * @return {String} CSS color
   */
  _generateColor(geneID: any): string {
    if(this._objectColors.hasOwnProperty(geneID)) {
      return this._objectColors[geneID];
    }

    let usedColors = Object.values(this._objectColors),
      // green palette
      prefColors: any[] = ['#81a270', '#c4e8c4', '#56a270', '#b3b16f', '#4a775a', '#65caa3'];
    usedColors.forEach( function(color: any) {
      prefColors = prefColors.filter((c: any) => c !== color);
    });
    if(prefColors.length > 0) {
      return prefColors[0];
    } else {
      let randomColor = Raphael.getColor();
      while(randomColor === '#ffffff' || usedColors.indexOf(randomColor) !== -1) {
        randomColor = '#'+((1<<24)*Math.random()|0).toString(16);
      }
      return randomColor;
    }
  }
}
