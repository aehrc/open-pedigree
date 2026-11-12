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
    return (
      this._ctssBaseUrl +
      '?q=' +
      encodeURI(this._valueColumn) +
      '%3A' +
      encodeURI(this.desanitizeID(id).replace(':', '\\:'))
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
      '&term=' +
      encodeURI(searchTerm)
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
