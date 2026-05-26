import Raphael from 'pedigree/raphael';

/**
 * Workspace contains the Raphael canvas, the zoom/pan controls and the menu bar
 * on the top. The class includes functions for managing the Raphael paper object and coordinate transformation methods
 * for taking pan and zoom levels into account.
 *
 * @class Workspace
 * @constructor
 */

export default class Workspace {
    canvas: any;
    workArea: any;
    width: any;
    height: any;
    _paper: any;
    viewBoxX: any;
    viewBoxY: any;
    zoomCoefficient: any;
    background: any;
    adjustSizeToScreen: any;
    handleMouseWheel: any;
    zoomSlider: any;
    __controls: any;
    __pan: any;
    __zoom: any;

    constructor() {
        var me = this;
        this.canvas = document.createElement('div');
        this.canvas.id = 'canvas';
        this.workArea = document.createElement('div');
        this.workArea.id = 'work-area';
        this.workArea.appendChild(this.canvas);
        document.body.appendChild(this.workArea);
        var screenDimensions = { width: window.innerWidth, height: window.innerHeight };
        this.generateTopMenu();
        this.width = screenDimensions.width;
        this.height = screenDimensions.height - this.canvas.getBoundingClientRect().top - 4;
        this._paper = Raphael('canvas',this.width, this.height);
        this.viewBoxX = 0;
        this.viewBoxY = 0;
        this.zoomCoefficient = 1;

        this.background = this.getPaper().rect(0,0, this.width, this.height).attr({fill: 'blue', stroke: 'none', opacity: 0}).toBack();
        this.background.node.setAttribute('class', 'panning-background');

        var attribution = document.createElement('div');
        attribution.id = 'attribution';
        attribution.innerHTML = '&copy; 2019 <a href="https://gene42.com">Gene42 Inc.</a>';
        this.workArea.appendChild(attribution);

        this.adjustSizeToScreen = this._adjustSizeToScreen.bind(this);
        window.addEventListener('resize', me.adjustSizeToScreen);
        this.generateViewControls();

        //Initialize pan by dragging
        var start = function() {
            if (editor.isAnyMenuVisible()) {
                return;
            }
            me.background.ox = me.background.attr('x');
            me.background.oy = me.background.attr('y');
            me.background.attr({cursor: 'move'});
        };
        var move = function(dx: any, dy: any) {
            var deltax = me.viewBoxX - dx/me.zoomCoefficient;
            var deltay = me.viewBoxY - dy/me.zoomCoefficient;

            me.getPaper().setViewBox(deltax, deltay, me.width/me.zoomCoefficient, me.height/me.zoomCoefficient);
            me.background.ox = deltax;
            me.background.oy = deltay;
            me.background.attr({x: deltax, y: deltay });
        };
        var end = function() {
            me.viewBoxX = me.background.ox;
            me.viewBoxY = me.background.oy;
            me.background.attr({cursor: 'default'});
        };
        me.background.drag(move, start, end);

        if (document.addEventListener) {
            // adapted from from raphaelZPD
            me.handleMouseWheel = function(evt: any) {
                if (evt.preventDefault) {
                    evt.preventDefault();
                } else {
                    evt.returnValue = false;
                }

                // disable while menu is active - too easy to scroll and get the active node out of sight, which is confusing
                if (editor.isAnyMenuVisible()) {
                    return;
                }

                var delta;
                if (evt.wheelDelta) {
                    delta = -evt.wheelDelta;
                } // Chrome/Safari
                else {
                    delta = evt.detail;
                } // Mozilla

                if (delta > 0) {
                    me.__zoom['out'].click();
                } else {
                    me.__zoom['in'].click();
                }
            };

            if (navigator.userAgent.toLowerCase().indexOf('webkit') >= 0) {
                this.canvas.addEventListener('mousewheel', me.handleMouseWheel, false); // Chrome/Safari
            } else {
                this.canvas.addEventListener('DOMMouseScroll', me.handleMouseWheel, false); // Others
            }
        }
    }

