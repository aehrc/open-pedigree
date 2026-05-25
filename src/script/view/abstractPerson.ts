import AbstractNode from 'pedigree/view/abstractNode';
import AbstractPersonVisuals from 'pedigree/view/abstractPersonVisuals';

/**
 * A general superclass for Person nodes on the Pedigree graph. Contains information about related nodes
 * and some properties specific for people. Creates an instance of AbstractPersonVisuals on initialization
 *
 * @class AbstractPerson
 * @extends AbstractNode
 * @constructor
 * @param {Number} x The x coordinate on the canvas
 * @param {Number} y The y coordinate on the canvas
 * @param {String} gender Can be "M", "F", or "U"
 * @param {Number} [id] The id of the node
 */

export default class AbstractPerson extends AbstractNode {
    _gender: any;
    _isAdopted: any;

    constructor(x: any, y: any, gender: any, id: any) {
        // must set _gender before super() since _generateGraphics uses it
        // but super() must be called first in TS, so we handle via initialize pattern
        // We need to set _type before super() calls _generateGraphics
        // We'll use a workaround: store the gender temporarily
        const parsedGender = (gender.toUpperCase() == 'M' || gender.toUpperCase() == 'F') ? gender.toUpperCase() : 'U';
        // Set type so super() doesn't overwrite
        // In the original: !this._type && (this._type = 'AbstractPerson') in _generateGraphics chain
        // We set _gender before super because the original code does it before $super()
        // TypeScript requires super first, so we temporarily work around this

        // Temporarily hold gender for use during super() call chain
        (AbstractPerson as any)._pendingGender = parsedGender;
        (AbstractPerson as any)._pendingIsAdopted = false;
        (AbstractPerson as any)._pendingType = 'AbstractPerson';

        super(x, y, id);

        // These will be set by the static pending fields during construction
        // but we need to ensure they're set here too
        if (!this._gender) {
            this._gender = parsedGender;
        }
        if (this._isAdopted === undefined) {
            this._isAdopted = false;
        }
    }

    _generateGraphics(x: any, y: any): any {
        // Set the pending fields now that we're in _generateGraphics
        if ((AbstractPerson as any)._pendingGender !== undefined) {
            this._gender = (AbstractPerson as any)._pendingGender;
            this._isAdopted = (AbstractPerson as any)._pendingIsAdopted;
            if (!(this as any)._type) {
                (this as any)._type = (AbstractPerson as any)._pendingType;
            }
            delete (AbstractPerson as any)._pendingGender;
            delete (AbstractPerson as any)._pendingIsAdopted;
            delete (AbstractPerson as any)._pendingType;
        }
        return new AbstractPersonVisuals(this, x, y);
    }

    /**
     * Reads a string of input and converts it into the standard gender format of "M","F" or "U".
     * Defaults to "U" if string is not recognized
     *
     * @method parseGender
     * @param {String} gender The string to be parsed
     * @return {String} the gender in the standard form ("M", "F", or "U")
     */
    parseGender(gender: any): any {
        return (gender.toUpperCase() == 'M' || gender.toUpperCase() == 'F') ? gender.toUpperCase() : 'U';
    }

    /**
     * Returns "U", "F" or "M" depending on the gender of this node
     *
     * @method getGender
     * @return {String}
     */
    getGender(): any {
        return this._gender;
    }

    /**
     * @method isPersonGroup
     */
    isPersonGroup(): any {
        return (this._type == 'PersonGroup');
    }

    /**
     * Updates the gender of this node
     *
     * @method setGender
     * @param {String} gender Should be "U", "F", or "M" depending on the gender
     */
    setGender(gender: any): any {
        var parsedGender = this.parseGender(gender);
        if (this._gender != parsedGender) {
            this._gender = parsedGender;
            this.getGraphics().setGenderGraphics();
            this.getGraphics().getHoverBox().regenerateHandles();
            this.getGraphics().getHoverBox().regenerateButtons();
        }
    }

    /**
     * Changes the adoption status of this Person to isAdopted. Updates the graphics.
     *
     * @method setAdopted
     * @param {Boolean} isAdopted Set to true if you want to mark the Person adopted
     */
    setAdopted(isAdopted: any): any {
        this._isAdopted = isAdopted;
        //TODO: implement adopted and social parents
        if(isAdopted) {
            this.getGraphics().drawAdoptedShape();
        } else {
            this.getGraphics().removeAdoptedShape();
        }
    }

    /**
     * Returns true if this Person is marked adopted
     *
     * @method isAdopted
     * @return {Boolean}
     */
    isAdopted(): any {
        return this._isAdopted;
    }

    // TODO: for automated setMethod -> getMethod used for undo/redo
    getAdopted(): any {
        return this.isAdopted();
    }

    /**
     * Returns an object containing all the properties of this node
     * except id, x, y & type
     *
     * @method getProperties
     * @return {Object} in the form
     *
     {
       sex: "gender of the node"
     }
     */
    getProperties(): any {
        var info = super.getProperties();
        info['gender'] = this.getGender();
        return info;
    }

    /**
     * Applies the properties found in info to this node.
     *
     * @method assignProperties
     * @param properties Object
     * @return {Boolean} True if info was successfully assigned
     */
    assignProperties(properties: any): any {
        if (!super.assignProperties(properties)) {
            return false;
        }
        if (!properties.gender) {
            return false;
        }

        if(this.getGender() != this.parseGender(properties.gender)) {
            this.setGender(properties.gender);
        }
        return true;
    }
}
