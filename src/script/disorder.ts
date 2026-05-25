import { isInt } from 'pedigree/model/helpers';

export default class Disorder {
  _disorderID: any;
  _name: any;

  constructor(disorderID: any, name: any, callWhenReady: any) {
    if (name == null && !isInt(disorderID)) {
      name = Disorder.desanitizeID(disorderID);
    }

    this._disorderID = Disorder.sanitizeID(disorderID);
    this._name = name ? name : 'loading...';

    if (!name && callWhenReady) {
      this.load(callWhenReady);
    }
  }

  getDisorderID(): any {
    return this._disorderID;
  }

  getName(): any {
    return this._name;
  }

  load(callWhenReady: any): void {
    const baseOMIMServiceURL = Disorder.getOMIMServiceURL();
    const queryURL = baseOMIMServiceURL + '&q=id:' + this._disorderID;
    fetch(queryURL, { method: 'GET' })
      .then(response => response.text())
      .then(text => this.onDataReady(text))
      .catch(err => console.log('[LOAD DISORDER] Fetch error: ' + err))
      .finally(() => { if (typeof callWhenReady === 'function') callWhenReady(); });
  }

  onDataReady(responseText: any): void {
    try {
      const parsed = JSON.parse(responseText);
      console.log('LOADED DISORDER: disorder id = ' + this._disorderID + ', name = ' + parsed.rows[0].name);
      this._name = parsed.rows[0].name;
    } catch (err) {
      console.log('[LOAD DISORDER] Error: ' + err);
    }
  }

  static sanitizeID(disorderID: any): any {
    if (isInt(disorderID)) {
      return disorderID;
    }
    let temp = disorderID.replace(/[\(\[]/g, '_L_');
    temp = temp.replace(/[\)\]]/g, '_J_');
    return temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
  }

  static desanitizeID(disorderID: any): any {
    let temp = disorderID.replace(/__/g, ' ');
    temp = temp.replace(/_L_/g, '(');
    return temp.replace(/_J_/g, ')');
  }

  static getOMIMServiceURL(): any {
    return (window as any).editor ? (window as any).editor.getOmimServiceUrl() : '';
  }
}
