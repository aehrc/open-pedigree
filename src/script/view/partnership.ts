import AbstractNode from 'pedigree/view/abstractNode';
import PartnershipVisuals from 'pedigree/view/partnershipVisuals';

declare const editor: any;

/**
 * Partnership is a class that represents the relationship between two AbstractNodes
 * and their children.
 *
 * @class Partnership
 * @constructor
 * @extends AbstractNode
 * @param x the x coordinate at which the partnership junction will be placed
 * @param y the y coordinate at which the partnership junction will be placed
 * @param partner1 an AbstractPerson who's one of the partners in the relationship.
 * @param partner2 an AbstractPerson who's the other partner in the relationship. The order of partners is irrelevant.
 * @id the unique ID number of this node
 */
export default class Partnership extends AbstractNode {
  // Static slot to thread properties through super() call into _generateGraphics
  static _pendingProperties: any = null;

  _childlessStatus: any;
  _type: any;
  _broken: any;
  _consangrMode: any;

  constructor(x: any, y: any, id: any, properties: any) {
    Partnership._pendingProperties = properties;
    super(x, y, id);
    this.assignProperties(properties);
  }

  /**
   * Generates and returns an instance of PartnershipVisuals
   *
   * @method _generateGraphics
   * @param {Number} x X coordinate of this partnership
   * @param {Number} y Y coordinate of this partnership
   * @return {PartnershipVisuals}
   * @private
   */
  _generateGraphics(x: any, y: any): any {
    // 'this' is accessible here because we are called from within super()'s constructor.
    const props = Partnership._pendingProperties || {};
    this._childlessStatus = null;
    this._type = 'Partnership';
    this._broken = false;
    this._consangrMode = 'A';  // Can be either "A" (autodetect), "Y" (always consider consangr.) or "N" (never)
    // assign some properties before drawing so that relationship lines are drawn properly
    this.setBrokenStatus(props['broken']);
    this.setConsanguinity(props['consangr']);
    return new PartnershipVisuals(this, x, y);
  }

  /**
   * Changes the status of this partnership. Nullifies the status if the given status is not
   * "childless" or "infertile".
   *
   * @method setChildlessStatus
   * @param {String} status Can be "childless", "infertile" or null
   */
  setChildlessStatus(status: any): any {
    if (!this.isValidChildlessStatus(status)) {
      status = null;
    }

    if (status != this.getChildlessStatus()) {
      this._childlessStatus = status;
      this.getGraphics().updateChildlessShapes();
      this.getGraphics().updateChildhubConnection();
      this.getGraphics().getHoverBox().regenerateHandles();
    }

    return this.getChildlessStatus();
  }

  /**
   * Sets the consanguinity setting of this relationship. Valid inputs are "A" (automatic"), "Y" (yes) and "N" (no)
   *
   * @method setConsanguinity
   */
  setConsanguinity(value: any): void {
    if (value != 'A' && value != 'N' && value != 'Y') {
      value = 'A';
    }
    if (this._consangrMode != value) {
      this._consangrMode = value;
    }
    this.getGraphics() && this.getGraphics().getHoverBox().regenerateButtons();
  }

  /**
   * Returns the consanguinity setting of this relationship: "A" (automatic"), "Y" (yes) or "N" (no)
   *
   * @method getConsanguinity
   */
  getConsanguinity(): any {
    return this._consangrMode;
  }

  /**
   * Sets relationship as either broken or not
   *
   * @method setBrokenStatus
   */
  setBrokenStatus(value: any): void {
    if (value === undefined) {
      value = false;
    }
    if (this._broken != value) {
      this._broken = value;
    }
  }

  /**
   * Returns the status of this relationship (broken or not)
   *
   * @method getBrokenStatus
   */
  getBrokenStatus(): any {
    return this._broken;
  }

  /**
   * Returns an object (to be accepted by the menu) with information about this Partnership
   *
   * @method getSummary
   * @return {Object}
   */
  getSummary(): any {
    var childlessInactive = editor.getGraph().hasNonPlaceholderNonAdoptedChildren(this.getID());
    return {
      identifier:      {value : this.getID()},
      childlessSelect: {value : this.getChildlessStatus() ? this.getChildlessStatus() : 'none', inactive: childlessInactive},
      consangr:        {value: this._consangrMode, inactive: false},
      broken:          {value: this.getBrokenStatus(), inactive: false}
    };
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
    var info = super.getProperties();
    if (this.getChildlessStatus() != null) {
      info['childlessStatus'] = this.getChildlessStatus();
    }
    if (this.getConsanguinity() != 'A') {
      info['consangr'] = this.getConsanguinity();
    }
    if (this.getBrokenStatus()) {
      info['broken'] = this.getBrokenStatus();
    }
    return info;
  }

  /**
   * Applies the properties found in info to this node.
   *
   * @method assignProperties
   * @param properties Object
   * @return {Boolean} True if info was successfully assigned
   */
  assignProperties(info: any): any {
    if (super.assignProperties(info)) {
      if (info.childlessStatus && info.childlessStatus != this.getChildlessStatus()) {
        this.setChildlessStatus(info.childlessStatus);
      }
      if (info.consangr && info.consangr != this.getConsanguinity()) {
        this.setConsanguinity(info.consangr);
      }
      if (info.broken && info.broken != this.getBrokenStatus()) {
        this.setBrokenStatus(info.broken);
      }
      return true;
    }
    return false;
  }

  // ChildlessBehavior mixin methods
  getChildlessStatus(): any {
    return this._childlessStatus;
  }

  isValidChildlessStatus(status: any): boolean {
    return status == 'infertile' || status == 'childless';
  }
}
