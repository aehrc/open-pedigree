import PersonHoverbox from 'pedigree/view/personHoverbox';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

declare const editor: any;

/**
 * PersonGroupHoverbox is a class for all the UI elements and graphics surrounding a PersonGroup node and
 * its labels. This includes the box that appears around the node when it's hovered by a mouse.
 *
 * @class PersonGroupHoverbox
 * @extends PersonHoverbox
 * @constructor
 * @param {PersonGroup} node The node PersonGroup for which the hoverbox is drawn
 * @param {Number} centerX The x coordinate for the hoverbox
 * @param {Number} centerY The y coordinate for the hoverbox
 * @param {Raphael.st} nodeShapes Raphaël set containing the graphical elements that make up the node
 */
export default class PersonGroupHoverbox extends PersonHoverbox {
  constructor(personNode: any, centerX: any, centerY: any, nodeShapes: any) {
    var radius = PedigreeEditorParameters.attributes.radius * 2;
    super(personNode, centerX, centerY, nodeShapes);
  }

  /**
   * Creates the handles used in this hoverbox - overridden to generate no handles
   *
   * @method generateHandles
   * @return {Raphael.st} A set of handles
   */
  generateHandles(): any {
    if (this._currentHandles !== null) {
      return;
    }
    // else: no handles
  }

  /**
   * Creates the buttons used in this hoverbox
   *
   * @method generateButtons
   */
  generateButtons(): void {
    if (this._currentButtons !== null) {
      return;
    }
    super.generateButtons();

    // note: no call to super as we don't want default person buttons
    this.generateMenuBtn();
    this.generateDeleteBtn();
  }

  /**
   * Returns true if the menu for this node is open
   *
   * @method isMenuToggled
   * @return {Boolean}
   */
  isMenuToggled(): any {
    return this._isMenuToggled;
  }

  /**
   * Shows/hides the menu for this node
   *
   * @method toggleMenu
   */
  toggleMenu(isMenuToggled: any): void {
    if (this._justClosedMenu) {
      return;
    }
    this._isMenuToggled = isMenuToggled;
    if (isMenuToggled) {
      this.getNode().getGraphics().unmark();
      var optBBox = this.getBoxOnHover().getBBox();
      var x = optBBox.x2;
      var y = optBBox.y;
      var position = editor.getWorkspace().canvasToDiv(x + 5, y);
      editor.getNodeGroupMenu().show(this.getNode(), position.x, position.y);
    }
  }

  /**
   * Hides the hoverbox with a fade out animation
   *
   * @method animateHideHoverZone
   */
  animateHideHoverZone(): void {
    this._hidden = true;
    if (!this.isMenuToggled()) {
      var parentPartnershipNode = editor.getGraph().getParentRelationship(this.getNode().getID());
      if (parentPartnershipNode && editor.getNode(parentPartnershipNode)) {
        editor.getNode(parentPartnershipNode).getGraphics().unmarkPregnancy();
      }
      super.animateHideHoverZone();
    }
  }

  /**
   * Displays the hoverbox with a fade in animation
   *
   * @method animateDrawHoverZone
   */
  animateDrawHoverZone(): void {
    this._hidden = false;
    if (!this.isMenuToggled()) {
      var parentPartnershipNode = editor.getGraph().getParentRelationship(this.getNode().getID());
      if (parentPartnershipNode && editor.getNode(parentPartnershipNode)) {
        editor.getNode(parentPartnershipNode).getGraphics().markPregnancy();
      }
      super.animateDrawHoverZone();
    }
  }
}
