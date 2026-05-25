import { generateOrb } from 'pedigree/view/graphicHelpers';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

export default class AbstractHoverbox {
  _node: any;
  _relativeX: any;
  _relativeY: any;
  _nodeX: any;
  _nodeY: any;
  _hidden: any;
  _enabled: any;
  _width: any;
  _height: any;
  _isHovered: any;
  _currentHandles: any;
  _currentOrbs: any;
  _currentButtons: any;
  _handlesZoomSz: any;
  _boxOnHover: any;
  _backElements: any;
  _mask: any;
  _frontElements: any;
  _isMenuToggled: any;
  _justClosedMenu: any;

  constructor(node: any, shiftX: any, shiftY: any, width: any, height: any, nodeX: any, nodeY: any, nodeShapes: any) {
    const me: any = this;
    this._node = node;
    this._relativeX = shiftX;
    this._relativeY = shiftY;
    this._nodeX = nodeX;
    this._nodeY = nodeY;
    this._hidden = true;
    this._enabled = false;
    this._width = width;
    this._height = height;
    this._isHovered = false;
    this._currentHandles = null;
    this._currentOrbs = null;
    this._currentButtons = null;
    this._handlesZoomSz = null;
    this._boxOnHover = editor.getPaper().rect(this.getX(), this.getY(), this._width, this._height, 5).attr(PedigreeEditorParameters.attributes.boxOnHover);
    this._backElements = editor.getPaper().set(this._boxOnHover);
    this._mask = this._boxOnHover.clone().attr({ fill: 'green', opacity: 0 });
    this._frontElements = editor.getPaper().set().push(this._mask);

    const nodeShapeSet = nodeShapes.flatten();
    this._backElements.insertBefore(nodeShapeSet);
    this._frontElements.insertAfter(nodeShapeSet);

    (this as any).animateDrawHoverZone = this.animateDrawHoverZone.bind(this);
    (this as any).animateHideHoverZone = this.animateHideHoverZone.bind(this);
    this.getBoxOnHover().attr({ opacity: 0 });
    this.enable();
    this._isMenuToggled = false;
    this._justClosedMenu = false;
  }

  getX(): any {
    return this.getNodeX() + this._relativeX;
  }

  getY(): any {
    return this.getNodeY() + this._relativeY;
  }

  getNodeX(): any {
    const nodeGraphics = this.getNode().getGraphics();
    if (nodeGraphics) {
      this._nodeX = nodeGraphics.getX();
    }
    return this._nodeX;
  }

  getNodeY(): any {
    const nodeGraphics = this.getNode().getGraphics();
    if (nodeGraphics) {
      this._nodeY = nodeGraphics.getY();
    }
    return this._nodeY;
  }

  getWidth(): any {
    return this._width;
  }

  getHeight(): any {
    return this._height;
  }

  getNode(): any {
    return this._node;
  }

  generateButtons(): void {
    if (this._currentButtons !== null) {
      return;
    }
    this._currentButtons = [];
  }

  regenerateButtons(): void {
    this.removeButtons();
    this.generateButtons();
  }

  removeButtons(): void {
    if (!this._currentButtons) {
      return;
    }
    const enableState = this._enabled;
    enableState && this.disable();
    for (let i = 0; i < this._currentButtons.length; i++) {
      this.getFrontElements().exclude(this._currentButtons[i]);
      this._currentButtons[i].remove();
    }
    this._currentButtons = null;
    enableState && this.enable();
  }

  hideButtons(): void {
    if (!this._currentButtons) {
      return;
    }
    for (let i = 0; i < this._currentButtons.length; i++) {
      if (this._currentButtons[i].hasOwnProperty('mask')) {
        this._currentButtons[i].mask.attr(PedigreeEditorParameters.attributes.btnMaskHoverOff);
      }
      this._currentButtons[i].hide();
    }
  }

  showButtons(): void {
    if (!this._currentButtons) {
      return;
    }
    for (let i = 0; i < this._currentButtons.length; i++) {
      this._currentButtons[i].show();
    }
  }

  getCurrentButtons(): any {
    return this._currentButtons;
  }