    /**
     * Returns the Raphael paper object.
     *
     * @method getPaper
     * @return {Object} Raphael Paper element
     */
    getPaper(): any {
        return this._paper;
    }

    /**
     * Returns the div element containing everything except the top menu bar
     *
     * @method getWorkArea
     * @return {HTMLElement}
     */
    getWorkArea(): any {
        return this.workArea;
    }

    /**
     * Returns width of the work area
     *
     * @method getWidth
     * @return {Number}
     */
    getWidth(): any {
        return this.width;
    }

    /**
     * Returns height of the work area
     *
     * @method getHeight
     * @return {Number}
     */
    getHeight(): any {
        return this.height;
    }

    /**
     * Creates the menu on the top
     *
     * @method generateTopMenu
     */
    generateTopMenu(): any {
        var menu = document.createElement('div');
        menu.id = 'editor-menu';

        var titleLink = document.createElement('a');
        titleLink.className = 'title';
        titleLink.href = 'https://github.com/phenotips/open-pedigree';
        titleLink.textContent = 'Open Pedigree';
        menu.appendChild(titleLink);

        this.getWorkArea().insertAdjacentElement('beforebegin', menu);
        var submenus = [] as any[];

        if (editor.isUnsupportedBrowser()) {
            submenus = [{
                name : 'input',
                items: [
                    { key : 'readonlymessage', label : 'Unsuported browser mode', icon : 'exclamation-triangle'}
                ]
            }, {
                name : 'output',
                items: [
                    { key : 'export',    label : 'Export', icon : 'file-export'},
                    { key : 'close',     label : 'Close', icon : 'times'}
                ]
            }];
        } else {
            submenus = [{
                name : 'input',
                items: [
                    { key : 'templates', label : 'Templates', icon : 'copy'},
                    { key : 'import',    label : 'Import', icon : 'file-import'}
                ]
            }, {
                name : 'edit',
                items: [
                    { key : 'undo',   label : 'Undo', icon : 'undo'},
                    { key : 'redo',   label : 'Redo', icon : 'redo'}
                ]
            }, {
                name : 'reset',
                items: [
                    { key : 'clear',  label : 'Clear all', icon : 'times-circle'}
                ]
            }, {
                name : 'output',
                items: [
                    { key : 'export',    label : 'Export', icon : 'file-export'},
                    { key : 'save',    label : 'Save', icon : 'save'},
                    { key : 'close',     label : 'Close', icon : 'times'}
                ]
            }];
        }
        var _createMenuItem = function(data: any) {
            var mi = document.createElement('span');
            mi.id = 'action-' + data.key;
            mi.className = 'menu-item ' + data.key;
            var icon = document.createElement('span');
            icon.className = 'fas fa-' + data.icon;
            mi.appendChild(icon);
            mi.appendChild(document.createTextNode(' '));
            mi.appendChild(document.createTextNode(data.label));
            if (data.callback && typeof((this as any)[data.callback]) == 'function') {
                mi.addEventListener('click', function() {
                    (this as any)[data.callback]();
                });
            }
            return mi;
        };
        var _createSubmenu = function(data: any) {
            var submenu = document.createElement('div');
            submenu.className = data.name + '-actions action-group';
            menu.appendChild(submenu);
            data.items.forEach(function (item: any) {
                submenu.appendChild(_createMenuItem(item));
            });
        };
        submenus.forEach(_createSubmenu);

        var poweredBy = document.createElement('div');
        poweredBy.className = 'powered-by';
        poweredBy.appendChild(document.createTextNode('Powered by '));
        var phenotipsLink = document.createElement('a');
        phenotipsLink.href = 'https://phenotips.org/';
        phenotipsLink.textContent = 'PhenoTips';
        var sup = document.createElement('sup');
        sup.innerHTML = '&reg;';
        phenotipsLink.appendChild(sup);
        poweredBy.appendChild(phenotipsLink);
        menu.appendChild(poweredBy);
    }

