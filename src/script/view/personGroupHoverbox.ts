import PersonHoverbox from 'pedigree/view/personHoverbox';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

/**
 * PersonGroupHoverbox is a class for all the UI elements and graphics surrounding a PersonGroup node and
 * its labels. This includes the box that appears around the node when it's hovered by a mouse.
 *
 * @class GroupHoverbox
 * @extends AbstractHoverbox
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
    * Creates the handles used in this hoverbox - overriden to generate no handles
    *
    * @method generateHandles
    * @return {Raphael.st} A set of handles
    */
    generateHandles(): any {
        if (this._currentHandles !== null) {
            return;
        }
        // else: no handles
        this._currentHandles = [];
        this._currentOrbs    = [];
        this._handlesZoomSz  = editor.getWorkspace().getCurrentZoomLevel();
    }

    /**
     * Creates the buttons used in this hoverbox
     *
     * @method generateButtons
     */
    generateButtons(): any {
        if (this._currentButtons !== null) {
            return;
        }
        // Initialize button array without calling PersonHoverbox version
        this._currentButtons = [];

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
    toggleMenu(isMenuToggled: any): any {
        if (this._justClosedMenu) {
            return;
        }
        this._isMenuToggled = isMenuToggled;
        if(isMenuToggled) {
            this.getNode().getGraphics().unmark();
            var optBBox = this.getBoxOnHover().getBBox();
            var x = optBBox.x2;
            var y = optBBox.y;
            var position = editor.getWorkspace().canvasToDiv(x+5, y);
            editor.getNodeGroupMenu().show(this.getNode(), position.x, position.y);
        }
    }

    /**
     * Hides the hoverbox with a fade out animation
     *
     * @method animateHideHoverZone
     */
    animateHideHoverZone(): any {
        this._hidden = true;
        if(!this.isMenuToggled()){
            var parentPartnershipNode = editor.getGraph().getParentRelationship(this.getNode().getID());
            if (parentPartnershipNode && editor.getNode(parentPartnershipNode)) {
                editor.getNode(parentPartnershipNode).getGraphics().unmarkPregnancy();
            }
            // Call AbstractHoverbox animateHideHoverZone
            this._hidden = true;
            if (editor.getView().getCurrentDraggable() !== null) {
                return;
            }
            this.getNode().getGraphics().setSelected(false);
            if (this.getBoxOnHover()) {
                this.getBoxOnHover().stop().animate({opacity:0}, 200);
            }
            this.hideButtons();
            this.hideHandles();
        }
    }

    /**
     * Displays the hoverbox with a fade in animation
     *
     * @method animateDrawHoverZone
     */
    animateDrawHoverZone(): any {
        this._hidden = false;
        if(!this.isMenuToggled()){
            var parentPartnershipNode = editor.getGraph().getParentRelationship(this.getNode().getID());
            if (parentPartnershipNode && editor.getNode(parentPartnershipNode)) {
                editor.getNode(parentPartnershipNode).getGraphics().markPregnancy();
            }
            // Call AbstractHoverbox animateDrawHoverZone
            this._hidden = false;
            if (editor.getView().getCurrentDraggable() !== null) {
                return;
            }
            this.getNode().getGraphics().setSelected(true);
            if (this.getBoxOnHover()) {
                this.getBoxOnHover().stop().animate({opacity:0.7}, 200);
            }
            this.generateButtons();
            this.showButtons();
            if (this.getCurrentButtons()) {
                this.getCurrentButtons().forEach(function(button: any) {
                    if (button.hasOwnProperty('icon')) {
                        button.icon.stop().animate({opacity:1}, 200);
                    }
                });
            }
            if (this._handlesZoomSz != editor.getWorkspace().getCurrentZoomLevel()) {
                this.removeHandles();
            }
            this.generateHandles();
            this.showHandles();
        }
    }
}
