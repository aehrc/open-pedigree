import AbstractAjaxTerminology from 'pedigree/terminology/abstractAjaxTerminology';

export default class DelegatingTerminology extends AbstractAjaxTerminology {
  _lookupUrlFn: any;
  _processLookupResponseFn: any;
  _lookupAjaxOptionsFn: any;
  _searchUrlFn: any;
  _processSearchResponseFn: any;
  _searchAjaxOptionsFn: any;

  constructor(
    type: any,
    validIdRegex: any,
    searchCount: any,
    lookupUrlFn: any,
    processLookupResponseFn: any,
    lookupAjaxOptionsFn: any,
    searchUrlFn: any,
    processSearchResponseFn: any,
    searchAjaxOptionsFn: any
  ) {
    super(type, validIdRegex, searchCount);
    this._lookupUrlFn = lookupUrlFn;
    this._processLookupResponseFn = processLookupResponseFn;
    this._lookupAjaxOptionsFn = lookupAjaxOptionsFn;
    this._searchUrlFn = searchUrlFn;
    this._processSearchResponseFn = processSearchResponseFn;
    this._searchAjaxOptionsFn = searchAjaxOptionsFn;
  }

  getLookupURL(id: any): any {
    return this._lookupUrlFn(id);
  }

  processLookupResponse(id: any, response: any): any {
    return this._processLookupResponseFn(id, response);
  }

  getSearchURL(searchTerm: any): any {
    return this._searchUrlFn(searchTerm);
  }

  processSearchResponse(searchTerm: any, response: any): any {
    return this._processSearchResponseFn(searchTerm, response);
  }

  getLookupAjaxOptions(id: any): any {
    if (this._lookupAjaxOptionsFn) {
      return this._lookupAjaxOptionsFn(id);
    }
    return {};
  }

  getSearchAjaxOptions(searchTerm: any): any {
    if (this._searchAjaxOptionsFn) {
      return this._searchAjaxOptionsFn(searchTerm);
    }
    return {};
  }
}
