import AbstractAjaxTerminology from 'pedigree/terminology/abstractAjaxTerminology';

export default class FHIRTerminology extends AbstractAjaxTerminology {
  _codeSystem: any;
  _fhirBaseUrl: any;
  _valueSet: any;
  _lookupAjaxOptions: any;
  _searchAjaxOptions: any;

  constructor(
    type: any,
    codeSystem: any,
    validIdRegex: any,
    searchCount: any,
    fhirBaseUrl: any,
    valueSet: any,
    lookupAjaxOptions: any = {},
    searchAjaxOptions: any = {}
  ) {
    super(type, validIdRegex, searchCount);
    this._codeSystem = codeSystem;
    this._fhirBaseUrl = fhirBaseUrl;
    this._valueSet = valueSet;
    this._lookupAjaxOptions = lookupAjaxOptions;
    this._searchAjaxOptions = searchAjaxOptions;
  }

  getCodeSystem(): any {
    return this._codeSystem;
  }

  getLookupURL(id: any): any {
    const base = this._fhirBaseUrl.replace(/\/$/, '');
    return (
      base +
      '/CodeSystem/$lookup?_format=json' +
      '&system=' +
      encodeURI(this.getCodeSystem()) +
      '&code=' +
      encodeURI(this.desanitizeID(id))
    );
  }

  processLookupResponse(id: any, response: any): any {
    const parsed = JSON.parse(response.responseText);
    if (parsed.parameter) {
      for (let i = 0; i < parsed.parameter.length; i++) {
        if (parsed.parameter[i].name === 'display') {
          return parsed.parameter[i].valueString;
        }
      }
    }
    throw 'Failed to find result in response';
  }

  getSearchURL(searchTerm: any): any {
    const base = this._fhirBaseUrl.replace(/\/$/, '');
    return (
      base +
      '/ValueSet/$expand?_format=json&url=' +
      encodeURI(this._valueSet) +
      '&count=' +
      this.getSearchCount() +
      '&filter=' +
      encodeURI(searchTerm)
    );
  }

  processSearchResponse(searchTerm: any, response: any): any {
    if (response && response.responseText) {
      const parsed = JSON.parse(response.responseText);
      if (parsed.expansion && parsed.expansion.contains) {
        const result: any[] = [];
        for (const v of parsed.expansion.contains) {
          result.push({ text: v.display, value: v.code });
        }
        return result;
      }
    }
  }

  getLookupAjaxOptions(id: any): any {
    return this._lookupAjaxOptions;
  }

  getSearchAjaxOptions(search: any): any {
    return this._searchAjaxOptions;
  }
}
