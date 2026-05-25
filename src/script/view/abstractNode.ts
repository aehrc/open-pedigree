import AbstractNodeVisuals from 'pedigree/view/abstractNodeVisuals';

/**
 * AbstractNode is the general abstract class for nodes on the Pedigree graph. An AbstractNode contains information
 * about its position on the canvas and about relationships with other nodes on the graph.
 *
 * @class AbstractNode
 * @constructor
 * @param {Number} x The x coordinate on the canvas
 * @param {Number} y The y coordinate on the canvas
 * @param {Number} [id] The id of the node
 */

export default class AbstractNode {
    _id: any;
    _comments: any;
    _type: any;
    _graphics: any;

    constructor(x: any, y: any, id: any) {
        this._id = id;
        this._comments = '';
        !this._type && (this._type = 'AbstractNode');
        this._graphics = this._generateGraphics(x, y);
    }

    /**
     * Returns the unique ID of this node
     *
     * @method getID
     * @return {Number} the id of the node
     */
    getID(): any {
        return this._id;
    }

    /**
     * Sets the ID of this node
     * (when nodes get removed all ids above the removed id shift by one down)
     *
     * @method setID
     */
    setID(id: any): any {
        if (id == this._id) {
            return;
        }
        this._id = id;
        this._graphics.onSetID(id);
    }

    /**
     * Generates an instance of AbstractNodeVisuals
     *
     * @method _generateGraphics
     * @param {Number} x The x coordinate of the node
     * @param {Number} y The y coordinate of the node
     * @return {AbstractNodeVisuals}
     * @private
     */
    _generateGraphics(x: any, y: any): any {
        return new AbstractNodeVisuals(this, x, y);
    }

    /**
     * Returns the object responsible for managing graphics
     *
     * @method getGraphics
     * @return {AbstractNodeVisuals}
     */
    getGraphics(): any {
        return this._graphics;
    }

    /**
     * Returns the X coordinate of the node on the canvas
     *
     * @method getX
     * @return {Number} the x coordinate
     */
    getX(): any {
        return this.getGraphics().getX();
    }

    /**
     * Returns the Y coordinate of the node on the canvas
     *
     * @method getY
     * @return {Number} the y coordinate
     */
    getY(): any {
        return this.getGraphics().getY();
    }

    /**
     * Changes the position of the node to (x,y)
     *
     * @method setPos
     * @param {Number} x The x coordinate on the canvas
     * @param {Number} y The y coordinate on the canvas
     * @param {Boolean} [animate] Set to true if you want to animate the transition
     * @param {Function} [callback] The function called at the end of the animation
     */
    setPos(x: any, y: any, animate: any, callback: any): any {
        this.getGraphics().setPos(x, y, animate, callback);
    }

    /**
     * Returns the type of this node
     *
     * @method getType
     * @return {String} The type (eg. "Partnership", "Person", etc)
     */
    getType(): any {
        return this._type;
    }

    /**
     * Removes the node and its visuals.
     *
     * @method remove
     * @param [skipConfirmation=false] {Boolean} if true, no confirmation box will pop up
     */
    remove(): any {
        this.getGraphics().remove();
    }

    /**
     * Returns any free-form comments associated with the node
     *
     * @method getComments
     * @return {String}
     */
    getComments(): any {
        return this._comments;
    }

    /**
     * Replaces free-form comments associated with the node
     *
     * @method setComments
     * @param comment
     */
    setComments(comment: any): any {
        this._comments = comment;
    }

    /**
     * Returns an object containing all the properties of this node
     * except id, x, y & type
     *
     * @method getProperties
     * @return {Object} in the form
     *
     */
    getProperties(): any {
        var info = {} as any;
        if (this.getComments() != '') {
            info['comments'] = this.getComments();
        }
        return info;
    }

    /**
     * Applies the properties found in info to this node.
     *
     * @method assignProperties
     * @param properties Object
     * @return {Boolean} True if properties were successfully assigned (i.e. no conflicts/invalid values)
     */
    assignProperties(properties: any): any {
        if (properties.hasOwnProperty('comments') && this.getComments() != properties.comments) {
            this.setComments(properties.comments);
        }
        return true;
    }

    /**
     * Applies properties that happen to this node when a widget (such as the menu) is closed.
     *
     * @method onWidgetHide
     */
    onWidgetHide(): any {
        this.getGraphics().getHoverBox() && this.getGraphics().getHoverBox().onWidgetHide();
    }

    onWidgetShow(): any {
        this.getGraphics().getHoverBox() && this.getGraphics().getHoverBox().onWidgetShow();
    }
}


export var ChildlessBehavior = {
    /**
     * Returns the childless status of this node
     *
     * @method getChildlessStatus
     * @return {Null|String} null, childless or infertile
     */
    getChildlessStatus: function(this: any): any {
        return this._childlessStatus;
    },

    /**
     * Returns true if the status is either 'infertile' or 'childless'
     *
     * @method isValidChildlessStatus
     * @return {Boolean}
     */
    isValidChildlessStatus: function(this: any, status: any): any {
        return ((status == 'infertile' || status == 'childless'));
    }
};
