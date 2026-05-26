import Raphael from 'pedigree/raphael';
import Legend from 'pedigree/view/legend';
import TerminologyManager from 'pedigree/terminology/terminologyManger';
import GeneTerm, {GeneTermType} from 'pedigree/terminology/geneTerm';

/**
 * Class responsible for keeping track of candidate genes.
 * This information is graphically displayed in a 'Legend' box.
 *
 * @class GeneLegend
 * @constructor
 */
export default class GeneLegend extends Legend {
    _termCache: any;

    constructor() {
        super('Candidate Genes');

        this._termCache = {};
    }

    _getPrefix(id?: any): any {
        return 'gene';
    }

    /**
     * Returns the HPOTerm object with the given ID. If object is not in cache yet
     * returns a newly created one which may have the term name & other attributes not loaded yet
     *
     * @method getTerm
     * @return {GeneTerm}
     */
    getTerm(geneID: any): any {
        geneID = TerminologyManager.sanitizeID(GeneTermType, geneID);
        if (!this._termCache.hasOwnProperty(geneID)) {
            var whenNameIsLoaded = function(this: any) {
                this._updateTermName(geneID);
            };
            this._termCache[geneID] = new GeneTerm(geneID, null, whenNameIsLoaded.bind(this));
        }
        return this._termCache[geneID];
    }

    /**
     * Updates the displayed phenotype name for the given phenotype
     *
     * @method _updateTermName
     * @param {Number} id The identifier of the gene to update
     * @private
     */
    _updateTermName(id: any): any {
        var name = this._legendBox.querySelector('li#' + this._getPrefix() + '-' + id + ' .disorder-name');
        name.textContent = this.getTerm(id).getName();
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
            var color = this._generateColor(geneID);
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
    _generateColor(geneID: any): any {
        if(this._objectColors.hasOwnProperty(geneID)) {
            return this._objectColors[geneID];
        }

        var usedColors = Object.values(this._objectColors) as any[],
            // green palette
            prefColors = ['#81a270', '#c4e8c4', '#56a270', '#b3b16f', '#4a775a', '#65caa3'];
        usedColors.forEach(function(color: any) {
            prefColors = prefColors.filter((c: any) => c !== color);
        });
        if(prefColors.length > 0) {
            return prefColors[0];
        } else {
            var randomColor = Raphael.getColor();
            while(randomColor == '#ffffff' || usedColors.indexOf(randomColor) != -1) {
                randomColor = '#'+((1<<24)*Math.random()|0).toString(16);
            }
            return randomColor;
        }
    }

    /**
     * Registers an occurrence of a phenotype.
     *
     * @method addCase
     * @param {Number|String} id ID for this term taken from the HPO database
     * @param {String} name The description of the phenotype
     * @param {Number} nodeID ID of the Person who has this phenotype
     */
    addCase(id: any, name: any, nodeID: any): any {
        if (!this._termCache.hasOwnProperty(id)) {
            this._termCache[id] = new GeneTerm(id, name);
        }

        super.addCase(id, name, nodeID);
    }

    addToCache(id: any, name: any): any {
        if (!this._termCache.hasOwnProperty(id)) {
            console.log('Adding to cache ' + id + '=>' + name);
            this._termCache[id] = new GeneTerm(id, name);
        }
        else {
            console.log(this._termCache[id]);
        }
    }

    getCurrentGenes(): any {
        var currentGenes = [] as any[];
        for (var id in this._affectedNodes){
            currentGenes.push(this.getTerm(id)); /* this could turn into a code/value Term */
        }
        return currentGenes;
    }
}
