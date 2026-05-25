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
    new Ajax.Request(queryURL, {
      method: 'GET',
      onSuccess: this.onDataReady.bind(this),
      onComplete: callWhenReady ? callWhenReady : {},
    });
  }

  onDataReady(response: any): void {
    try {
      const parsed = JSON.parse(response.responseText);
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
    return new XWiki.Document('OmimService', 'PhenoTips').getURL('get', 'outputSyntax=plain');
  }
}
