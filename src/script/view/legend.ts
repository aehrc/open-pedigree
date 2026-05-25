
/**
 * Base class for various "legend" widgets
 *
 * @class Legend
 * @constructor
 */
export default class Legend {
  _affectedNodes: any;
  _objectColors: any;
  _cache: any;
  _terminology: any;
  _legendBox: any;
  _list: any;

  /**
   *
   * @param {String} title
   * @param terminology
   */
  constructor(title: any, terminology: any) {
    this._affectedNodes = {};     // for each object: the list of affected person nodes

    this._objectColors = {};       // for each object: the corresponding object color

    this._cache = {};
    this._terminology = terminology;

    let legendContainer = document.getElementById('legend-container');
    if (!legendContainer) {
      console.debug('Create legend container');
      legendContainer = document.createElement('div');
      legendContainer.className = 'legend-container';
      legendContainer.id = 'legend-container';
      editor.getWorkspace().getWorkArea().appendChild(legendContainer);
    }

    this._legendBox = document.createElement('div');
    this._legendBox.className = 'legend-box';
    this._legendBox.id = 'legend-box';
    this._legendBox.style.display = 'none';
    legendContainer.appendChild(this._legendBox);

    const legendTitle = document.createElement('h2');
    legendTitle.className = 'legend-title';
    legendTitle.textContent = title;
    this._legendBox.appendChild(legendTitle);

    this._list = document.createElement('ul');
    this._list.className = 'disorder-list';
    this._legendBox.appendChild(this._list);

    this._legendBox.addEventListener('mouseover', function() {
      const menuBoxes = Array.from(document.querySelectorAll('.menu-box')) as HTMLElement[];
      menuBoxes.forEach(el => el.style.opacity = '0.1');
    });
    this._legendBox.addEventListener('mouseout', function() {
      const menuBoxes = Array.from(document.querySelectorAll('.menu-box')) as HTMLElement[];
      menuBoxes.forEach(el => el.style.opacity = '1');
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
   * Returns the disorder object with the given ID. If object is not in cache yet
   * returns a newly created one which may have the disorder name & other attributes not loaded yet
   *
   * @method getDisorder
   * @return {Object}
   */
  getTerm(termId: any): any {
    const id = this._terminology.sanitizeID(termId);
    if (!this._cache.hasOwnProperty(id)) {
      this._cache[id] = this._terminology.createTerm(id, null, () => this._updateTermName(id));
    }
    return this._cache[id];
  }

  _updateTermName(id: any): void {
    const name = this._legendBox.querySelector('li#' + this._getPrefix(id) + '-' + id + ' .disorder-name');
    if (name) {
      name.textContent = this._cache[id].getName();
    }
  }

  getCurrentTerms(): any[] {
    const currentTerms: any[] = [];
    for (const id in this._affectedNodes) {
      currentTerms.push(this._cache[id]);
    }
    return currentTerms;
  }

  addToCache(termId: any, name: any): void {
    const id = this._terminology.sanitizeID(termId);
    if (!this._cache.hasOwnProperty(id)) {
      this._cache[id] = this._terminology.createTerm(id, name);
    }
  }

  /**
   * Retrieve the color associated with the given object
   *
   * @method getObjectColor
   * @param {String|Number} id ID of the object
   * @return {String} CSS color value for the object, displayed on affected nodes in the pedigree and in the legend
   */
  getObjectColor(id: any): string {
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
  _hasAffectedNodes(id: any): boolean {
    return this._affectedNodes.hasOwnProperty(id);
  }

  /**
   * Registers an occurrence of an object type being tracked by this legend.
   *
   * @method addCase
   * @param {String|Number} id ID of the object
   * @param {String} name The description of the object to be displayed
   * @param {Number} nodeID ID of the Person who has this object associated with it
   */
  addCase(id: any, name: any, nodeID: any): void {
    if(Object.keys(this._affectedNodes).length === 0) {
      this._legendBox.style.display = '';
    }
    if(!this._hasAffectedNodes(id)) {
      this._affectedNodes[id] = [nodeID];
      const listElement = this._generateElement(id, name);
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
  removeCase(id: any, nodeID: any): void {
    if (this._hasAffectedNodes(id)) {
      this._affectedNodes[id] = this._affectedNodes[id].filter((n: any) => n !== nodeID);
      if(this._affectedNodes[id].length === 0) {
        delete this._affectedNodes[id];
        delete this._objectColors[id];
        const htmlElement = this._getListElementForObjectWithID(id);
        htmlElement.remove();
        if(Object.keys(this._affectedNodes).length === 0) {
          this._legendBox.style.display = 'none';
        }
      } else {
        this._updateCaseNumbersForObject(id);
      }
    }
  }

  searchForTerms(searchTerm: any, onSuccess: any, onError: any, onComplete: any): void {
    this._terminology.searchForTerms(searchTerm, onSuccess, onError, onComplete);
  }

  _getListElementForObjectWithID(id: any): any {
    return document.getElementById(this._getPrefix(id) + '-' + id);
  }

  /**
   * Updates the displayed number of nodes assocated with/affected by the object
   *
   * @method _updateCaseNumbersForObject
   * @param {String|Number} id ID of the object
   * @private
   */
  _updateCaseNumbersForObject(id: any): void {
    const label = this._legendBox.querySelector('li#' + this._getPrefix() + '-' + id + ' .disorder-cases');
    if (label) {
      const cases = this._affectedNodes.hasOwnProperty(id) ? this._affectedNodes[id].length : 0;
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
    const color = this.getObjectColor(id);
    const nameSpan = document.createElement('span');
    nameSpan.className = 'disorder-name';
    nameSpan.textContent = name;
    const item = document.createElement('li');
    item.className = 'disorder';
    item.id = this._getPrefix() + '-' + id;
    item.appendChild(nameSpan);
    const bubble = document.createElement('span');
    bubble.className = 'disorder-color';
    bubble.style.backgroundColor = color;
    item.prepend(bubble);
    const countLabel = document.createElement('span');
    countLabel.className = 'disorder-cases';
    const countLabelContainer = document.createElement('span');
    countLabelContainer.className = 'disorder-cases-container';
    countLabelContainer.appendChild(document.createTextNode('('));
    countLabelContainer.appendChild(countLabel);
    countLabelContainer.appendChild(document.createTextNode(')'));
    item.appendChild(document.createTextNode(' '));
    item.appendChild(countLabelContainer);
    const me = this;
    item.addEventListener('mouseover', function() {
      var nameEl = item.querySelector('.disorder-name') as HTMLElement;
      if (nameEl) { nameEl.style.background = color; nameEl.style.cursor = 'default'; }
      me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID: any) {
        const node = editor.getNode(nodeID);
        node && node.getGraphics().highlight();
      });
    });
    item.addEventListener('mouseout', function() {
      var nameEl = item.querySelector('.disorder-name') as HTMLElement;
      if (nameEl) { nameEl.style.background = ''; nameEl.style.cursor = 'default'; }
      me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID: any) {
        const node = editor.getNode(nodeID);
        node && node.getGraphics().unHighlight();
      });
    });
    return item;
  }

  desanitizeID(id: any): any {
    if (this._terminology){
      return this._terminology.desanitizeID(id);
    }
    return id;
  }
}
