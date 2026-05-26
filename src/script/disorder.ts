import { isInt } from 'pedigree/model/helpers';
/*
 * Disorder is a class for storing genetic disorder info and loading it from the
 * the OMIM database. These disorders can be attributed to an individual in the Pedigree.
 *
 * @param disorderID the id number for the disorder, taken from the OMIM database
 * @param name a string representing the name of the disorder e.g. "Down Syndrome"
 */

export default class Disorder {
    _disorderID: any;
    _name: any;

    constructor(disorderID: any, name: any, callWhenReady: any) {
        // user-defined disorders
        if (name == null && !isInt(disorderID)) {
            name = Disorder.desanitizeID(disorderID);
        }

        this._disorderID = Disorder.sanitizeID(disorderID);
        this._name       = name ? name : 'loading...';

        if (!name && callWhenReady) {
            this.load(callWhenReady);
        }
    }

    /*
     * Returns the disorderID of the disorder
     */
    getDisorderID(): any {
        return this._disorderID;
    }

    /*
     * Returns the name of the disorder
     */
    getName(): any {
        return this._name;
    }

    load(callWhenReady: any): any {
        var baseOMIMServiceURL = Disorder.getOMIMServiceURL();
        var queryURL           = baseOMIMServiceURL + '&q=id:' + this._disorderID;
        fetch(queryURL, { method: 'GET' })
            .then(response => response.text())
            .then(text => this.onDataReady(text))
            .catch(err => {
                console.log("Failed to load DISORDER TERM: id = '" + Disorder.desanitizeID(this._disorderID) + "' setting name to ID");
                this._name = Disorder.desanitizeID(this._disorderID);
            })
            .finally(() => { if (typeof callWhenReady === 'function') callWhenReady(); });
    }

    onDataReady(responseText: any): any {
        try {
            var parsed = JSON.parse(responseText);
            //console.log(JSON.stringify(parsed));
            console.log('LOADED DISORDER: disorder id = ' + this._disorderID + ', name = ' + parsed.rows[0].name);
            this._name = parsed.rows[0].name;
        } catch (err) {
            console.log('[LOAD DISORDER] Error: ' +  err);
        }
    }

    /*
     * IDs are used as part of HTML IDs in the Legend box, which breaks when IDs contain some non-alphanumeric symbols.
     * For that purpose these symbols in IDs are converted in memory (but not in the stored pedigree) to some underscores.
     */
    static sanitizeID(disorderID: any): any {
        if (isInt(disorderID)) {
            return disorderID;
        }
        var temp = disorderID.replace(/[\(\[]/g, '_L_');
        temp = temp.replace(/[\)\]]/g, '_J_');
        return temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
    }

    static desanitizeID(disorderID: any): any {
        var temp = disorderID.replace(/__/g, ' ');
        temp = temp.replace(/_L_/g, '(');
        return temp.replace(/_J_/g, ')');
    }

    static getOMIMServiceURL(): any {
        return (window as any).editor ? (window as any).editor.getOmimServiceUrl() : '';
    }
}
