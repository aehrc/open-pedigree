import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

export default class AbstractNodeVisuals {
  _node: any;
  _absoluteX: any;
  _absoluteY: any;
  _hoverBox: any;
  _isGrown: any;
  _isSelected: any;

  constructor(node: any, x: any, y: any) {
    this._node = node;
    this._absoluteX = x;
    this._absoluteY = y;
    this._hoverBox = null;
    this._isGrown = false;
  }

  getNode(): any {
    return this._node;
  }

  getX(): any {
    return this._absoluteX;
  }

  onSetID(id: any): void {}

  getY(): any {
    return this._absoluteY;
  }

  getBottomY(): any {
    return this._absoluteY;
  }

  setPos(x: any, y: any, animate: any, callback: any): void {
    this._absoluteX = x;
    this._absoluteY = y;
    callback && callback();
  }

  grow(): void {
    this._isGrown = true;
  }

  shrink(): void {
    this._isGrown = false;
  }

  isGrown(): any {
    return this._isGrown;
  }

  containsXY(x: any, y: any): boolean {
    return false;
  }

  isSelected(): any {
    return this._isSelected;
  }

  setSelected(isSelected: any): void {
    this._isSelected = isSelected;
  }

  getAllGraphics(): any {
    return editor.getPaper().set(this.getShapes());
  }

  getShapes(): any {
    return editor.getPaper().set();
  }

  remove(): void {
    this.getHoverBox() && this.getHoverBox().remove();
    this.getAllGraphics().remove();
  }

  getHoverBox(): any {
    return this._hoverBox;
  }
}

export const ChildlessBehaviorVisuals = {
  getChildlessShape(this: any): any {
    return this._childlessShape;
  },

  getChildlessStatusLabel(this: any): any {
    return this._childlessStatusLabel;
  },

  updateChildlessShapes(this: any): void {
    const status = this.getNode().getChildlessStatus();
    this._childlessShape && this._childlessShape.remove();

    if (status) {
      const x = this.getX();
      const y = this.getY();
      const r = PedigreeEditorParameters.attributes.infertileMarkerWidth;
      const lowY = this.getBottomY() + PedigreeEditorParameters.attributes.infertileMarkerHeight;

      const childlessPath: any[] = [['M', x, y], ['L', x, lowY], ['M', x - r, lowY], ['l', 2 * r, 0]];
      if (status == 'infertile') {
        childlessPath.push(['M', x - r, lowY + 5], ['l', 2 * r, 0]);
      }

      const strokeWidth = 2.5;
      this._childlessShape = editor.getPaper().path(childlessPath);
      this._childlessShape.attr({ 'stroke-width': strokeWidth, stroke: '#3C3C3C' });
      this._childlessShape.toBack();
    }
  },

  updateChildlessStatusLabel(this: any): void {
    this._childlessStatusLabel && this._childlessStatusLabel.remove();
    this._childlessStatusLabel = null;

    const text = '';

    if (text.trim() != '') {
      this._childlessStatusLabel = editor.getPaper().text(this.getX(), this.getBottomY() + 18, '(' + text.slice(0, 15) + ')');
      this._childlessStatusLabel.attr({ 'font-size': 18, 'font-family': 'Cambria' });
      this._childlessStatusLabel.toBack();
    }

    this.drawLabels();
  },
};
