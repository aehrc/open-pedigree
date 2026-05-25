export default class HPOTerm {
  _hpoID: any;
  _name: any;

  constructor(hpoID: any, name: any, callWhenReady: any) {
    if (name == null && !HPOTerm.isValidID(HPOTerm.desanitizeID(hpoID))) {
      name = HPOTerm.desanitizeID(hpoID);
    }

    this._hpoID = HPOTerm.sanitizeID(hpoID);
    this._name = name ? name : 'loading...';

    if (!name && callWhenReady) {
      this.load(callWhenReady);
    }
  }

  getID(): any {
    return this._hpoID;
  }

  getName(): any {
    return this._name;
  }

  load(callWhenReady: any): void {
    const baseServiceURL = HPOTerm.getServiceURL();
    const queryURL = baseServiceURL + '&q=id%3A' + HPOTerm.desanitizeID(this._hpoID).replace(':', '%5C%3A');
    fetch(queryURL, { method: 'GET' })
      .then(response => response.text())
      .then(text => this.onDataReady(text))
      .catch(err => console.log('[LOAD HPO TERM] Fetch error: ' + err))
      .finally(() => { if (typeof callWhenReady === 'function') callWhenReady(); });
  }

  onDataReady(responseText: any): void {
    try {
      const parsed = JSON.parse(responseText);
      console.log('LOADED HPO TERM: id = ' + HPOTerm.desanitizeID(this._hpoID) + ', name = ' + parsed.rows[0].name);
      this._name = parsed.rows[0].name;
    } catch (err) {
      console.log('[LOAD HPO TERM] Error: ' + err);
    }
  }

  static sanitizeID(id: any): any {
    let temp = id.replace(/[\(\[]/g, '_L_');
    temp = temp.replace(/[\)\]]/g, '_J_');
    temp = temp.replace(/[:]/g, '_C_');
    return temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
  }

  static desanitizeID(id: any): any {
    let temp = id.replace(/__/g, ' ');
    temp = temp.replace(/_C_/g, ':');
    temp = temp.replace(/_L_/g, '(');
    return temp.replace(/_J_/g, ')');
  }

  static isValidID(id: any): any {
    const pattern = /^HP\:(\d)+$/i;
    return pattern.test(id);
  }

  static getServiceURL(): any {
    const base = (window as any).editor ? (window as any).editor.getHpoServiceUrl() : '';
    return base ? base + '?' : '';
  }
}
