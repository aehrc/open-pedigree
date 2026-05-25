import TerminologyManager from "pedigree/terminology/terminologyManger";

export default class AbstractTerm {
    _type: any;
    _id: any;
    _name: any;

    constructor(type: any, id: any, name: any, callWhenReady?: any) {
        // user-defined terms
        this._type = type;
        var sanitizedId = TerminologyManager.sanitizeID(this._type, id);
        var desanitizedId = TerminologyManager.desanitizeID(this._type, id);
        if (name == null && !TerminologyManager.isValidID(type, desanitizedId)) {
            name = desanitizedId;
        }

        this._id  = sanitizedId;
        this._name   = name ? name : 'loading...';

        if (!name && callWhenReady) {
            this.load(callWhenReady);
        }
    }

    /*
     * Returns the type of the term, which is used when accessing the terminology manager.
     */
    getTermType(): any {
        return this._type;
    }

    /*
     * Returns the ID of the term
     */
    getID(): any {
        return this._id;
    }

    /*
     * Returns the name of the term
     */
    getName(): any {
        return this._name;
    }

    load(callWhenReady: any): any {
        var queryURL = TerminologyManager.getLookupURL(this._type, this._id);
        var extraAjaxOptions = TerminologyManager.getLookupAjaxOptions(this._type, this._id);
        var baseAjaxOptions = {
            method: 'GET',
            requestHeaders: {
                'X-Requested-With': null,
                'X-Prototype-Version': null
            },
            onSuccess: this.onDataReady.bind(this),
            onError: this.onDataFail.bind(this),
            onComplete: callWhenReady ? callWhenReady : {}
        };
        //console.log("QueryURL: " + queryURL);
        new Ajax.Request(queryURL, {...baseAjaxOptions, ...extraAjaxOptions});
    }

    onDataReady(response: any): any {
        try {
            var result = TerminologyManager.processLookupResponse(this._type, response);
            console.log('LOADED ' + this._type + ' term: id = ' + TerminologyManager.desanitizeID(this._type, this._id) + ', name = ' + result);
            this._name = result;
        } catch (err) {
            console.log('[LOAD ' + this._type + ' TERM] Error: ' +  err);
            this._name = TerminologyManager.desanitizeID(this._type, this._id);
        }
    }

    onDataFail(error: any): any {
        console.log('[LOAD ' + this._type + ' TERM] Error: ' +  error);
        console.log("Failed to load " + this._type + " term: id = '" + TerminologyManager.desanitizeID(this._type, this._id) + "' setting name to ID");
        this._name = TerminologyManager.desanitizeID(this._type, this._id);
    }
}
