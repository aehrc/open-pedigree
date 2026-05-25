import AbstractHoverbox from 'pedigree/view/abstractHoverbox';

/**
 * A stub hoverbox used when generating read-only pedigrees
 */
export default class ReadOnlyHoverbox extends AbstractHoverbox {
    _node: any;
    _nodeX: any;
    _nodeY: any;
    _shapes: any;

    constructor(node: any, x: any, y: any, shapes: any) {
        // Don't call super() with the usual args since we don't need the usual setup
        // But TS requires super() call - so we call it with dummy values
        // and then override everything
        super(node, 0, 0, 0, 0, x, y, {flatten: () => ({insertBefore: () => {}, insertAfter: () => {}})} as any);
        this._node   = node;
        this._nodeX  = x;
        this._nodeY  = y;
        this._shapes = shapes;
    }

    getWidth(): any {
        return 0;
    }

    getHeight(): any {
        return 0;
    }

    getNode(): any {
        return this._node;
    }

    generateButtons(): any {
    }

    removeButtons(): any {
    }

    hideButtons(): any {
    }

    showButtons(): any {
    }

    getCurrentButtons(): any {
        return this._currentButtons;
    }

    removeHandles(): any {
    }

    hideHandles(): any {
    }

    showHandles(): any {
    }

    generateHandles(): any {
    }

    regenerateHandles(): any {
    }

    getBoxOnHover(): any {
        return null;
    }

    isHovered(): any {
        return false;
    }

    setHovered(isHovered: any): any {
    }

    setHighlighted(isHighlighted: any): any {
    }

    getHoverZoneMask(): any {
        return null;
    }

    getFrontElements(): any {
        return this._shapes;
    }

    getBackElements(): any {
        return this._shapes;
    }

    isMenuToggled(): any {
        return false;
    }

    animateDrawHoverZone(): any {
    }

    animateHideHoverZone(): any {
    }

    disable(): any {
    }

    enable(): any {
    }

    remove(): any {
    }

    onWidgetHide(): any {
    }

    onWidgetShow(): any {
    }
}