    /**
     * Adjusts the canvas viewbox to the given zoom coefficient
     *
     * @method zoom
     * @param {Number} zoomCoefficient The zooming ratio
     */
    zoom(zoomCoefficient: any): any {
        if (zoomCoefficient < 0.15) {
            zoomCoefficient = 0.15;
        }
        if (zoomCoefficient > 0.15 && zoomCoefficient < 0.25) {
            zoomCoefficient = 0.25;
        }
        zoomCoefficient = Math.round(zoomCoefficient/0.05)/20;
        var newWidth  = this.width/zoomCoefficient;
        var newHeight = this.height/zoomCoefficient;
        this.viewBoxX = this.viewBoxX + (this.width/this.zoomCoefficient - newWidth)/2;
        this.viewBoxY = this.viewBoxY + (this.height/this.zoomCoefficient - newHeight)/2;
        this.getPaper().setViewBox(this.viewBoxX, this.viewBoxY, newWidth, newHeight);
        this.zoomCoefficient = zoomCoefficient;
        this.background.attr({x: this.viewBoxX, y: this.viewBoxY, width: newWidth, height: newHeight});
    }

    /**
     * Creates the controls for panning and zooming
     *
     * @method generateViewControls
     */
    generateViewControls(): any {
        var _this = this;
        this.__controls = document.createElement('div');
        this.__controls.className = 'view-controls';
        // Pan controls
        this.__pan = document.createElement('div');
        this.__pan.className = 'view-controls-pan';
        this.__pan.title = 'Pan';
        this.__controls.appendChild(this.__pan);
        ['up', 'right', 'down', 'left', 'home'].forEach(function (direction: any) {
            var faIconClass = (direction == 'home') ? 'fa-house' : 'fa-arrow-' + direction;
            _this.__pan[direction] = document.createElement('span');
            _this.__pan[direction].className = 'view-control-pan pan-' + direction + ' fas fa-fw ' + faIconClass;
            _this.__pan[direction].title = 'Pan ' + direction;
            _this.__pan.appendChild(_this.__pan[direction]);
            _this.__pan[direction].addEventListener('click', function(event: any) {
                if (direction == 'home') {
                    _this.centerAroundNode(0);
                } else if(direction == 'up') {
                    _this.panTo(_this.viewBoxX, _this.viewBoxY - 300);
                } else if(direction == 'down') {
                    _this.panTo(_this.viewBoxX, _this.viewBoxY + 300);
                } else if(direction == 'left') {
                    _this.panTo(_this.viewBoxX - 300, _this.viewBoxY);
                } else {
                    _this.panTo(_this.viewBoxX + 300, _this.viewBoxY);
                }
            });
        });
        // Zoom controls
        var trackLength = 200;
        this.__zoom = document.createElement('div');
        this.__zoom.className = 'view-controls-zoom';
        this.__zoom.title = 'Zoom';
        this.__controls.appendChild(this.__zoom);
        this.__zoom['in']  = document.createElement('div');
        this.__zoom['in'].className = 'zoom-button zoom-in fas fa-fw fa-search-plus';
        this.__zoom['in'].title = 'Zoom in';
        this.__zoom['out'] = document.createElement('div');
        this.__zoom['out'].className = 'zoom-button zoom-out fas fa-fw fa-search-minus';
        this.__zoom['out'].title = 'Zoom out';
        this.__zoom.label  = document.createElement('div');
        this.__zoom.label.className = 'zoom-crt-value';
        // Native range input replaces Scriptaculous Control.Slider.
        // Non-linear scale: slider positions [0, 0.9] → zoom coefficients [1.25x, 0.25x];
        // slider positions (0.9, 1] → deepest zoom level 0.15x. Range uses 0-1000 integers (÷1000).
        var rangeInput = document.createElement('input');
        rangeInput.type = 'range';
        rangeInput.className = 'zoom-slider';
        rangeInput.min = '0';
        rangeInput.max = '1000';
        rangeInput.step = '1';
        rangeInput.title = 'Drag to zoom';
        var applyZoomValue = function(v: number) {
            if (v <= 0.9) {
                _this.zoom(-v / 0.9 + 1.25);
            } else {
                _this.zoom(0.15);
            }
        };
        rangeInput.addEventListener('input', function() {
            applyZoomValue(parseInt(rangeInput.value) / 1000);
        });
        // Wrapper with setValue API to keep existing zoom button call sites unchanged
        this.zoomSlider = {
            setValue: function(v: number) {
                rangeInput.value = String(Math.round(Math.max(0, Math.min(1, v)) * 1000));
                applyZoomValue(v);
            }
        };
        this.__zoom.appendChild(this.__zoom['in']);
        this.__zoom.appendChild(rangeInput);
        this.__zoom.appendChild(this.__zoom['out']);
        this.__zoom.appendChild(this.__zoom.label);
        if (editor.isUnsupportedBrowser()) {
            this.zoomSlider.setValue(0.25 * 0.9); // 0.25 * 0.9 corresponds to zoomCoefficient of 1, i.e. 1:1
            // - for best chance of decent looks on non-SVG browsers like IE8
        } else {
            this.zoomSlider.setValue(0.5 * 0.9);  // 0.5 * 0.9 corresponds to zoomCoefficient of 0.75x
        }
        this.__zoom['in'].addEventListener('click', function(event: any) {
            if (_this.zoomCoefficient < 0.25) {
                _this.zoomSlider.setValue(0.9);
            }   // zoom in from the any value below 0.25x goes to 0.25x (which is 0.9 on the slider)
            else {
                _this.zoomSlider.setValue(-(_this.zoomCoefficient - 1)*0.9);
            }     // +0.25x
        });
        this.__zoom['out'].addEventListener('click', function(event: any) {
            if (_this.zoomCoefficient <= 0.25) {
                _this.zoomSlider.setValue(1);
            }     // zoom out from 0.25x goes to the final slider position
            else {
                _this.zoomSlider.setValue(-(_this.zoomCoefficient - 1.5)*0.9);
            }   // -0.25x
        });
        // Insert all controls in the document
        this.getWorkArea().appendChild(this.__controls);
    }

