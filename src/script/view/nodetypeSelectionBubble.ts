/**
 * The UI element ("bubble") that contains options for the creation of a new node.
 *
 * @class NodetypeSelectionBubble
 * @constructor
 */

export default class NodetypeSelectionBubble {
  _siblingMode: any;
  element: any;
  expandedOptionsContainer: any;
  numPersonsInGroup: any;
  numTwinNodes: any;
  _node: any;
  _onClickOutside: any;

  //The skeleton for the bubble contents
  buttonsDefs: any[] = [
    {
      key: 'M',
      type: 'person',
      label: 'Male',
      tip  : 'Create a person of male gender',
      symbol: '▢',
      cssclass: '',
      callback : 'CreateChild',
      params: { parameters: {'gender': 'M'} },
      inSiblingMode: true
    }, {
      key: 'F',
      type: 'person',
      label: 'Female',
      tip  : 'Create a person of female gender',
      symbol: '◯',
      cssclass: '',
      callback : 'CreateChild',
      params: { parameters: {'gender': 'F'} },
      inSiblingMode: true
    }, {
      key: 'U',
      type: 'person',
      label: 'Unknown',
      tip  : 'Create a person of unknown gender',
      symbol: '◇',
      cssclass: '',
      callback : 'CreateChild',
      params: { parameters: {'gender': 'U'} },
      inSiblingMode: true
    }, {
      key: 'T',
      type: 'person',
      label: 'Twins',
      tip  : 'Create twins (expandable to triplets or more)',
      symbol: '⋀',
      cssclass: '',
      callback : 'CreateChild',
      params: { 'twins': true, 'parameters': {'gender': 'U'} },
      expandsTo: 'expandTwins',
      inSiblingMode: true
    },
    {
      key: 'm',
      type: 'person',
      label: 'Multiple',
      tip  : 'Create a node representing multiple siblings',
      symbol: '〈n〉',
      cssclass: '',
      callback : 'CreateChild',
      params: { 'group': true },
      expandsTo: 'expandPersonGroup',
      inSiblingMode: true
    }, {
      type: 'separator'
    }, {
      key: 'n',
      type: 'marker',
      label: 'No children',
      tip  : 'Mark as childless by choice',
      symbol: '┴',
      cssclass: '',
      callback : 'setProperty',
      params: { setChildlessStatus: 'childless' },
      inSiblingMode: false
    }, {
      key: 'i',
      type: 'marker',
      label: 'Infertile',
      tip  : 'Mark as infertile',
      symbol: '╧',
      cssclass: '',
      callback : 'setProperty',
      params: { setChildlessStatus: 'infertile' },
      inSiblingMode: false
    }
  ];

  constructor(siblingMode: any) {
    this._siblingMode = siblingMode;

    this.element = document.createElement('div');
    this.element.className = 'callout';
    const handle = document.createElement('span');
    handle.className = 'callout-handle';
    this.element.appendChild(handle);

    var container = document.createElement('div');
    container.className = 'node-type-options';
    this.expandedOptionsContainer = document.createElement('div');
    this.expandedOptionsContainer.className = 'node-type-options-extended';
    this.element.appendChild(container);
    this.element.appendChild(this.expandedOptionsContainer);

    var _this = this;
    this.buttonsDefs.forEach(function(def: any) {
      if (!siblingMode || (def.hasOwnProperty('inSiblingMode') && def.inSiblingMode)) {
        container.appendChild(def.type == 'separator' ? _this._generateSeparator() : _this._createOption(def));
      }
    });
    this.element.style.display = 'none';
    editor.getWorkspace().getWorkArea().appendChild(this.element);

    this._onClickOutside = this._onClickOutside.bind(this);

    this.resetParameters();
  }

  resetParameters(): any {
    this.numPersonsInGroup = 1;
    this.numTwinNodes      = 2;
  }

