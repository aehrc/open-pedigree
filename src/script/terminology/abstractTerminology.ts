export default class AbstractTerminology {
    _type: any;
    _codeSystem: any;
    _validIdRegex: any;
    _searchCount: any;

    constructor(type: any, codeSystem: any, validIdRegex: any, searchCount: any) {
        this._type      = type;
        this._codeSystem   = codeSystem;
        this._validIdRegex = validIdRegex;
        this._searchCount = searchCount || 20;
    }

    getType(): any {
        return this._type;
    }

    getCodeSystem(): any {
        return this._codeSystem;
    }

    isValidID(id: any): any {
        if (this._validIdRegex){
            return this._validIdRegex.test(id);
        }
        return true;
    }

    getSearchCount(): any {
        return this._searchCount;
    }

    getLookupURL(id: any): any {
        throw 'Unimplemented method - should be using subclass';
    }

    /** Subclasses should override this if a lookup requires special options, such as a POST */
    getLookupAjaxOptions(id: any): any {
        return {};
    }

    processLookupResponse(response: any): any {
        throw 'Unimplemented method - should be using subclass';
    }

    getSearchURL(searchTerm: any): any {
        throw 'Unimplemented method - should be using subclass';
    }

    /** Subclasses should override this if a lookup requires special options, such as a POST */
    getSearchAjaxOptions(searchTerm: any): any {
        return {};
    }

    processSearchResponse(response: any): any {
        throw 'Unimplemented method - should be using subclass';
    }

    desanitizeID(id: any): any {
        var temp = id;
        temp = temp.replace(/_C_/g, ":");
        temp = temp.replace(/_L_/g, "(");
        temp = temp.replace(/_J_/g, ")");
        temp = temp.replace(/_D_/g, ".");
        temp = temp.replace(/_S_/g, "/");
        temp = temp.replace(/__/g, " ");
        return temp;
    }

    sanitizeID(id: any): any {
        var temp = id;
        temp = temp.replace(/[:]/g, '_C_');
        temp = temp.replace(/[\(\[]/g, '_L_');
        temp = temp.replace(/[\)\]]/g, '_J_');
        temp = temp.replace(/[.]/g, '_D_');
        temp = temp.replace(/\//g, '_S_');
        temp = temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
        return temp;
    }
}