  removeHandles(): void {
    if (!this._currentHandles) {
      return;
    }
    const enableState = this._enabled;
    enableState && this.disable();
    for (let i = 0; i < this._currentOrbs.length; i++) {
      this.getFrontElements().exclude(this._currentOrbs[i]);
    }
    this._currentOrbs = null;
    enableState && this.enable();

    for (let i = 0; i < this._currentHandles.length; i++) {
      this._currentHandles[i].remove();
    }
    this._currentHandles = null;
  }

  hideHandles(): void {
    if (!this._currentHandles) {
      return;
    }
    for (let i = 0; i < this._currentHandles.length; i++) {
      this._currentHandles[i].hide();
    }
  }

  showHandles(): void {
    if (!this._currentHandles) {
      return;
    }
    for (let i = 0; i < this._currentHandles.length; i++) {
      this._currentHandles[i].show();
    }
  }

  generateHandles(): void {
    if (this._currentHandles !== null) {
      return;
    }
    this._currentHandles = [];
    this._currentOrbs = [];
    this._handlesZoomSz = editor.getWorkspace().getCurrentZoomLevel();
  }

  regenerateHandles(): void {
    if (this._currentHandles) {
      this.removeHandles();
    }
    if (!this._hidden || this.isMenuToggled()) {
      this.generateHandles();
    }
  }

  createButton(x: any, y: any, svgPath: any, svgPathBBox: any, attributes: any, onClick: any, className: any, title: any): void {
    const icon = editor.getPaper().path(svgPath).attr(attributes);
    icon.transform(['t', x, y]);

    const xShift = svgPathBBox.width / 4;
    const yShift = svgPathBBox.height / 4;
    const newWidth = svgPathBBox.width * 1.5;
    const newHeight = svgPathBBox.height * 1.5;
    const mask = editor.getPaper().rect(x + svgPathBBox.x - xShift, y + svgPathBBox.y - yShift, newWidth, newHeight, 1);
    mask.attr({ fill: 'gray', opacity: 0, 'stroke-width': 0 });

    const button = editor.getPaper().set(mask, icon).toFront();

    const me: any = this;
    const clickFunct = function () {
      if (me._hidden) {
        button.isClicked = false;
        return;
      }
      button.isClicked = !button.isClicked;
      if (button.isClicked) {
        mask.attr(PedigreeEditorParameters.attributes.btnMaskClick);
      } else {
        mask.attr(PedigreeEditorParameters.attributes.btnMaskHoverOn);
      }
      onClick && onClick();
    };
    button.click(clickFunct);
    button.mousedown(function () {
      mask.attr(PedigreeEditorParameters.attributes.btnMaskClick);
    });
    button.hover(
      function () {
        mask.attr(PedigreeEditorParameters.attributes.btnMaskHoverOn);
        if (title) {
          mask.attr({ title: title });
        }
      },
      function () {
        mask.attr(PedigreeEditorParameters.attributes.btnMaskHoverOff);
      }
    );
    className &&
      button.forEach(function (element: any) {
        element.node.setAttribute('class', className);
      });
    button.icon = icon;
    button.mask = mask;
    if (this._hidden && !this.isMenuToggled()) {
      button.hide();
    }

    this._currentButtons.push(button);
    this.disable();
    this.getFrontElements().push(button);
    this.enable();
  }

  generateMenuBtn(): void {
    const me: any = this;
    const action = function () {
      me.toggleMenu(!me.isMenuToggled());
    };
    const attributes = PedigreeEditorParameters.attributes.menuBtnIcon;
    const x = this.getX() + this.getWidth() - 20 - this.getWidth() / 40;
    const y = this.getY() + this.getHeight() / 40;
    this.createButton(x, y, editor.getView().__menuButton_svgPath, editor.getView().__menuButton_BBox, attributes, action, 'menu-trigger', 'node properties');
  }

  generateDeleteBtn(): void {
    const me: any = this;
    const action = function () {
      me.animateHideHoverZone();
      const event = { nodeID: me.getNode().getID() };
      document.dispatchEvent(new CustomEvent('pedigree:node:remove', { detail: event }));
    };
    const attributes = PedigreeEditorParameters.attributes.deleteBtnIcon;
    const x = this.getX() + this.getWidth() - 20 - this.getWidth() / 40;
    const y = this.getY() + this.getHeight() / 40;
    this.createButton(x, y, editor.getView().__deleteButton_svgPath, editor.getView().__deleteButton_BBox, attributes, action, 'delete', 'remove node');
  }

