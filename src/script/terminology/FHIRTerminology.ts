import AbstractTerminology from 'pedigree/terminology/abstractTerminology';

export default class FHIRTerminology extends AbstractTerminology {
    _fhirBaseUrl: any;
    _valueSet: any;

    constructor(type: any, codeSystem: any, validIdRegex: any, searchCount: any, fhirBaseUrl: any, valueSet: any) {
        super(type, codeSystem, validIdRegex, searchCount);
        this._fhirBaseUrl = fhirBaseUrl;
        this._valueSet     = valueSet;
    }

    getLookupURL(id: any): any {
        const base = this._fhirBaseUrl.replace(/\/$/, '');
        return base + '/CodeSystem/$lookup?_format=json&system=' + this.getCodeSystem() + '&code=' + this.desanitizeID(id);
    }

    processLookupResponse(response: any): any {
        var parsed = JSON.parse(response.responseText);
        //console.log(stringifyObject(parsed));
        if (parsed.parameter){
            for (var i = 0; i < parsed.parameter.length; i++){
                if (parsed.parameter[i].name == 'display'){
                    return parsed.parameter[i].valueString;
                }
            }
        }
        throw "Failed to find result in response";
    }

    getSearchURL(searchTerm: any): any {
        const base = this._fhirBaseUrl.replace(/\/$/, '');
        return base + '/ValueSet/$expand?_format=json&url=' + this._valueSet + "&count=" + this.getSearchCount() + "&filter=" + searchTerm;
    }

    processSearchResponse(response: any): any {
        if (response && response.responseText) {
            var parsed = JSON.parse(response.responseText);

            if (parsed.expansion && parsed.expansion.contains) {

                var result = [];
                for (var v of parsed.expansion.contains) {
                    result.push({'text': v.display, 'value': v.code});
                }
                return result;
            }
        }
    }
}
