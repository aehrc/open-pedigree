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

        var legendContainer = document.getElementById('legend-container');
        if (!legendContainer) {
            var legendContainer2 = document.createElement('div');
            legendContainer2.className = 'legend-container';
            legendContainer2.id = 'legend-container';
            editor.getWorkspace().getWorkArea().appendChild(legendContainer2);
            legendContainer = legendContainer2;
        }

        this._legendBox = document.createElement('div');
        this._legendBox.className = 'legend-box';
        this._legendBox.id = 'legend-box';
        this._legendBox.style.display = 'none';
        legendContainer.appendChild(this._legendBox);

        var legendTitle = document.createElement('h2');
        legendTitle.className = 'legend-title';
        legendTitle.textContent = title;
        this._legendBox.appendChild(legendTitle);

        this._list = document.createElement('ul');
        this._list.className = 'disorder-list';
        this._legendBox.appendChild(this._list);

        this._legendBox.addEventListener('mouseover', function() {
            var menuBoxes = Array.from(document.querySelectorAll('.menu-box')) as HTMLElement[];
            menuBoxes.forEach(function(el) { el.style.opacity = '0.1'; });
        });
        this._legendBox.addEventListener('mouseout', function() {
            var menuBoxes = Array.from(document.querySelectorAll('.menu-box')) as HTMLElement[];
            menuBoxes.forEach(function(el) { el.style.opacity = '1'; });
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
            this._legendBox.style.display = '';
        }
        if(!this._hasAffectedNodes(id)) {
            this._affectedNodes[id] = [nodeID];
            var listElement = this._generateElement(id, name);
            this._list.appendChild(listElement);
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
                    this._legendBox.style.display = 'none';
                }
            } else {
                this._updateCaseNumbersForObject(id);
            }
        }
    }

    _getListElementForObjectWithID(id: any): any {
        return document.getElementById(this._getPrefix() + '-' + id);
    }

    /**
     * Updates the displayed number of nodes assocated with/affected by the object
     *
     * @method _updateCaseNumbersForObject
     * @param {String|Number} id ID of the object
     * @private
     */
    _updateCaseNumbersForObject(id: any): any {
        var label = this._legendBox.querySelector('li#' + this._getPrefix() + '-' + id + ' .disorder-cases');
        if (label) {
            var cases = this._affectedNodes.hasOwnProperty(id) ? this._affectedNodes[id].length : 0;
            label.innerHTML = cases + '&nbsp;case' + ((cases - 1) && 's' || '');
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

        var nameSpan = document.createElement('span');
        nameSpan.className = 'disorder-name';
        nameSpan.textContent = name;

        var item = document.createElement('li');
        item.className = 'disorder';
        item.id = this._getPrefix() + '-' + id;
        item.appendChild(nameSpan);

        var bubble = document.createElement('span');
        bubble.className = 'disorder-color';
        bubble.style.backgroundColor = color;
        item.prepend(bubble);

        var countLabel = document.createElement('span');
        countLabel.className = 'disorder-cases';
        var countLabelContainer = document.createElement('span');
        countLabelContainer.className = 'disorder-cases-container';
        countLabelContainer.appendChild(document.createTextNode('('));
        countLabelContainer.appendChild(countLabel);
        countLabelContainer.appendChild(document.createTextNode(')'));
        item.appendChild(document.createTextNode(' '));
        item.appendChild(countLabelContainer);

        var me = this;
        item.addEventListener('mouseover', function() {
            var nameEl = item.querySelector('.disorder-name') as HTMLElement;
            if (nameEl) { nameEl.style.background = color; nameEl.style.cursor = 'default'; }
            me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID: any) {
                var node = editor.getNode(nodeID);
                node && node.getGraphics().highlight();
            });
        });
        item.addEventListener('mouseout', function() {
            var nameEl = item.querySelector('.disorder-name') as HTMLElement;
            if (nameEl) { nameEl.style.background = ''; nameEl.style.cursor = 'default'; }
            me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID: any) {
                var node = editor.getNode(nodeID);
                node && node.getGraphics().unHighlight();
            });
        });
        return item;
    }
}
