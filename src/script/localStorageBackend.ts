import { createTransportBackend } from './transportBackend';

/**
 * The backend for open-pedigree's standalone pages: the pedigree is read from and saved to
 * `localStorage[<key>]` as `{value, svg, context}` JSON. A host that opens the editor from another
 * window should hand the pedigree over directly instead (`OpenPedigree.createTransportBackend`):
 * anything in localStorage stays readable by every page on the origin.
 */
const LocalStorageBackend = createTransportBackend({
    receive: function (key) {
        return JSON.parse(localStorage.getItem(key));
    },
    send: function (key, data) {
        localStorage.setItem(key, JSON.stringify(data, null, 2));
    }
});

export default LocalStorageBackend;
