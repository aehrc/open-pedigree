import AbstractNodeVisuals from 'pedigree/view/abstractNodeVisuals';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

export default class AbstractPersonVisuals extends AbstractNodeVisuals {
  _radius: any;
  _width: any;
  _highlightBox: any;
  _adoptedShape: any;
  _genderShape: any;
  _genderGraphics: any;
  _shapeRadius: any;
  _idLabel: any;
  _callback: any;
  _toMark: any;
  glow: any;
  marked: any;

  constructor(node: any, x: any, y: any) {
    super(node, x, y);

    this._radius = PedigreeEditorParameters.attributes.radius;
    this._width = PedigreeEditorParameters.attributes.radius * 4;

    this._highlightBox = null;
    this._adoptedShape = null;
    this._genderShape = null;
    this._genderGraphics = null;

    this.setGenderGraphics();
    this.setHighlightBox();
    this.updateIDLabel();

    this._hoverBox = this.generateHoverbox(x, y);
  }

  updateIDLabel(): void {
    if (!editor.DEBUG_MODE) {
      return;
    }
    const x = this.getX();
    const y = this.getY();
    this._idLabel && this._idLabel.remove();
    this._idLabel = editor.getPaper().text(x, y, this.getNode().getID()).attr(PedigreeEditorParameters.attributes.dragMeLabel).toFront();
    this._idLabel.node.setAttribute('class', 'no-mouse-interaction');
  }

  generateHoverbox(x: any, y: any): any {
    return null;
  }

  onSetID(id: any): void {
    super.onSetID(id);
    this.updateIDLabel();
  }

  setPos(x: any, y: any, animate: any, callback: any): void {
    this.getHoverBox().removeHandles();
    this.getHoverBox().removeButtons();

    const moveX = x - this.getX();
    const moveY = y - this.getY();

    if (moveX == 0 && moveY == 0) {
      return;
    }

    super.setPos(x, y, animate, null);

    if (animate) {
      const me: any = this;
      this._callback = function () {
        if (me._toMark) {
          me.markPermanently();
          delete me._toMark;
        }
        delete me._callback;
        callback && callback();
      };
      this.getAllGraphics().animate({ transform: 't ' + moveX + ',' + moveY + '...' }, 900, 'linear', me._callback);
    } else {
      this.getAllGraphics().transform('t ' + moveX + ',' + moveY + '...');
      callback && callback();
    }
  }

  grow(): void {
    super.grow();
    if (this._callback) {
      throw 'Assertion failed: grow() during animation';
    }
    if (this.glow) {
      return;
    }
    this.glow = this._genderShape.glow({ width: 11, fill: true, opacity: 0.4, color: 'green' });
    if (this.marked) {
      this.marked.hide();
    }
  }

  shrink(): void {
    this.glow && this.glow.remove();
    delete this.glow;
    if (this.marked) {
      this.marked.show();
    }
    super.shrink();
  }

  markPermanently(): void {
    if (this._callback && !this._toMark) {
      this._toMark = true;
      return;
    }
    if (this.marked) {
      return;
    }
    this.marked = this._genderShape.glow({ width: 11, fill: true, opacity: 0.6, color: '#ee8d00' });
  }

  unmark(): void {
    this.marked && this.marked.remove();
    delete this.marked;
  }

  containsXY(x: any, y: any): boolean {
    if (Math.abs(x - this.getX()) <= this._radius && Math.abs(y - this.getY()) <= this._radius) {
      return true;
    }
    return false;
  }

  getBottomY(): any {
    return this._absoluteY + this._radius + PedigreeEditorParameters.attributes.childlessLength;
  }

  drawAdoptedShape(): void {
    this._adoptedShape && this._adoptedShape.remove();
    const r = PedigreeEditorParameters.attributes.radius;
    const x1 = this.getX() - 0.8 * r;
    const x2 = this.getX() + 0.8 * r;
    const y = this.getY() - 1.3 * r + 1;
    const brackets =
      'M' + x1 + ' ' + y + 'l' + r / -2 + ' ' + 0 + 'l0 ' + (2.6 * r - 2) + 'l' + r / 2 + ' 0M' +
      x2 + ' ' + y + 'l' + r / 2 + ' 0' + 'l0 ' + (2.6 * r - 2) + 'l' + r / -2 + ' 0';
    this._adoptedShape = editor.getPaper().path(brackets).attr('stroke-width', 2.5);
    this._adoptedShape.toBack();
  }

  removeAdoptedShape(): void {
    this._adoptedShape && this._adoptedShape.remove();
  }

  getAdoptedShape(): any {
    return this._adoptedShape;
  }

  getShapes(): any {
    const shapes = super.getShapes().push(this.getGenderGraphics());
    this.getAdoptedShape() && shapes.push(this.getAdoptedShape());
    return shapes;
  }

  getAllGraphics(): any {
    return editor.getPaper().set(this.getHighlightBox(), this._idLabel).concat(super.getAllGraphics());
  }

  getGenderGraphics(): any {
    return this._genderGraphics;
  }

  getGenderShape(): any {
    return this._genderShape;
  }

  setGenderGraphics(): void {
    this.unmark();
    this._genderGraphics && this._genderGraphics.remove();

    this._shapeRadius =
      this.getNode().getGender() == 'U'
        ? (PedigreeEditorParameters.attributes.radius * 1.1) / Math.sqrt(2)
        : PedigreeEditorParameters.attributes.radius;
    if (this.getNode().isPersonGroup()) {
      this._shapeRadius *= PedigreeEditorParameters.attributes.groupNodesScale;
    }

    const x = this.getX();
    const y = this.getY();
    const radius = this._shapeRadius;

    let shape: any;
    if (this.getNode().getGender() == 'F') {
      shape = editor.getPaper().circle(x, y, radius);
    } else {
      shape = editor.getPaper().rect(x - radius, y - radius, radius * 2, radius * 2);
    }

    if (this.getNode().getGender() == 'U') {
      shape.attr(PedigreeEditorParameters.attributes.nodeShapeDiag);
      shape.attr({ transform: '...R45' });
    } else {
      shape.attr(PedigreeEditorParameters.attributes.nodeShape);
    }

    let shadow: any;
    if (!editor.isUnsupportedBrowser()) {
      shadow = shape.clone().attr({ stroke: 'none', fill: 'gray', opacity: 0.3 });
      shadow.translate(3, 3);
      shadow.insertBefore(shape);
    }

    this._genderShape = shape;
    this._genderGraphics = editor.getPaper().set(shadow, shape);
  }

  setHighlightBox(): void {
    this._highlightBox && this._highlightBox.remove();

    const radius = PedigreeEditorParameters.attributes.personHoverBoxRadius;
    this._highlightBox = editor
      .getPaper()
      .rect(this.getX() - radius, this.getY() - radius, radius * 2, radius * 2, 5)
      .attr(PedigreeEditorParameters.attributes.boxOnHover);
    this._highlightBox.attr({ fill: 'black', opacity: 0, 'fill-opacity': 0 });
    this._highlightBox.insertBefore(this.getGenderGraphics().flatten());
  }

  getHighlightBox(): any {
    return this._highlightBox;
  }

  highlight(): void {
    this.getHighlightBox() && this.getHighlightBox().attr({ opacity: 0.5, 'fill-opacity': 0.5 });
  }

  unHighlight(): void {
    this.getHighlightBox().attr({ opacity: 0, 'fill-opacity': 0 });
  }

  remove(): void {
    this.marked && this.marked.remove();
    super.remove();
  }
}
