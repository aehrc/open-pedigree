import AbstractTerminology from 'pedigree/terminology/abstractTerminology';

export default class AbstractAjaxTerminology extends AbstractTerminology {
  constructor(type: any, validIdRegex: any, searchCount: any) {
    super(type, validIdRegex, searchCount);
  }

  getLookupURL(id: any): any {
    throw 'Unimplemented method - should be using subclass';
  }

  getLookupAjaxOptions(id: any): any {
    return {};
  }

  processLookupResponse(id: any, response: any): any {
    throw 'Unimplemented method - should be using subclass';
  }

  getSearchURL(searchTerm: any): any {
    throw 'Unimplemented method - should be using subclass';
  }

  getSearchAjaxOptions(searchTerm: any): any {
    return {};
  }

  processSearchResponse(searchTerm: any, response: any): any {
    throw 'Unimplemented method - should be using subclass';
  }

  lookupTerm(id: any, onSuccess: any, onError: any, onComplete: any): void {
    const queryURL = this.getLookupURL(id);
    const extraAjaxOptions = this.getLookupAjaxOptions(id);
    const ajaxOptions = {
      method: 'GET',
      requestHeaders: {
        'X-Requested-With': null,
        'X-Prototype-Version': null,
      },
      onSuccess: (response: any) => {
        try {
          const result = this.processLookupResponse(id, response);
          console.debug('LOADED ' + this._type + ' term: id = ' + this.desanitizeID(id) + ', name = ' + result);
          onSuccess(id, result);
        } catch (err) {
          console.error('[LOAD ' + this._type + ' term: id = ' + this.desanitizeID(id) + '] Error: ' + err);
          onError(err);
        }
      },
      onError: (error: any) => {
        console.error('[LOAD ' + this._type + ' term: id = ' + this.desanitizeID(id) + '] Error: ' + error);
        onError(error);
      },
      onComplete: onComplete ? onComplete : {},
      ...extraAjaxOptions,
    };
    new Ajax.Request(queryURL, ajaxOptions);
  }

  searchForTerms(searchTerm: any, onSuccess: any, onError: any, onComplete: any): void {
    const queryURL = this.getSearchURL(searchTerm);
    const extraAjaxOptions = this.getSearchAjaxOptions(searchTerm);
    const ajaxOptions = {
      method: 'GET',
      contentType: 'application/json; charset=utf-8',
      requestHeaders: {
        'X-Requested-With': null,
        'X-Prototype-Version': null,
      },
      onSuccess: (response: any) => {
        try {
          const result = this.processSearchResponse(searchTerm, response);
          onSuccess(searchTerm, result);
        } catch (err) {
          console.log('Error searching for ' + this.getType() + ' with searchTerm "' + searchTerm + '": ' + err);
          onError(err);
        }
      },
      onError: (error: any) => {
        console.log('Error searching for ' + this.getType() + ' with searchTerm "' + searchTerm + '": ' + error);
        onError(error);
      },
      onComplete: onComplete ? onComplete : {},
      ...extraAjaxOptions,
    };
    new Ajax.Request(queryURL, ajaxOptions);
  }
}