  getBoxOnHover(): any {
    return this._boxOnHover;
  }

  isHovered(): any {
    return this._isHovered;
  }

  setHovered(isHovered: any): void {
    this._isHovered = isHovered;
  }

  setHighlighted(isHighlighted: any): void {
    if (isHighlighted) {
      this.getBoxOnHover().attr(PedigreeEditorParameters.attributes.boxOnHover);
      this.getBoxOnHover().attr('fill', 'green');
    } else {
      this.getBoxOnHover().attr(PedigreeEditorParameters.attributes.boxOnHover).attr('opacity', 0);
    }
  }

  getHoverZoneMask(): any {
    return this._mask;
  }

  getFrontElements(): any {
    return this._frontElements;
  }

  getBackElements(): any {
    return this._backElements;
  }

  generateHandle(type: any, startX: any, startY: any, orbX: any, orbY: any, title?: any, toHide?: any): any {
    const strokeWidth = editor.getWorkspace().getSizeNormalizedToDefaultZoom(PedigreeEditorParameters.attributes.handleStrokeWidth);
    const path = [['M', startX, startY], ['L', orbX, orbY]];
    const connection = editor.getPaper().path(path).attr({ 'stroke-width': strokeWidth, stroke: 'gray' }).toBack();
    connection.oPath = path;

    const touchPresent = 'createTouch' in document;
    const orbRadius = touchPresent ? PedigreeEditorParameters.attributes.touchOrbRadius : PedigreeEditorParameters.attributes.orbRadius;
    const orbHue = PedigreeEditorParameters.attributes.orbHue;

    const normalOrbAttr = { fill: 'r(.5,.9)hsb(' + orbHue + ', 1, .75)-hsb(' + orbHue + ', .5, .25)', stroke: 'none' };
    const selectedOrbAttr = { fill: 'r(.5,.9)hsb(' + (orbHue + 0.36) + ', 1, .75)-hsb(' + (orbHue + 0.36) + ', .5, .25)' };
    const orbAttrX = 'cx';
    const orbAttrY = 'cy';

    const orb = generateOrb(editor.getPaper(), orbX, orbY, orbRadius * 1.1).attr('cursor', 'pointer');
    orb[0].attr(normalOrbAttr);

    const handle: any = editor.getPaper().set().push(connection, orb);
    handle.type = type;
    connection.insertBefore(this.getHoverZoneMask());
    orb.toFront();

    const me: any = this;
    let inHoverMode = false;
    let interactionStarted = false;

    const onDragHandle = function () {
      if (!inHoverMode) {
        inHoverMode = true;
        if (editor.getView().getCurrentDraggable() !== null) {
          editor.getView().enterHoverMode(me.getNode(), type);
        }
        toHide && toHide.hide();
      }
    };

    let wrongClick = false;
    const start = function (x: any, y: any, e: any) {
      if (interactionStarted) {
        return;
      }
      interactionStarted = true;

      wrongClick = false;
      if (e.button != 0) {
        interactionStarted = false;
        wrongClick = true;
        return;
      }
      connection.toFront();
      orb.stop();
      orb.toFront();
      inHoverMode = false;
      me.disable();
      me.getFrontElements().toFront();
      if (!orb.ot) {
        orb.ot = orb[0].transform();
        orb.ox = orb[0].attr(orbAttrX);
        orb.oy = orb[0].attr(orbAttrY);
      } else {
        orb.transform('');
        orb.attr(orbAttrX, orb.ox);
        orb.attr(orbAttrY, orb.oy);
        orb.transform(orb.ot);
      }
      connection.ox = connection.oPath[1][1];
      connection.oy = connection.oPath[1][2];
      handle.isDragged = false;
      editor.getView().setCurrentDraggable(me.getNode().getID());
      setTimeout(onDragHandle, 100);
    };

    const move = function (dx: any, dy: any) {
      if (wrongClick) {
        return;
      }
      if (!interactionStarted) {
        return;
      }
      onDragHandle();
      dx = dx / editor.getWorkspace().zoomCoefficient;
      dy = dy / editor.getWorkspace().zoomCoefficient;
      orb.ot.length > 0 && orb.transform('');
      orb.attr(orbAttrX, orb.ox + dx);
      orb.attr(orbAttrY, orb.oy + dy);
      orb.ot.length > 0 && orb.transform(orb.ot);
      connection.oPath[1][1] = connection.ox + dx;
      connection.oPath[1][2] = connection.oy + dy;
      connection.attr('path', connection.oPath);
      if (dx > 1 || dx < -1 || dy > 1 || dy < -1) {
        handle.isDragged = true;
      }
    };

    const end = function () {
      inHoverMode = false;
      interactionStarted = false;
      if (wrongClick) {
        return;
      }

      const curHoveredId = editor.getView().getCurrentHoveredNode();

      editor.getView().setCurrentDraggable(null);
      editor.getView().exitHoverMode();

      if (handle.isDragged) {
        if (orb.ot.length == 0) {
          const finalPosition: any = {};
          finalPosition[orbAttrX] = orb.ox;
          finalPosition[orbAttrY] = orb.oy;
          orb.animate(finalPosition, 1000, 'elastic', function () {});
        } else {
          const dx = orb.ox - orb[0].attr(orbAttrX);
          const dy = orb.oy - orb[0].attr(orbAttrY);
          orb.animate({ transform: 'T' + dx + ',' + dy + 'R45' }, 1000, 'elastic', function () {
            orb.transform('');
            orb.attr(orbAttrX, orb.ox);
            orb.attr(orbAttrY, orb.oy);
            orb.transform(orb.ot);
          });
        }
      }

      connection.oPath[1][1] = connection.ox;
      connection.oPath[1][2] = connection.oy;
      connection.animate({ path: connection.oPath }, 1000, 'elastic');
      orb[0].attr(normalOrbAttr);
      connection.insertBefore(me.getHoverZoneMask());

      me.enable();

      if (!handle.isDragged || curHoveredId != null) {
        me.handleAction(handle.type, handle.isDragged, curHoveredId);
      }
    };

    orb.drag(move, start, end);
    orb.hover(
      function () {
        orb[0].attr(selectedOrbAttr);
        if (title) {
          orb[0].attr({ title: title });
          orb[1].attr({ title: title });
        }
      },
      function () {
        orb[0].attr(normalOrbAttr);
      }
    );

    this._currentOrbs.push(orb[0]);
    this._currentOrbs.push(orb[1]);
    this.disable();
    this.getFrontElements().push(orb[0]);
    this.getFrontElements().push(orb[1]);
    this.enable();

    return handle;
  }

