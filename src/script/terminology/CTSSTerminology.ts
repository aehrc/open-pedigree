import AbstractAjaxTerminology from 'pedigree/terminology/abstractAjaxTerminology';

export default class CTSSTerminology extends AbstractAjaxTerminology {
  _ctssBaseUrl: any;
  _valueColumn: any;
  _textColumn: any;

  constructor(type: any, validIdRegex: any, searchCount: any, ctssBaseUrl: any, valueColumn: any, textColumn: any) {
    super(type, validIdRegex, searchCount);
    this._ctssBaseUrl = ctssBaseUrl;
    this._valueColumn = valueColumn;
    this._textColumn = textColumn;
  }

  getLookupURL(id: any): any {
    // the ID as a quoted phrase, so the service's query syntax reads none of its characters (every
    // colon, not just the first); an empty terms parameter, as the service refuses a request without
    // one; and the columns asked for, as processLookupResponse reads the text from the second
    const phrase = '"' + this.desanitizeID(id).replace(/[\\"]/g, '\\$&') + '"';
    return (
      this._ctssBaseUrl +
      '?df=' +
      encodeURI(this._valueColumn) +
      ',' +
      encodeURI(this._textColumn) +
      '&terms=&q=' +
      encodeURIComponent(this._valueColumn + ':' + phrase)
    );
  }

  processLookupResponse(id: any, response: any): any {
    const parsed = JSON.parse(response.responseText);
    if (parsed.length > 3 && parsed[3] && parsed[3][0]) {
      return parsed[3][0][1];
    }
    throw 'Failed to find result in response';
  }

  getSearchURL(searchTerm: any): any {
    return (
      this._ctssBaseUrl +
      '?df=' +
      encodeURI(this._valueColumn) +
      ',' +
      encodeURI(this._textColumn) +
      '&maxList=' +
      this.getSearchCount() +
      '&terms=' +
      encodeURIComponent(searchTerm)
    );
  }

  processSearchResponse(searchTerm: any, response: any): any {
    if (response && response.responseText) {
      const parsed = JSON.parse(response.responseText);
      if (parsed.length > 3 && parsed[3]) {
        const result: any[] = [];
        for (const v of parsed[3]) {
          result.push({ text: v[1], value: v[0] });
        }
        return result;
      }
    }
  }
}
