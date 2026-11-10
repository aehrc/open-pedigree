/**
 * Validates a graph built by an importer, and throws one of:
 *
 *  1) "Unsupported pedigree: some components of the imported pedigree are disconnected from each other (<where>)"
 *  2) "Unable to import pedigree (<the reason validate gave>)"
 *
 * A wrapper around BaseGraph.validate, whose exceptions change from version to version and are
 * written for developers ("Assertion failed: ..."). Shared by every importer (PED and the other
 * text formats, the internal format, GA4GH and legacy FHIR) so they all report problems alike.
 */
export default function validateImportedGraph(newG: any): void {
  try {
    newG.validate();
  } catch (err) {
    // validate throws strings, but anything it calls may throw an Error
    const reason = ((err && err.message) ? err.message : String(err)).replace(/^Assertion failed: /, '');
    if (reason.indexOf('disconnected component') !== -1) {
      // (the reason gives the first part of the graph found cut off from the rest)
      throw 'Unsupported pedigree: some components of the imported pedigree are disconnected from each other (' + reason + ')';
    }
    throw 'Unable to import pedigree (' + reason + ')';
  }
}
