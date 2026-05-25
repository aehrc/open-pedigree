import AbstractAjaxTerminology from 'pedigree/terminology/abstractAjaxTerminology';

export default class BioportalTerminology extends AbstractAjaxTerminology {
  _bioportalBaseUrl: any;
  _ontology: any;
  _apiKey: any;
  _lookupAjaxOptions: any;
  _searchAjaxOptions: any;

  constructor(
    type: any,
    validIdRegex: any,
    searchCount: any,
    bioportalBaseUrl: any,
    ontology: any,
    apiKey: any,
    lookupAjaxOptions: any = {},
    searchAjaxOptions: any = {}
  ) {
    super(type, validIdRegex, searchCount);
    this._bioportalBaseUrl = bioportalBaseUrl;
    this._ontology = ontology;
    this._apiKey = apiKey;
    this._lookupAjaxOptions = lookupAjaxOptions;
    this._searchAjaxOptions = searchAjaxOptions;
  }

  getLookupURL(id: any): any {
    return (
      this._bioportalBaseUrl +
      '/search?q=' +
      encodeURI(this.desanitizeID(id)) +
      '&ontologies=' +
      encodeURI(this._ontology) +
      (this._apiKey ? '&apikey=' + this._apiKey : '') +
      '&require_exact_match=true&include=prefLabel,notation&display_links=false&display_context=false&format=json'
    );
  }

  processLookupResponse(id: any, response: any): any {
    const parsed = JSON.parse(response.responseText);
    const dsId = this.desanitizeID(id);
    if (parsed.collection) {
      for (let i = 0; i < parsed.collection.length; i++) {
        if (parsed.collection[i].notation === dsId) {
          return parsed.collection[i].prefLabel;
        }
      }
    }
    throw 'Failed to find result in response';
  }

  getSearchURL(searchTerm: any): any {
    return (
      this._bioportalBaseUrl +
      '/search?q=' +
      encodeURI(searchTerm) +
      '&ontologies=' +
      encodeURI(this._ontology) +
      (this._apiKey ? '&apikey=' + this._apiKey : '') +
      (this._searchCount ? '&pagesize=' + this._searchCount : '') +
      '&suggest=true&include=prefLabel,notation&display_links=false&display_context=false&format=json'
    );
  }

  processSearchResponse(searchTerm: any, response: any): any {
    if (response && response.responseText) {
      const parsed = JSON.parse(response.responseText);
      if (parsed.collection) {
        const result: any[] = [];
        for (const v of parsed.collection) {
          result.push({ text: v.prefLabel, value: v.notation });
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
