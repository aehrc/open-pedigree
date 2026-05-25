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

  _buildFetchOptions(defaultMethod: string, defaultContentType: string, extraOptions: any): RequestInit {
    const method = (extraOptions.method || defaultMethod).toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': extraOptions.contentType || defaultContentType
    };
    let body: BodyInit | undefined = undefined;
    if (extraOptions.parameters && method === 'POST') {
      body = new URLSearchParams(extraOptions.parameters);
    }
    return { method, headers, body };
  }

  lookupTerm(id: any, onSuccess: any, onError: any, onComplete: any): void {
    const queryURL = this.getLookupURL(id);
    const extraOptions = this.getLookupAjaxOptions(id);
    const fetchOptions = this._buildFetchOptions('GET', 'application/json; charset=utf-8', extraOptions);

    fetch(queryURL, fetchOptions)
      .then(response => response.text())
      .then(text => {
        try {
          const fakeResponse = { responseText: text };
          const result = this.processLookupResponse(id, fakeResponse);
          console.debug('LOADED ' + this._type + ' term: id = ' + this.desanitizeID(id) + ', name = ' + result);
          onSuccess(id, result);
        } catch (err) {
          console.error('[LOAD ' + this._type + ' term: id = ' + this.desanitizeID(id) + '] Error: ' + err);
          onError(err);
        }
      })
      .catch(err => {
        console.error('[LOAD ' + this._type + ' term: id = ' + this.desanitizeID(id) + '] Error: ' + err);
        onError(err);
      })
      .finally(() => {
        if (typeof onComplete === 'function') onComplete();
      });
  }

  searchForTerms(searchTerm: any, onSuccess: any, onError: any, onComplete: any): void {
    const queryURL = this.getSearchURL(searchTerm);
    const extraOptions = this.getSearchAjaxOptions(searchTerm);
    const fetchOptions = this._buildFetchOptions('GET', 'application/json; charset=utf-8', extraOptions);

    fetch(queryURL, fetchOptions)
      .then(response => response.text())
      .then(text => {
        try {
          const fakeResponse = { responseText: text };
          const result = this.processSearchResponse(searchTerm, fakeResponse);
          onSuccess(searchTerm, result);
        } catch (err) {
          console.log('Error searching for ' + this.getType() + ' with searchTerm "' + searchTerm + '": ' + err);
          onError(err);
        }
      })
      .catch(err => {
        console.log('Error searching for ' + this.getType() + ' with searchTerm "' + searchTerm + '": ' + err);
        onError(err);
      })
      .finally(() => {
        if (typeof onComplete === 'function') onComplete();
      });
  }
}