    /* To work around a bug in Raphael or Raphaelzpd (?) which creates differently sized lines
     * @ different zoom levels given the same "stroke-width" in pixels this function computes
     * the pixel size to be used at this zoom level to create a line of the correct size.
     *
     * Returns the pixel value to be used in stoke-width
     */
    getSizeNormalizedToDefaultZoom(pixelSizeAtDefaultZoom: any): any {
        return pixelSizeAtDefaultZoom;
    }

    /**
     * Returns the current zoom level (not normalized to any value, larger numbers mean deeper zoom-in)
     */
    getCurrentZoomLevel(pixelSizeAtDefaultZoom?: any): any {
        return this.zoomCoefficient;
    }

    /**
     * Converts the coordinates relative to the Raphael canvas to coordinates relative to the canvas div
     * and returns them
     *
     * @method canvasToDiv
     * @param {Number} canvasX The x coordinate relative to the Raphael canvas (ie with pan/zoom transformations)
     * @param {Number} canvasY The y coordinate relative to the Raphael canvas (ie with pan/zoom transformations)
     * @return {{x: number, y: number}} Object with coordinates
     */
    canvasToDiv(canvasX: any, canvasY: any): any {
        return {
            x: this.zoomCoefficient * (canvasX - this.viewBoxX),
            y: this.zoomCoefficient * (canvasY - this.viewBoxY)
        };
    }

    /**
     * Converts the coordinates relative to the canvas div to coordinates relative to the Raphael canvas
     * by applying zoom/pan transformations and returns them.
     *
     * @method divToCanvas
     * @param {Number} divX The x coordinate relative to the canvas
     * @param {Number} divY The y coordinate relative to the canvas
     * @return {{x: number, y: number}} Object with coordinates
     */
    divToCanvas(divX: any, divY: any): any {
        return {
            x: divX/this.zoomCoefficient + this.viewBoxX,
            y: divY/this.zoomCoefficient + this.viewBoxY
        };
    }

