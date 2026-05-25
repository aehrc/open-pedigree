// helpers is a named-export module; unused default import removed

/**
 * Base class for various "legend" widgets
 *
 * @class Legend
 * @constructor
 */

export default class Legend {
    _affectedNodes: any;
    _objectColors: any;
    _legendBox: any;
    _list: any;

    constructor(title: any) {
        this._affectedNodes  = {};     // for each object: the list of affected person nodes

        this._objectColors = {};       // for each object: the corresponding object color

        var legendContainer = $('legend-container');
        if (legendContainer == undefined) {
            var legendContainer2 = new (Element as any)('div', {'class': 'legend-container', 'id': 'legend-container'});
            editor.getWorkspace().getWorkArea().insert(legendContainer2);
            legendContainer = legendContainer2;
        }

        this._legendBox = new (Element as any)('div', {'class' : 'legend-box', id: 'legend-box'});
        this._legendBox.hide();
        legendContainer.insert(this._legendBox);

        var legendTitle= new (Element as any)('h2', {'class' : 'legend-title'}).update(title);
        this._legendBox.insert(legendTitle);

        this._list = new (Element as any)('ul', {'class' : 'disorder-list'});
        this._legendBox.insert(this._list);

        (Element as any).observe(this._legendBox, 'mouseover', function() {
            $$('.menu-box').invoke('setOpacity', .1);
        });
        (Element as any).observe(this._legendBox, 'mouseout', function() {
            $$('.menu-box').invoke('setOpacity', 1);
        });
    }

    /**
     * Returns the prefix to be used on elements related to the object
     * (of type tracked by this legend) with the given id.
     *
     * @method _getPrefix
     * @param {String|Number} id ID of the object
     * @return {String} some identifier which should be a valid HTML id value (e.g. no spaces)
     */
    _getPrefix(id?: any): any {
        // To be overwritten in derived classes
        throw 'prefix not defined';
    }

    /**
     * Retrieve the color associated with the given object
     *
     * @method getObjectColor
     * @param {String|Number} id ID of the object
     * @return {String} CSS color value for the object, displayed on affected nodes in the pedigree and in the legend
     */
    getObjectColor(id: any): any {
        if (!this._objectColors.hasOwnProperty(id)) {
            return '#ff0000';
        }
        return this._objectColors[id];
    }

    /**
     * Returns True if there are nodes reported to have the object with the given id
     *
     * @method _hasAffectedNodes
     * @param {String|Number} id ID of the object
     * @private
     */
    _hasAffectedNodes(id: any): any {
        return this._affectedNodes.hasOwnProperty(id);
    }

    /**
     * Registers an occurrence of an object type being tracked by this legend.
     *
     * @method addCase
     * @param {String|Number} id ID of the object
     * @param {String} Name The description of the object to be displayed
     * @param {Number} nodeID ID of the Person who has this object associated with it
     */
    addCase(id: any, name: any, nodeID: any): any {
        if(Object.keys(this._affectedNodes).length == 0) {
            this._legendBox.show();
        }
        if(!this._hasAffectedNodes(id)) {
            this._affectedNodes[id] = [nodeID];
            var listElement = this._generateElement(id, name);
            this._list.insert(listElement);
        } else {
            this._affectedNodes[id].push(nodeID);
        }
        this._updateCaseNumbersForObject(id);
    }

    /**
     * Removes an occurrence of an object, if there are any. Removes the object
     * from the 'Legend' box if this object is not registered in any individual any more.
     *
     * @param {String|Number} id ID of the object
     * @param {Number} nodeID ID of the Person who has/is affected by this object
     */
    removeCase(id: any, nodeID: any): any {
        if (this._hasAffectedNodes(id)) {
            this._affectedNodes[id] = this._affectedNodes[id].filter((n: any) => n !== nodeID);
            if(this._affectedNodes[id].length == 0) {
                delete this._affectedNodes[id];
                delete this._objectColors[id];
                var htmlElement = this._getListElementForObjectWithID(id);
                htmlElement.remove();
                if(Object.keys(this._affectedNodes).length == 0) {
                    this._legendBox.hide();
                }
            } else {
                this._updateCaseNumbersForObject(id);
            }
        }
    }

    _getListElementForObjectWithID(id: any): any {
        return $(this._getPrefix() + '-' + id);
    }

    /**
     * Updates the displayed number of nodes assocated with/affected by the object
     *
     * @method _updateCaseNumbersForObject
     * @param {String|Number} id ID of the object
     * @private
     */
    _updateCaseNumbersForObject(id: any): any {
        var label = this._legendBox.down('li#' + this._getPrefix() + '-' + id + ' .disorder-cases');
        if (label) {
            var cases = this._affectedNodes.hasOwnProperty(id) ? this._affectedNodes[id].length : 0;
            label.update(cases + '&nbsp;case' + ((cases - 1) && 's' || ''));
        }
    }

    /**
     * Generate the element that will display information about the given object in the legend
     *
     * @method _generateElement
     * @param {String|Number} id ID of the object
     * @param {String} name The human-readable object name or description
     * @return {HTMLLIElement} List element to be insert in the legend
     */
    _generateElement(id: any, name: any): any {
        var color = this.getObjectColor(id);
        var item = new (Element as any)('li', {'class' : 'disorder', 'id' : this._getPrefix() + '-' + id}).update(new (Element as any)('span', {'class' : 'disorder-name'}).update(name));
        var bubble = new (Element as any)('span', {'class' : 'disorder-color'});
        bubble.style.backgroundColor = color;
        item.insert({'top' : bubble});
        var countLabel = new (Element as any)('span', {'class' : 'disorder-cases'});
        var countLabelContainer = new (Element as any)('span', {'class' : 'disorder-cases-container'}).insert('(').insert(countLabel).insert(')');
        item.insert(' ').insert(countLabelContainer);
        var me = this;
        (Element as any).observe(item, 'mouseover', function() {
            //item.setStyle({'text-decoration':'underline', 'cursor' : 'default'});
            item.down('.disorder-name').setStyle({'background': color, 'cursor' : 'default'});
            me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID: any) {
                var node = editor.getNode(nodeID);
                node && node.getGraphics().highlight();
            });
        });
        (Element as any).observe(item, 'mouseout', function() {
            //item.setStyle({'text-decoration':'none'});
            item.down('.disorder-name').setStyle({'background':'', 'cursor' : 'default'});
            me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID: any) {
                var node = editor.getNode(nodeID);
                node && node.getGraphics().unHighlight();
            });
        });
        return item;
    }
}
