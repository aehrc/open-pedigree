// ReadOnlyHoverbox intentionally does not extend AbstractHoverbox because the original
// PrototypeJS version never called $super() - skipping the full hoverbox initialization.
// All callers use duck typing (no instanceof checks), so this is safe.
export default class ReadOnlyHoverbox {
  _node: any;
  _nodeX: any;
  _nodeY: any;
  _shapes: any;
  _currentButtons: any;

  constructor(node: any, x: any, y: any, shapes: any) {
    this._node = node;
    this._nodeX = x;
    this._nodeY = y;
    this._shapes = shapes;
    this._currentButtons = null;
  }

  getWidth(): any { return 0; }
  getHeight(): any { return 0; }
  getNode(): any { return this._node; }
  generateButtons(): void {}
  removeButtons(): void {}
  hideButtons(): void {}
  showButtons(): void {}
  getCurrentButtons(): any { return this._currentButtons; }
  removeHandles(): void {}
  hideHandles(): void {}
  showHandles(): void {}
  generateHandles(): void {}
  regenerateHandles(): void {}
  getBoxOnHover(): any { return null; }
  isHovered(): any { return false; }
  setHovered(isHovered: any): void {}
  setHighlighted(isHighlighted: any): void {}
  getHoverZoneMask(): any { return null; }
  getFrontElements(): any { return this._shapes; }
  getBackElements(): any { return this._shapes; }
  isMenuToggled(): any { return false; }
  animateDrawHoverZone(): void {}
  animateHideHoverZone(): void {}
  disable(): void {}
  enable(): void {}
  remove(): void {}
  onWidgetHide(): void {}
  onWidgetShow(): void {}
}
