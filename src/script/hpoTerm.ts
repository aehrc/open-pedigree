/*
 * HPOTerm is a class for storing phenotype information and loading it from the
 * the HPO database. These phenotypes can be attributed to an individual in the Pedigree.
 *
 * @param hpoID the id number for the HPO term, taken from the HPO database
 * @param name a string representing the name of the term e.g. "Abnormality of the eye"
 */

export default class HPOTerm {
    _hpoID: any;
    _name: any;

    constructor(hpoID: any, name: any, callWhenReady: any) {
        // user-defined terms
        if (name == null && !HPOTerm.isValidID(HPOTerm.desanitizeID(hpoID))) {
            name = HPOTerm.desanitizeID(hpoID);
        }

        this._hpoID  = HPOTerm.sanitizeID(hpoID);
        this._name   = name ? name : 'loading...';

        if (!name && callWhenReady) {
            this.load(callWhenReady);
        }
    }

    /*
     * Returns the hpoID of the phenotype
     */
    getID(): any {
        return this._hpoID;
    }

    /*
     * Returns the name of the term
     */
    getName(): any {
        return this._name;
    }

    load(callWhenReady: any): any {
        var baseServiceURL = HPOTerm.getServiceURL();
        var queryURL       = baseServiceURL + '&q=id%3A' + HPOTerm.desanitizeID(this._hpoID).replace(':','%5C%3A');
        fetch(queryURL, { method: 'GET' })
            .then(response => response.text())
            .then(text => this.onDataReady(text))
            .catch(err => {
                console.log("Failed to load HPO TERM: id = '" + HPOTerm.desanitizeID(this._hpoID) + "' setting name to ID");
                this._name = HPOTerm.desanitizeID(this._hpoID);
            })
            .finally(() => { if (typeof callWhenReady === 'function') callWhenReady(); });
    }

    onDataReady(responseText: any): any {
        try {
            var parsed = JSON.parse(responseText);
            //console.log(JSON.stringify(parsed));
            console.log('LOADED HPO TERM: id = ' + HPOTerm.desanitizeID(this._hpoID) + ', name = ' + parsed.rows[0].name);
            this._name = parsed.rows[0].name;
        } catch (err) {
            console.log('[LOAD HPO TERM] Error: ' +  err);
        }
    }

    /*
     * IDs are used as part of HTML IDs in the Legend box, which breaks when IDs contain some non-alphanumeric symbols.
     * For that purpose these symbols in IDs are converted in memory (but not in the stored pedigree) to some underscores.
     */
    static sanitizeID(id: any): any {
        var temp = id.replace(/[\(\[]/g, '_L_');
        temp = temp.replace(/[\)\]]/g, '_J_');
        temp = temp.replace(/[:]/g, '_C_');
        return temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
    }

    static desanitizeID(id: any): any {
        var temp = id.replace(/__/g, ' ');
        temp = temp.replace(/_C_/g, ':');
        temp = temp.replace(/_L_/g, '(');
        return temp.replace(/_J_/g, ')');
    }

    static isValidID(id: any): any {
        var pattern = /^HP\:(\d)+$/i;
        return pattern.test(id);
    }

    static getServiceURL(): any {
        const base = (window as any).editor ? (window as any).editor.getHpoServiceUrl() : '';
        return base ? base + '?' : '';
    }
}