    /**
     * Converts the coordinates relative to the browser viewport to coordinates relative to the canvas div,
     * and returns them.
     *
     * @method viewportToDiv
     * @param {Number} absX The x coordinate relative to the viewport
     * @param {Number} absY The y coordinate relative to the viewport
     * @return {{x: number, y: number}} Object with coordinates
     */
    viewportToDiv(absX: any, absY: any): any {
        var rect = this.canvas.getBoundingClientRect();
        return {
            x : absX - rect.left,
            y : absY - rect.top
        };
    }

    /**
     * Animates a transformation of the viewbox to the given coordinate
     *
     * @method panTo
     * @param {Number} x The x coordinate relative to the Raphael canvas
     * @param {Number} y The y coordinate relative to the Raphael canvas
     */
    panTo(x: any, y: any, instant?: any): any {
        var me = this,
            oX = this.viewBoxX,
            oY = this.viewBoxY,
            xDisplacement = x - oX,
            yDisplacement = y - oY;

        if (editor.isUnsupportedBrowser()) {
            instant = true;
        }

        var numSeconds = instant ? 0 : .4;
        var frames     = instant ? 1 : 11;

        var xStep = xDisplacement/frames,
            yStep = yDisplacement/frames;

        if (xStep == 0 && yStep == 0) {
            return;
        }

        var progress = 0;

        (function draw() {
            setTimeout(function() {
                if(progress++ < frames) {
                    me.viewBoxX += xStep;
                    me.viewBoxY += yStep;
                    me.getPaper().setViewBox(me.viewBoxX, me.viewBoxY, me.width/me.zoomCoefficient, me.height/me.zoomCoefficient);
                    me.background.attr({x: me.viewBoxX, y: me.viewBoxY });
                    draw();
                }
            }, 1000 * numSeconds / frames);
        })();
    }

    /**
     * Animates a transformation of the viewbox by the given delta in the X direction
     *
     * @method panTo
     * @param {Number} deltaX The move size
     */
    panByX(deltaX: any, instant?: any): any {
        this.panTo(this.viewBoxX + Math.floor(deltaX/this.zoomCoefficient), this.viewBoxY, instant);
    }

    /**
     * Pans the canvas to put the node with the given id at the center.
     *
     * When (xCenterShift, yCenterShift) are given positions the node with the given shift relative
     * to the center instead of exact center of the screen
     *
     * @method centerAroundNode
     * @param {Number} nodeID The id of the node
     */
    centerAroundNode(nodeID: any, instant?: any, xCenterShift?: any, yCenterShift?: any): any {
        var node = editor.getNode(nodeID);
        if(node) {
            var x = node.getX(),
                y = node.getY();
            if (!xCenterShift) {
                xCenterShift = 0;
            }
            if (!yCenterShift) {
                yCenterShift = 0;
            }
            var xOffset = this.getWidth()/this.zoomCoefficient;
            var yOffset = this.getHeight()/this.zoomCoefficient;
            this.panTo(x - xOffset/2 - xCenterShift, y - yOffset/2 - yCenterShift, instant);
        }
    }

    /**
     * Adjusts the canvas size to the current viewport dimensions.
     *
     * @method adjustSizeToScreen
     */
    _adjustSizeToScreen(): any {
        this.width = window.innerWidth;
        this.height = window.innerHeight - this.canvas.getBoundingClientRect().top - 4;
        this.getPaper().setSize(this.width, this.height);
        this.getPaper().setViewBox(this.viewBoxX, this.viewBoxY, this.width/this.zoomCoefficient, this.height/this.zoomCoefficient);
        this.background && this.background.attr({'width': this.width, 'height': this.height});
        if (editor.getNodeMenu()) {
            editor.getNodeMenu().reposition();
        }
    }
}
