import Legend from 'pedigree/view/legend';
import TerminologyManager from "pedigree/terminology/terminologyManger";
import PhenotypeTerm, {PhenotypeTermType} from "pedigree/terminology/phenotypeTerm";
import GeneTerm from "pedigree/terminology/geneTerm";

/**
 * Class responsible for keeping track of HPO terms and their properties, and for
 * caching disorders data as loaded from the OMIM database.
 * This information is graphically displayed in a 'Legend' box
 *
 * @class PhenotypeLegend
 * @constructor
 */
var PhenotypeLegend = Class.create( Legend, {

  initialize: function($super) {
    $super('Phenotypes');

    this._termCache = {};
  },

  _getPrefix: function(id) {
    return 'phenotype';
  },

  /**
     * Returns the HPOTerm object with the given ID. If object is not in cache yet
     * returns a newly created one which may have the term name & other attributes not loaded yet
     *
     * @method getTerm
     * @return {Object}
     */
  getTerm: function(phenotypeID) {
    phenotypeID = TerminologyManager.sanitizeID(PhenotypeTermType, phenotypeID);
    if (!this._termCache.hasOwnProperty(phenotypeID)) {
      var whenNameIsLoaded = function() {
        this._updateTermName(phenotypeID);
      };
      this._termCache[phenotypeID] = new PhenotypeTerm(phenotypeID, null, whenNameIsLoaded.bind(this));
    }
    return this._termCache[phenotypeID];
  },

  /**
     * Retrieve the color associated with the given object
     *
     * @method getObjectColor
     * @param {String|Number} id ID of the object
     * @return {String} CSS color value for that disorder
     */
  getObjectColor: function(id) {
    return '#CCCCCC';
  },

  /**
     * Registers an occurrence of a phenotype.
     *
     * @method addCase
     * @param {Number|String} id ID for this term taken from the HPO database
     * @param {String} name The description of the phenotype
     * @param {Number} nodeID ID of the Person who has this phenotype
     */
  addCase: function($super, id, name, nodeID) {
    if (!this._termCache.hasOwnProperty(id)) {
      this._termCache[id] = new PhenotypeTerm(id, name);
    }

    $super(id, name, nodeID);
  },
  addToCache: function(id, name){
    if (!this._termCache.hasOwnProperty(id)) {
      this._termCache[id] = new PhenotypeTerm(id, name);
    }
  },
  /**
     * Updates the displayed phenotype name for the given phenotype
     *
     * @method _updateTermName
     * @param {Number} id The identifier of the phenotype to update
     * @private
     */
  _updateTermName: function(id) {
    //console.log("updating phenotype display for " + id + ", name = " + this.getTerm(id).getName());
    var name = this._legendBox.down('li#' + this._getPrefix() + '-' + id + ' .disorder-name');
    name.update(this.getTerm(id).getName());
  },
  getCurrentPhenotypes : function(){
    var currentPhenotypes = [];
    for (var id in this._affectedNodes){
      currentPhenotypes.push(this.getTerm(id));
    }
    return currentPhenotypes;
  }
});

export default PhenotypeLegend;
