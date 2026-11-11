import PersonVisuals from 'pedigree/view/personVisuals';

/**
 * The visuals of a placeholder: the hidden only child of a couple with no children
 * (DynamicPositionedGraph.isPlaceholder). It is a Person to the rest of the editor, so the many
 * callers that look up a couple's children keep working, but nothing of it is shown: its shapes,
 * labels and hover box are drawn hidden (and hidden SVG elements take no mouse events), and it
 * never glows, grows or contains a point.
 *
 * @class PlaceholderVisuals
 * @extends PersonVisuals
 */
export default class PlaceholderVisuals extends PersonVisuals {
  constructor(node: any, x: any, y: any) {
    super(node, x, y);
    this._hideAll();
  }

  _hideAll(): void {
    this.getAllGraphics().hide();
    const hoverBox = this.getHoverBox();
    if (hoverBox) {
      hoverBox.getFrontElements().hide();
      hoverBox.getBackElements().hide();
    }
  }

  setPos(x: any, y: any, animate: any, callback: any): void {
    super.setPos(x, y, animate, callback);
    // (in case a move drew anything)
    this._hideAll();
  }

  drawLabels(): void {
    super.drawLabels();
    this._hideAll();
  }

  grow(): void {
  }

  shrink(): void {
  }

  markPermanently(): void {
  }

  unmark(): void {
  }

  containsXY(): boolean {
    return false;
  }
}
