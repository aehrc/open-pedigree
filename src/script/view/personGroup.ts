import Person from 'pedigree/view/person';
import PersonGroupVisuals from 'pedigree/view/personGroupVisuals';

/**
 * PersonGroup is node that represents a grouping of an unknown number of nodes ("n"). This type of
 * node is usually used to indicate the existence of relatives without providing any other information.
 * Therefore the options for this node are limited.
 *
 * @class PersonGroup
 * @constructor
 * @extends AbstractPerson
 * @param {Number} x The x coordinate on the Raphael canvas at which the node drawing will be centered
 * @param {Number} y The y coordinate on the Raphael canvas at which the node drawing will be centered
 * @param {String} gender Either 'M', 'F' or 'U' depending on the gender
 * @param {Number} id Unique ID number
 */
export default class PersonGroup extends Person {
    _numPersons: any;
    _comment: any;

    constructor(x: any, y: any, id: any, properties: any) {
        (PersonGroup as any)._pendingNumPersons = 1;
        (PersonGroup as any)._pendingComment = '';
        (PersonGroup as any)._pendingPersonGroupType = 'PersonGroup';

        super(x, y, id, properties);
        // already done as the last step in super():
        // this.assignProperties(properties);
    }

    _generateGraphics(x: any, y: any): any {
        if ((PersonGroup as any)._pendingNumPersons !== undefined) {
            this._numPersons = (PersonGroup as any)._pendingNumPersons;
            this._comment    = (PersonGroup as any)._pendingComment;
            (this as any)._type = (PersonGroup as any)._pendingPersonGroupType;
            delete (PersonGroup as any)._pendingNumPersons;
            delete (PersonGroup as any)._pendingComment;
            delete (PersonGroup as any)._pendingPersonGroupType;
        }
        // need to call Person's _setDefault before creating visuals
        this._setDefault();
        return new PersonGroupVisuals(this, x, y);
    }

    /**
     * Always returns False - needed for compatibility with personHowerBox which uses this
     *
     * @method isProband
     */
    isProband(): any {
        return false;
    }

    /**
     * Changes the number of people who are in this PersonGroup
     *
     * @method setNumPersons
     * @param {Number} numPersons The number of people in this grouping
     */
    setNumPersons(numPersons: any): any {
        this._numPersons = numPersons;
        this.getGraphics().setNumPersons(numPersons);
    }

    /**
     * Returns the number of people who are in this PersonGroup
     *
     * @method getNumPersons
     * @return {Number}
     */
    getNumPersons(): any {
        return this._numPersons;
    }

    /**
     * Changes the life status of this Person to newStatus
     *
     * @method setLifeStatus
     * @param {String} newStatus "alive", "deceased", "stillborn", "unborn", "aborted" or "miscarriage"
     */
    setLifeStatus(newStatus: any): any {
        super.setLifeStatus(newStatus);
        this.getGraphics().setNumPersons(this._numPersons); // force-redraw of the "N" symbol on top of the new shape
    }

    /**
     * Returns an object containing all the properties of this node
     * except id, x, y & type
     *
     * @method getProperties
     * @return {Object} in the form
     *
     {
       property: value
     }
     */
    getProperties(): any {
        var info = super.getProperties();
        info['numPersons'] = this.getNumPersons();
        return info;
    }

    /**
     * Applies the properties found in info to this node.
     *
     * @method loadProperties
     * @param properties Object
     * @return {Boolean} True if info was successfully assigned
     */
    assignProperties(info: any): any {
        if(super.assignProperties(info) && info.numPersons) {
            if (this.getNumPersons() != info.numPersons) {
                this.setNumPersons(info.numPersons);
            }
            return true;
        }
        return false;
    }

    /**
     * Returns an object (to be accepted by the menu) with information about this Person
     *
     * @method getSummary
     * @return {Object} Summary object for the menu
     */
    getSummary(): any {
        var disorders = [] as any[];
        this.getDisorders().forEach(function(disorder: any) {
            var disorderName = editor.getDisorderLegend().getDisorder(disorder).getName();
            disorders.push({id: disorder, value: disorderName});
        });

        var cantChangeAdopted = this.isFetus() || editor.getGraph().hasToBeAdopted(this.getID());

        return {
            identifier:   {value : this.getID()},
            comment:      {value : this.getFirstName()},
            gender:       {value : this.getGender()},
            external_ids: {value : this.getExternalID()},
            disorders:    {value : disorders},
            adopted:      {value : this.isAdopted(), inactive: cantChangeAdopted},
            comments:     {value : this.getComments(), inactive: false},
            state:        {value : this.getLifeStatus()},
            numInGroup:   {value : this.getNumPersons()},
            evaluatedGrp: {value : this.getEvaluated() }
        };
    }
}
