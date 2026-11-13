import Raphael from 'pedigree/raphael';
import Legend from 'pedigree/view/legend';
import { isLoadingName } from 'pedigree/terminology/loadingName';

/**
 * Class responsible for keeping track of candidate genes.
 * This information is graphically displayed in a 'Legend' box.
 *
 * @class GeneLegend
 * @constructor
 */
export default class GeneLegend extends Legend {

  constructor(terminology: any) {
    super('Candidate Genes', terminology, 'gene');
  }

  // How a gene is named beside its result: its terminology name, or its ID while that is loading.
  // (from the terms already known, without creating one: creating a term can call back into this)
  displayName(id: any): string {
    const term = this._cache[this.sanitizeID(id)];
    const name = term && term.getName ? term.getName() : null;
    return typeof name === 'string' && name && !isLoadingName(name) ? name : this.desanitizeID(id);
  }

  // A gene's name has arrived: its people's result lines show it too (PersonVisuals.updateGeneResultsLabel).
  _updateTermName(id: any): void {
    super._updateTermName(id);
    var view = editor.getView && editor.getView();
    (this._affectedNodes[id] || []).forEach(function(nodeID: any) {
      var node = view && view.getNode(nodeID);
      var graphics = node && node.getGraphics && node.getGraphics();
      if (graphics && typeof graphics.updateGeneResultsLabel === 'function') {
        graphics.updateGeneResultsLabel();
      }
    });
    var menu = editor.getNodeMenu && editor.getNodeMenu();
    if (menu && typeof menu.refreshGeneName === 'function') {
      menu.refreshGeneName(this.desanitizeID(id), this.displayName(id));
    }
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