  isMenuToggled(): any {
    return false;
  }

  animateDrawHoverZone(): void {
    this._hidden = false;
    if (editor.getView().getCurrentDraggable() !== null) {
      return;
    }

    this.getNode().getGraphics().setSelected(true);
    this.getBoxOnHover().stop().animate({ opacity: 0.7 }, 200);

    this.generateButtons();
    this.showButtons();
    this.getCurrentButtons().forEach(function (button: any) {
      if (button.hasOwnProperty('icon')) {
        button.icon.stop().animate({ opacity: 1 }, 200);
      }
    });

    if (this._handlesZoomSz != editor.getWorkspace().getCurrentZoomLevel()) {
      this.removeHandles();
    }
    this.generateHandles();
    this.showHandles();
  }

  animateHideHoverZone(): void {
    this._hidden = true;
    if (editor.getView().getCurrentDraggable() !== null) {
      return;
    }

    this.getNode().getGraphics().setSelected(false);
    this.getBoxOnHover().stop().animate({ opacity: 0 }, 200);

    this.hideButtons();
    this.hideHandles();
  }

  disable(): void {
    this._enabled = false;
    this.getFrontElements().unhover(this.animateDrawHoverZone, this.animateHideHoverZone);
  }

  enable(): void {
    this._enabled = true;
    this.getFrontElements().hover(this.animateDrawHoverZone, this.animateHideHoverZone);
  }

  remove(): void {
    this.disable();
    this.removeButtons();
    this.removeHandles();
    this.getBackElements().remove();
    this.getFrontElements().remove();
  }

  onWidgetHide(): void {
    this._isMenuToggled = false;
    this._justClosedMenu = true;
    const me: any = this;
    setTimeout(function () {
      me._justClosedMenu = false;
    }, 100);

    if (this._hidden) {
      this.animateHideHoverZone();
    } else {
      this.animateDrawHoverZone();
    }
  }

  onWidgetShow(): void {
    this._isMenuToggled = true;
  }
}
