import Raphael from 'pedigree/raphael';
import Legend from 'pedigree/view/legend';
import DisorderTerm, {DisorderTermType} from 'pedigree/terminology/disorderTerm';
import TerminologyManager from 'pedigree/terminology/terminologyManger';

/**
 * Class responsible for keeping track of disorders and their properties, and for
 * caching disorders data as loaded from the OMIM database.
 * This information is graphically displayed in a 'Legend' box.
 *
 * @class DisorderLegend
 * @constructor
 */
export default class DisorderLegend extends Legend {
    _disorderCache: any;
    _specialDisordersRegexps: any;

    constructor() {
        super('Disorders');

        this._disorderCache = {};

        this._specialDisordersRegexps = [new RegExp('^1BrCa', 'i'),
            new RegExp('^2BrCa', 'i'),
            new RegExp('^OvCa',  'i'),
            new RegExp('^ProCa', 'i'),
            new RegExp('^PanCa', 'i') ];
    }

    _getPrefix(id?: any): any {
        return 'disorder';
    }

    /**
     * Returns the disorder object with the given ID. If object is not in cache yet
     * returns a newly created one which may have the disorder name & other attributes not loaded yet
     *
     * @method getTerm
     * @return {Object}
     */
    getTerm(disorderID: any): any {
        disorderID = TerminologyManager.sanitizeID(DisorderTermType, disorderID);
        if (!this._disorderCache.hasOwnProperty(disorderID)) {
            var whenNameIsLoaded = function(this: any) {
                this._updateDisorderName(disorderID);
            };
            this._disorderCache[disorderID] = new DisorderTerm(disorderID, null, whenNameIsLoaded.bind(this));
        }
        return this._disorderCache[disorderID];
    }

    /**
     * Registers an occurrence of a disorder. If disorder hasn't been documented yet,
     * designates a color for it.
     *
     * @method addCase
     * @param {Number|String} disorderID ID for this disorder taken from the OMIM database
     * @param {String} disorderName The name of the disorder
     * @param {Number} nodeID ID of the Person who has this disorder
     */
    addCase(disorderID: any, disorderName: any, nodeID: any): any {
        if (!this._disorderCache.hasOwnProperty(disorderID)) {
            this._disorderCache[disorderID] = new DisorderTerm(disorderID, disorderName);
        }

        super.addCase(disorderID, disorderName, nodeID);
    }

    addToCache(id: any, name: any): any {
        if (!this._disorderCache.hasOwnProperty(id)) {
            this._disorderCache[id] = new DisorderTerm(id, name);
        }
    }

    /**
     * Updates the displayed disorder name for the given disorder
     *
     * @method _updateDisorderName
     * @param {Number} disorderID The identifier of the disorder to update
     * @private
     */
    _updateDisorderName(disorderID: any): any {
        var name = this._legendBox.down('li#' + this._getPrefix() + '-' + disorderID + ' .disorder-name');
        name.update(this.getTerm(disorderID).getName());
    }

    /**
     * Generate the element that will display information about the given disorder in the legend
     *
     * @method _generateElement
     * @param {Number} disorderID The id for the disorder, taken from the OMIM database
     * @param {String} name The human-readable disorder name
     * @return {HTMLLIElement} List element to be insert in the legend
     */
    _generateElement(disorderID: any, name: any): any {
        if (!this._objectColors.hasOwnProperty(disorderID)) {
            var color = this._generateColor(disorderID);
            this._objectColors[disorderID] = color;
            document.fire('disorder:color', {'id' : disorderID, color: color});
        }

        return super._generateElement(disorderID, name);
    }

    /**
     * Generates a CSS color.
     * Has preference for some predefined colors that can be distinguished in gray-scale
     * and are distint from gene colors.
     *
     * @method generateColor
     * @return {String} CSS color
     */
    _generateColor(disorderID: any): any {
        if(this._objectColors.hasOwnProperty(disorderID)) {
            return this._objectColors[disorderID];
        }

        // check special disorder prefixes
        for (var i = 0; i < this._specialDisordersRegexps.length; i++) {
            if (disorderID.match(this._specialDisordersRegexps[i]) !== null) {
                for (var disorder in this._objectColors) {
                    if (this._objectColors.hasOwnProperty(disorder)) {
                        if (disorder.match(this._specialDisordersRegexps[i]) !== null) {
                            return this._objectColors[disorder];
                        }
                    }
                }
                break;
            }
        }

        var usedColors = Object.values(this._objectColors) as any[],
            prefColors = ['#E0F8F8', '#92c0db', '#4575B4', '#949ab8', '#FEE090', '#bf6632', '#fca860', '#9a4500', '#d12943', '#00a2bf'];
        usedColors.forEach(function(color: any) {
            prefColors = prefColors.filter((c: any) => c !== color);
        });
        if (disorderID == 'affected') {
            if (usedColors.indexOf('#FEE090') > -1 ) {
                return '#dbad71';
            } else {
                return '#FEE090';
            }
        }
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

    getCurrentDisorders(): any {
        var currentDisorders = [] as any[];
        for (var id in this._affectedNodes){
            currentDisorders.push(this.getTerm(id));
        }
        return currentDisorders;
    }
}