  /**
     * Creates a button in the bubble corresponding do the definition from the skeleton
     *
     * @method _createOption
     * @param data The definition object from the bubble skeleton
     * @return {HTMLElement} The span containing the button
     * @private
     */
  _createOption(data: any): any {
    if(!data) {
      return null;
    }
    var expandablePrefix = (typeof (this as any)[data.expandsTo] == 'function') ? 'expandable-' : '';
    var o = document.createElement('a');
    o.className = data.cssclass + ' ' + expandablePrefix + 'node-type-option ' + (data.type || '') + '-type-option node-type-' + data.key;
    o.title = data.tip;
    o.href = '#';
    o.textContent = data.symbol; // TODO: eliminate symbol, do ".textContent = data.label", add style (icons)
    var _this = this;
    o.addEventListener('click', function(event: any) {
      event.preventDefault();
      event.stopPropagation();
      if (!_this._node) {
        return;
      }
      console.log('observe nodetype click: ' + data.callback);
      if (data.callback == 'setProperty') {
        var fireEvent: any = { 'nodeID': _this._node.getID(), 'properties': data.params };
        document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: fireEvent }));
      } else if (data.callback == 'CreateChild') {
        _this.handleCreateAction(data);
      }
      _this.hide();
    });
    var container = document.createElement('span');
    container.appendChild(o);
    if (expandablePrefix) {
      container.appendChild(this.generateExpandArrow(data));
    }
    return container;
  }

  handleCreateAction(data: any): any {
    var id       = this._node.getID();
    var nodeType = this._node.getType();
    if (nodeType == 'Person') {
      var event: any = { 'personID': id, 'childParams': data.params.parameters, 'preferLeft': false };
      if (data.params.twins) {
        event['twins'] = this.numTwinNodes;
      }
      if (data.params.group) {
        event['groupSize'] = this.numPersonsInGroup;
      }

      if (this._siblingMode) {
        document.dispatchEvent(new CustomEvent('pedigree:person:newsibling', { detail: event }));
      } else {
        document.dispatchEvent(new CustomEvent('pedigree:person:newpartnerandchild', { detail: event }));
      }
    } else if (nodeType == 'Partnership') {
      var event: any = { 'partnershipID': id, 'childParams': data.params.parameters };
      if (data.params.twins) {
        event['twins'] = this.numTwinNodes;
      }
      if (data.params.group) {
        event['groupSize'] = this.numPersonsInGroup;
      }
      document.dispatchEvent(new CustomEvent('pedigree:partnership:newchild', { detail: event }));
    }
    this.hide();
  }

  /**
     * Creates an arrow button that expands or shrinks the bubble
     *
     * @method generateExpandArrow
     * @param data The definition object from the bubble skeleton
     * @return {HTMLElement} The span containing the button
     */
  generateExpandArrow(data: any): any {
    var expandArrow = document.createElement('span');
    expandArrow.className = 'expand-arrow collapsed';
    expandArrow.title = 'show more options';
    expandArrow.textContent = '▾';

    (expandArrow as any).expand = function(this: any) {
      Array.from(document.querySelectorAll('.expand-arrow')).forEach(function(arrow: any) {
        arrow.collapse();
      });
      (this as any)[data.expandsTo](data);
      expandArrow.textContent = '▴';
      expandArrow.classList.remove('collapsed');
    }.bind(this);

    (expandArrow as any).collapse = function(this: any) {
      this.expandedOptionsContainer.replaceChildren();
      expandArrow.textContent = '▾';
      expandArrow.classList.add('collapsed');
    }.bind(this);

    expandArrow.addEventListener('click', function() {
      console.log('observe2');
      if(expandArrow.classList.contains('collapsed')) {
        (expandArrow as any).expand();
      } else {
        (expandArrow as any).collapse();
      }
    });
    return expandArrow;
  }

  /**
     * Creates a line to separate buttons in the bubble
     *
     * @method _generateSeparator
     * @return {HTMLElement}
     * @private
     */
  _generateSeparator(): any {
    var sep = document.createElement('span');
    sep.className = 'separator';
    sep.textContent = ' | ';
    return sep;
  }

  /**
     * Repositions the bubble to the given coordinates coordinates
     *
     * @method _positionAt
     * @param {Number} x The x coordinate in the viewport
     * @param {Number} y The y coordinate in the viewport
     * @private
     */
  _positionAt(x: any, y: any): any {
    y = Math.round(y);
    var workArea = editor.getWorkspace().getWorkArea();
    if (y + this.element.offsetHeight > workArea.offsetHeight) {
      this.element.classList.add('upside');
      y = Math.round(y - this.element.offsetHeight);
    }
    this.element.style.top = y + 'px';
    var dx = Math.round(this.element.offsetWidth / 2);
    if (x - dx + this.element.offsetWidth > workArea.offsetWidth) {
      dx = Math.round(this.element.offsetWidth - (workArea.offsetWidth - x));
    } else if (dx > x) {
      dx = Math.round(x);
    }
    this.element.querySelector('.callout-handle').style.left = dx + 'px';
    this.element.style.left = Math.round(x - dx) + 'px';
  }

  /**
     * Displays the bubble for the specified node
     *
     * @method show
     * @param {AbstractNode} node The node for which the bubble is displayed
     * @param {Number} x The x coordinate in the viewport
     * @param {Number} y The y coordinate in the viewport
     */
  show(node: any, x: any, y: any): any {
    this._node = node;
    if (!this._node) {
      return;
    }
    this._node.onWidgetShow();
    this.element.style.display = '';
    this.expandedOptionsContainer.replaceChildren();
    this._positionAt(x, y);
    document.addEventListener('mousedown', this._onClickOutside);
  }

  /**
     * Hides the bubble from the viewport
     *
     * @method hide
     */
  hide(): any {
    document.removeEventListener('mousedown', this._onClickOutside);
    Array.from(document.querySelectorAll('.expand-arrow')).forEach(function(arrow: any) {
      arrow.collapse();
    });
    if (this._node) {
      this._node.onWidgetHide();
      delete this._node;
      // reset the state
      Array.from(this.element.querySelectorAll('.node-type-option')).forEach((el: any) => el.style.display = '');
      this.element.classList.remove('upside');
    }
    this.element.style.display = 'none';
    this.resetParameters();  // reset number of twins/number of persons
  }

  /**
     * Hides the bubble if the user clicks outside
     *
     * @method _onClickOutside
     * @param {Event} event
     * @private
     */
  _onClickOutside(event: any): any {
    if (!event.target.closest('.callout')) {
      this.hide();
    }
  }

  /**
     * Decrement the number of nodes to be created
     *
     * @method _decrementNumNodes
     * @return {Number} The resulting number of nodes to be created
     * @private
     */
  _decrementNumNodes(): any {
    return this.numPersonsInGroup > 1 ? --this.numPersonsInGroup : this.numPersonsInGroup;
  }

  /**
     * Increment the number of nodes to be created
     *
     * @method _incrementNumNodes
     * @return {Number} The resulting number of nodes to be created
     * @private
     */
  _incrementNumNodes(): any {
    return this.numPersonsInGroup < 9 ? ++this.numPersonsInGroup : this.numPersonsInGroup;
  }

  /**
     * Decrement the number of twins to be created
     *
     * @method _decrementNumTwins
     * @return {Number} The resulting number of twins to be created
     * @private
     */
  _decrementNumTwins(): any {
    return this.numTwinNodes > 2 ? --this.numTwinNodes : this.numTwinNodes;
  }

  /**
     * Increment the number of twins to be created
     *
     * @method _incrementNumTwins
     * @return {Number} The resulting number of twins to be created
     * @private
     */
  _incrementNumTwins(): any {
    return this.numTwinNodes < 9 ? ++this.numTwinNodes : this.numTwinNodes;
  }

  /**
     * Expand the bubble and show additional options for creation of PersonGroup nodes
     *
     * @method expandPersonGroup
     */
  expandPersonGroup(personGroupMenuInfo: any): any {
    var me = this;
    var generateIcon = function(){
      var iconText = (me.numPersonsInGroup > 1) ? String(me.numPersonsInGroup) : 'n';
      return '<svg version="1.1" viewBox="0.0 0.0 100.0 100.0" width=50 height=50 fill="none" stroke="none" stroke-linecap="square" stroke-miterlimit="10" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><clipPath id="p.0"><path d="m0 0l960.0 0l0 720.0l-960.0 0l0 -720.0z" clip-rule="nonzero"></path></clipPath><g clip-path="url(#p.0)"><path fill="#000000" fill-opacity="0.0" d="m0 0l960.0 0l0 720.0l-960.0 0z" fill-rule="nonzero"></path><path fill="#cfe2f3" d="m1.2283465 49.97113l48.53543 -48.535435l48.53543 48.535435l-48.53543 48.53543z" fill-rule="nonzero"></path><path stroke="#000000" stroke-width="2.0" stroke-linejoin="round" stroke-linecap="butt" d="m1.2283465 49.97113l48.53543 -48.535435l48.53543 48.535435l-48.53543 48.53543z" fill-rule="nonzero"></path><path fill="#000000" fill-opacity="0.0" d="m20.661417 22.068241l58.204727 0l0 48.000004l-58.204727 0z" fill-rule="nonzero"></path></g><desc>Number of children</desc><text x="35" y="60" font-family="Verdana" font-size="40" fill="black">'
                    + iconText + '</text></svg>';

    };
    var createBtn = document.createElement('input');
    createBtn.type = 'button';
    createBtn.value = 'create';
    createBtn.className = 'button';
    var svgContainer = document.createElement('span');
    svgContainer.innerHTML = generateIcon();
    var minusBtn = document.createElement('span');
    minusBtn.className = 'minus-button value-control-button';
    minusBtn.textContent = '-';
    var plusBtn = document.createElement('span');
    plusBtn.className = 'plus-button value-control-button';
    plusBtn.textContent = '+';
    minusBtn.addEventListener('click', function() {
      me._decrementNumNodes(); svgContainer.innerHTML = generateIcon();
    });
    plusBtn.addEventListener('click', function() {
      me._incrementNumNodes(); svgContainer.innerHTML = generateIcon();
    });
    createBtn.addEventListener('click', function() {
      me.handleCreateAction(personGroupMenuInfo);
    });
    this.expandedOptionsContainer.appendChild(minusBtn);
    this.expandedOptionsContainer.appendChild(svgContainer);
    this.expandedOptionsContainer.appendChild(plusBtn);
    this.expandedOptionsContainer.appendChild(createBtn);
  }

  /**
     * Expand the bubble and show additional options for creation of twin nodes
     *
     * @method expandTwins
     */
  expandTwins(twinMenuInfo: any): any {
    var me = this;
    var generateIcon = function(){
      return '<svg version="1.1" viewBox="0.0 0.0 100.0 100.0" width=50 height=50 fill="none" stroke="none" stroke-linecap="square" stroke-miterlimit="10" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><clipPath id="p.0"><path d="m0 0l960.0 0l0 720.0l-960.0 0l0 -720.0z" clip-rule="nonzero"></path></clipPath><g clip-path="url(#p.0)"><path fill="#000000" fill-opacity="0.0" d="m0 0l960.0 0l0 720.0l-960.0 0z" fill-rule="nonzero"></path><path fill="#cfe2f3" d="m1.2283465 49.97113l48.53543 -48.535435l48.53543 48.535435l-48.53543 48.53543z" fill-rule="nonzero"></path><path stroke="#000000" stroke-width="2.0" stroke-linejoin="round" stroke-linecap="butt" d="m1.2283465 49.97113l48.53543 -48.535435l48.53543 48.535435l-48.53543 48.53543z" fill-rule="nonzero"></path><path fill="#000000" fill-opacity="0.0" d="m20.661417 22.068241l58.204727 0l0 48.000004l-58.204727 0z" fill-rule="nonzero"></path></g><desc>Number of children</desc><text x="35" y="60" font-family="Verdana" font-size="40" fill="black">'
                + me.numTwinNodes + '</text></svg>';
    };
    var createBtn = document.createElement('input');
    createBtn.type = 'button';
    createBtn.value = 'create';
    createBtn.className = 'button';
    var svgContainer = document.createElement('span');
    svgContainer.innerHTML = generateIcon();
    var minusBtn = document.createElement('span');
    minusBtn.className = 'minus-button value-control-button';
    minusBtn.textContent = '-';
    var plusBtn = document.createElement('span');
    plusBtn.className = 'plus-button value-control-button';
    plusBtn.textContent = '+';
    minusBtn.addEventListener('click', function() {
      me._decrementNumTwins(); svgContainer.innerHTML = generateIcon();
    });
    plusBtn.addEventListener('click',  function() {
      me._incrementNumTwins(); svgContainer.innerHTML = generateIcon();
    });
    createBtn.addEventListener('click', function() {
      me.handleCreateAction(twinMenuInfo);
    });
    this.expandedOptionsContainer.appendChild(minusBtn);
    this.expandedOptionsContainer.appendChild(svgContainer);
    this.expandedOptionsContainer.appendChild(plusBtn);
    this.expandedOptionsContainer.appendChild(createBtn);
  }
}
