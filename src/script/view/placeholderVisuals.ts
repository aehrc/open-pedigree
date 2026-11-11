import PersonVisuals from 'pedigree/view/personVisuals';

// Every PersonVisuals method that draws: after any of them, whatever it drew is hidden again.
const DRAWING_METHODS = [
  'drawAdoptedShape', 'drawCarrierGraphic', 'drawDeadShape', 'drawLabels', 'drawUnbornShape',
  'setGenderGraphics', 'setHighlightBox', 'setLinkedRecordChangedMark', 'setPos', 'setSelected',
  'updateAgeLabel', 'updateCarrierGraphic', 'updateChildlessShapes', 'updateChildlessStatusLabel',
  'updateCommentsLabel', 'updateDisorderShapes', 'updateEvaluationLabel', 'updateExternalIDLabel',
  'updateIDLabel', 'updateLifeStatusShapes', 'updateNameLabel', 'updateSBLabel',
];

/**
 * The visuals of a placeholder: the hidden only child of a couple with no children
 * (DynamicPositionedGraph.isPlaceholder). It is a Person to the rest of the editor, so the many
 * callers that look up a couple's children keep working, but nothing of it is shown: its shapes,
 * labels and hover box are drawn hidden (and hidden SVG elements take no mouse events), whatever
 * redraws them, and it never glows, grows or contains a point.
 *
 * @class PlaceholderVisuals
 * @extends PersonVisuals
 */
export default class PlaceholderVisuals extends PersonVisuals {
  _constructed: boolean;

  constructor(node: any, x: any, y: any) {
    super(node, x, y);
    this._constructed = true;
    this._hideAll();
  }

  _hideAll(): void {
    // (not while PersonVisuals is still being built: its shapes aren't all there yet)
    if (!this._constructed) {
      return;
    }
    this.getAllGraphics().hide();
    const hoverBox = this.getHoverBox();
    if (hoverBox) {
      hoverBox.getFrontElements().hide();
      hoverBox.getBackElements().hide();
    }
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

for (const name of DRAWING_METHODS) {
  const draw = (PersonVisuals.prototype as any)[name];
  if (typeof draw !== 'function') {
    throw 'Assertion failed: PersonVisuals has no ' + name;
  }
  (PlaceholderVisuals.prototype as any)[name] = function (...args: any[]) {
    const result = draw.apply(this, args);
    this._hideAll();
    return result;
  };
}
