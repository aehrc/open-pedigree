import AbstractTerminology from 'pedigree/terminology/abstractTerminology';

export default class CTSSTerminology extends AbstractTerminology {
    _ctssBaseUrl: any;
    _valueColumn: any;
    _textColumn: any;

    constructor(type: any, codeSystem: any, validIdRegex: any, searchCount: any, ctssBaseUrl: any, valueColumn: any, textColumn: any) {
        super(type, codeSystem, validIdRegex, searchCount);
        this._ctssBaseUrl = ctssBaseUrl;
        this._valueColumn = valueColumn;
        this._textColumn = textColumn;
    }

    getLookupURL(id: any): any {
        return this._ctssBaseUrl + '?df=' + this._valueColumn + ',' + this._textColumn +'&sf=' + this._valueColumn + '&term=' + this.desanitizeID(id);
    }

    processLookupResponse(response: any): any {
        var parsed = JSON.parse(response.responseText);
        //console.log(stringifyObject(parsed));
        if (parsed.length > 3 && parsed[3] && parsed[3][0]){
            return parsed[3][0][1];
        }
        throw "Failed to find result in response";
    }

    getSearchURL(searchTerm: any): any {
        return this._ctssBaseUrl + '?df=' + this._valueColumn + ',' + this._textColumn +'&maxList=' + this.getSearchCount() + '&term=' + searchTerm;
    }

    processSearchResponse(response: any): any {
        if (response && response.responseText) {
            var parsed = JSON.parse(response.responseText);

            if (parsed.length > 3 && parsed[3]) {

                var result = [];
                for (var v of parsed[3]) {
                    result.push({'text': v[1], 'value': v[0]});
                }
                return result;
            }
        }
    }
}
