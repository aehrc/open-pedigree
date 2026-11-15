import { ImportProblems, ProblemList } from 'pedigree/model/importProblems';

/**
 * Validates a graph built by an importer, and fails with every problem found (see importProblems),
 * each one of:
 *
 *  1) "Unsupported pedigree: some components of the imported pedigree are disconnected from each other (<where>)"
 *  2) "Unable to import pedigree (<the reason validate gave>)"
 *
 * `found` is the importer's own list, with its notes: the graph is only checked when it holds no
 * problems (an importer calls throwIfAny first), so a part it set aside isn't reported again here.
 *
 * A wrapper around BaseGraph.validate, whose exceptions change from version to version and are
 * written for developers ("Assertion failed: ..."). Shared by every importer (PED and the other
 * text formats, the internal format, GA4GH and legacy FHIR) so they all report problems alike.
 */
/**
 * An importer's failure while building a graph from data it hasn't validated yet, in the same
 * words as a validation failure ("Unable to import pedigree (...)"), unless it already is one.
 */
export function importError(err: any): any {
  if (err instanceof ImportProblems) {
    // (every problem already found, each already worded)
    return err;
  }
  const reason = ((err && err.message) ? err.message : String(err));
  if (reason.startsWith('Unable to import pedigree') || reason.startsWith('Unsupported pedigree')) {
    return reason;
  }
  return 'Unable to import pedigree (' + reason.replace(/^Assertion failed: /, '') + ')';
}

// One of validate's problems as the user sees it: a disconnected part as unsupported, anything else
// as "Unable to import pedigree (...)".
function reworded(err: any): string {
  const reason = ((err && err.message) ? err.message : String(err)).replace(/^Assertion failed: /, '');
  if (reason.indexOf('disconnected component') !== -1) {
    // (the reason gives the part of the graph found cut off from the rest)
    return 'Unsupported pedigree: some components of the imported pedigree are disconnected from each other (' + reason + ')';
  }
  return importError(err);
}

export default function validateImportedGraph(newG: any, found: ProblemList = new ProblemList()): void {
  let problems: any[];
  try {
    // every problem (BaseGraph.findProblems); a graph that can only validate gives its first
    problems = (typeof newG.findProblems === 'function') ? newG.findProblems() : (newG.validate(), []);
  } catch (err) {
    // validate throws strings, but anything it calls may throw an Error
    problems = [err];
  }
  problems.forEach((problem) => found.add(reworded(problem)));
  found.throwIfAny();
}
