import AbstractNodeVisuals from 'pedigree/view/abstractNodeVisuals';

export default class AbstractNode {
  _id: any;
  _comments: any;
  _type: any;
  _graphics: any;

  constructor(x: any, y: any, id: any) {
    this._id = id;
    this._comments = '';
    if (!this._type) this._type = 'AbstractNode';
    this._graphics = this._generateGraphics(x, y);
  }

  getID(): any {
    return this._id;
  }

  setID(id: any): void {
    if (id == this._id) {
      return;
    }
    this._id = id;
    this._graphics.onSetID(id);
  }

  _generateGraphics(x: any, y: any): any {
    return new AbstractNodeVisuals(this, x, y);
  }

  getGraphics(): any {
    return this._graphics;
  }

  getX(): any {
    return this.getGraphics().getX();
  }

  getY(): any {
    return this.getGraphics().getY();
  }

  setPos(x: any, y: any, animate: any, callback: any): void {
    this.getGraphics().setPos(x, y, animate, callback);
  }

  getType(): any {
    return this._type;
  }

  remove(): void {
    this.getGraphics().remove();
  }

  getComments(): any {
    return this._comments;
  }

  setComments(comment: any): void {
    this._comments = comment;
  }

  getProperties(): any {
    const info: any = {};
    if (this.getComments() != '') {
      info['comments'] = this.getComments();
    }
    return info;
  }

  assignProperties(properties: any): any {
    if (properties.hasOwnProperty('comments') && this.getComments() != properties.comments) {
      this.setComments(properties.comments);
    }
    return true;
  }

  onWidgetHide(): void {
    this.getGraphics().getHoverBox() && this.getGraphics().getHoverBox().onWidgetHide();
  }

  onWidgetShow(): void {
    this.getGraphics().getHoverBox() && this.getGraphics().getHoverBox().onWidgetShow();
  }
}

export const ChildlessBehavior = {
  getChildlessStatus(this: any): any {
    return this._childlessStatus;
  },

  isValidChildlessStatus(this: any, status: any): boolean {
    return status == 'infertile' || status == 'childless';
  },
};
