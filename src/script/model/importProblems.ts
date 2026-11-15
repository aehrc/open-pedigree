/**
 * Every problem an import finds, rather than only the first (and notes on what it left out).
 *
 * An importer records a problem with one person, row or link (`add`), sets that aside and checks the
 * rest, then calls `throwIfAny()` wherever going on would mean building on what it set aside - and
 * always before its result is used. A problem that leaves the rest of the input unreadable is still
 * thrown at once, on its own.
 *
 * What is thrown: one problem (and no notes) is thrown as its text, exactly as importers always have;
 * otherwise an ImportProblems, whose string form is the whole readable message, so a caller showing
 * `'...' + err` shows them all.
 *
 * Notes never fail an import: on success they ride on the graph (`importNotes`, never saved), on
 * failure on the ImportProblems; a caller decides whether to show them (only the import dialog does).
 */

/** At most this many problems (or notes) are listed in a message; all are kept. */
export const MAX_LISTED = 20;

/** The items as numbered lines, at most MAX_LISTED of them, then how many more there are. */
export function numberedList(items: string[]): string {
  const lines = items.slice(0, MAX_LISTED).map((item, i) => (i + 1) + '. ' + item);
  if (items.length > MAX_LISTED) {
    lines.push('... and ' + (items.length - MAX_LISTED) + ' more');
  }
  return lines.join('\n');
}

/** The message for these problems: a single one as it is, several as a numbered list. */
export function problemsMessage(problems: string[]): string {
  if (problems.length === 1) {
    return problems[0];
  }
  return 'Unable to import pedigree: ' + problems.length + ' problems found:\n' + numberedList(problems);
}

/** The message for notes shown after a successful import. */
export function notesMessage(notes: string[]): string {
  return 'Imported, with ' + notes.length + (notes.length === 1 ? ' note' : ' notes') + ':\n' + numberedList(notes);
}

/** A failed import: every problem found, and any notes. Reads as its message wherever it's shown. */
export class ImportProblems {
  problems: string[];
  notes: string[];
  message: string;

  constructor(problems: string[], notes: string[] = []) {
    this.problems = problems.slice();
    this.notes = notes.slice();
    this.message = problemsMessage(this.problems);
  }

  /** The message, then the notes after "Also noted:" (for the import dialog). */
  messageWithNotes(): string {
    if (this.notes.length === 0) {
      return this.message;
    }
    return this.message + '\n\nAlso noted:\n' + numberedList(this.notes);
  }

  toString(): string {
    return this.message;
  }
}

/** Problems and notes as an importer finds them, in order, each listed once. */
export class ProblemList {
  problems: string[] = [];
  notes: string[] = [];

  add(problem: any): void {
    const text = String(problem);
    if (this.problems.indexOf(text) === -1) {
      this.problems.push(text);
    }
  }

  note(text: string): void {
    if (this.notes.indexOf(text) === -1) {
      this.notes.push(text);
    }
  }

  /** Takes in another import's problems and notes (one importer handing over to another). */
  absorb(err: any): void {
    if (err instanceof ImportProblems) {
      err.problems.forEach((p) => this.add(p));
      err.notes.forEach((n) => this.note(n));
    } else {
      this.add(err);
    }
  }

  get size(): number {
    return this.problems.length;
  }

  /** Fails the import with everything found so far, if anything was. */
  throwIfAny(): void {
    if (this.problems.length === 0) {
      return;
    }
    if (this.problems.length === 1 && this.notes.length === 0) {
      throw this.problems[0];
    }
    throw new ImportProblems(this.problems, this.notes);
  }

  /** Puts the notes on the graph an import returns (never saved: see BaseGraph). */
  attachNotes(graph: any): any {
    if (this.notes.length > 0) {
      graph.importNotes = this.notes.slice();
    }
    return graph;
  }
}
