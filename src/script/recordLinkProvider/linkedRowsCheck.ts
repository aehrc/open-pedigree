import { classifyLinkedRows, isRowChanged, snapshotKey } from 'pedigree/recordLinkProvider/staleLinkedRows';
import type { LinkedPerson } from 'pedigree/recordLinkProvider/staleLinkedRows';
import type { LinkedRow } from 'pedigree/recordLinkProvider/AbstractRecordLinkProvider';

/**
 * The check on opening a pedigree (pedigree-editor-stale-linked-rows): asks the record-link
 * provider for every linked person's record at once, marks the people whose records have changed
 * since the pedigree last took them in, and shows a notice offering to update them.
 *
 * Changed people are held by their ref and snapshot, not their node: node IDs shift as nodes are
 * removed, and a person re-linked or refreshed by Edit in REDCap no longer has the state that was
 * compared, so their mark goes (refreshMarks) and Update leaves them alone.
 */
export default class LinkedRowsCheck {
  _editor: any;
  _ran: boolean;
  _rows: { [ref: string]: LinkedRow };
  _changed: LinkedPerson<any>[];
  _missing: LinkedPerson<any>[];
  _otherRecord: LinkedPerson<any>[];
  _notice: HTMLElement | null;
  _noticeContent: string;
  _markedNodes: any[];

  constructor(editor: any) {
    this._editor = editor;
    this._ran = false;
    this._rows = {};
    this._changed = [];
    this._missing = [];
    this._otherRecord = [];
    this._notice = null;
    this._noticeContent = '';
    this._markedNodes = [];
    var refresh = this.refreshMarks.bind(this);
    // Anything that can re-link, refresh, remove or rebuild a person. Registered after the
    // Controller's own listeners, so these run once the change is applied.
    ['pedigree:node:setproperty', 'pedigree:node:remove', 'pedigree:undo', 'pedigree:redo',
      'pedigree:graph:clear', 'pedigree:load:finish'].forEach(function(eventName) {
      document.addEventListener(eventName, refresh);
    });
  }

  /**
   * Runs the check, once per editor. Nothing happens unless the provider has fetchLinkedRows, is
   * configured, and someone is linked; a failure is only logged.
   */
  run(): Promise<void> {
    if (this._ran) {
      return Promise.resolve();
    }
    this._ran = true;
    var provider = this._editor.getRecordLinkProvider();
    if (!provider || typeof provider.fetchLinkedRows !== 'function' || !provider.isConfigured()
        || this._editor.isReadOnlyMode()) {
      return Promise.resolve();
    }
    var people = this._linkedPeople().map(function(entry: any) {
      return { key: entry.node, ref: entry.ref, snapshot: entry.snapshot };
    });
    if (people.length === 0) {
      return Promise.resolve();
    }
    var refs = people.map(function(p: any) { return p.ref; }).filter(function(ref: string, i: number, all: string[]) {
      return all.indexOf(ref) === i;
    });
    var _this = this;
    return Promise.resolve()
      .then(function() { return provider.fetchLinkedRows(refs); })
      .then(function(rows: any) {
        var result = classifyLinkedRows(people, rows, function(node: any) {
          return _this._isInView(node) ? _this._stateOf(node) : null;
        }, function(node: any, answers: any) {
          return _this._changesFor(node, answers);
        });
        _this._rows = rows;
        _this._changed = result.changed;
        _this._missing = result.missing;
        _this._otherRecord = result.otherRecord;
        _this.refreshMarks();
      })
      .catch(function(err: any) {
        console.warn('Checking linked records for changes failed - the pedigree is shown as saved', err);
      });
  }

  /**
   * Brings each marked person's record in, as closing Edit in REDCap does (one undo step each).
   * The marks and the count go; the lines about missing and other-record links stay until
   * dismissed, as nothing was done about them. The pedigree is then unsaved, as after any edit.
   */
  update(): void {
    var _this = this;
    var marked = this._current().changed;
    this._changed = [];
    marked.forEach(function(entry: any) {
      var row = _this._rows[entry.person.ref];
      if (row && Array.isArray(row.answers)) {
        _this._editor._dispatchLinkedRecordRefresh(entry.node.getID(), row.answers, entry.person.ref);
      }
    });
    this.refreshMarks();
  }

  dismiss(): void {
    this._changed = [];
    this._missing = [];
    this._otherRecord = [];
    this.refreshMarks();
  }

  /**
   * Re-applies the marks and notice to the people as they are now. What the check found is kept,
   * and matched against each person's current ref and snapshot: someone re-linked or refreshed
   * since no longer matches (and an undo that puts them back matches again), and someone removed
   * isn't there to match.
   */
  refreshMarks(): void {
    var nothingFound = this._changed.length === 0 && this._missing.length === 0 && this._otherRecord.length === 0;
    if (nothingFound && this._markedNodes.length === 0 && !this._notice) {
      return;
    }
    var current = this._current();
    var marked = current.changed.map(function(entry: any) { return entry.node; });
    this._markedNodes.concat(marked).forEach(function(node: any) {
      var graphics = node.getGraphics && node.getGraphics();
      if (graphics && typeof graphics.setLinkedRecordChangedMark === 'function') {
        graphics.setLinkedRecordChangedMark(marked.indexOf(node) >= 0);
      }
    });
    this._markedNodes = marked;
    this._renderNotice(current);
  }

  /**
   * The people on the diagram now that match what the check found, each person once. A person
   * with nothing taken in from their record (an empty snapshot) is compared with what they show,
   * so they're only counted while that still differs from the record.
   */
  _current(): { changed: { node: any, person: LinkedPerson<any> }[], missing: any[], otherRecord: any[] } {
    var _this = this;
    var found: { [key: string]: { kind: string, person: LinkedPerson<any> } } = {};
    var add = function(kind: string) {
      return function(person: LinkedPerson<any>) { found[person.ref + '\n' + person.snapshot] = { kind: kind, person: person }; };
    };
    this._changed.forEach(add('changed'));
    this._missing.forEach(add('missing'));
    this._otherRecord.forEach(add('otherRecord'));
    var result = { changed: [] as any[], missing: [] as any[], otherRecord: [] as any[] };
    if (Object.keys(found).length === 0) {
      return result;
    }
    this._persons().forEach(function(node: any) {
      if (!node.getLinkedRecordRef()) {
        return;
      }
      var state = _this._stateOf(node);
      var match = found[state.ref + '\n' + state.snapshot];
      if (!match) {
        return;
      }
      if (match.kind === 'changed') {
        var row = _this._rows[state.ref];
        if (row && Array.isArray(row.answers) && isRowChanged(_this._changesFor(node, row.answers), state.snapshot)) {
          result.changed.push({ node: node, person: match.person });
        }
      } else {
        (result as any)[match.kind].push(node);
      }
    });
    return result;
  }

  // The refresh comparison for a person (see isRowChanged): whether the record would change what
  // they show, and whether it differs from their snapshot (regardless of key order).
  _changesFor(node: any, answers: any): { valuesChanged: boolean, snapshotChanged: boolean } {
    var changes = this._editor._linkedRecordRefreshChanges(node, answers, false);
    return {
      valuesChanged: this._editor._linkedRecordValuesDiffer(node, changes.properties),
      snapshotChanged: snapshotKey(changes.snapshot) !== this._stateOf(node).snapshot
    };
  }

  _persons(): any[] {
    var view = this._editor.getView && this._editor.getView();
    if (!view) {
      return [];
    }
    var nodeMap = view.getNodeMap();
    return Object.keys(nodeMap).map(function(id) { return nodeMap[id]; }).filter(function(node: any) {
      return node && node.getType && node.getType() === 'Person' && typeof node.getLinkedRecordRef === 'function';
    });
  }

  _linkedPeople(): { node: any, ref: string, snapshot: string }[] {
    var _this = this;
    return this._persons().filter(function(node: any) {
      return !!node.getLinkedRecordRef();
    }).map(function(node: any) {
      var state = _this._stateOf(node);
      return { node: node, ref: state.ref, snapshot: state.snapshot };
    });
  }

  _stateOf(node: any): { ref: string, snapshot: string } {
    return { ref: node.getLinkedRecordRef() || '', snapshot: snapshotKey(node.getLinkedRecordSnapshot()) };
  }

  _isInView(node: any): boolean {
    var view = this._editor.getView();
    return !!view && view.getNode(node.getID()) === node;
  }

  _renderNotice(current: { changed: any[], missing: any[], otherRecord: any[] }): void {
    var lines = [] as string[];
    var changed = current.changed.length;
    if (changed > 0) {
      lines.push(changed === 1
        ? '1 person\'s linked record has changed since this pedigree was saved.'
        : changed + ' people\'s linked records have changed since this pedigree was saved.');
    }
    if (current.missing.length > 0) {
      lines.push('Linked to a record that no longer exists: ' + this._namesOf(current.missing) + '.');
    }
    if (current.otherRecord.length > 0) {
      lines.push('Linked to another record\'s rows, so not checked - link them again: ' + this._namesOf(current.otherRecord) + '.');
    }

    if (lines.length === 0) {
      this._notice && this._notice.remove();
      this._notice = null;
      this._noticeContent = '';
      return;
    }
    // Rebuilt only when what it says changes, so a focused button keeps its focus.
    var content = JSON.stringify(lines);
    if (this._notice && content === this._noticeContent) {
      return;
    }
    this._noticeContent = content;
    if (!this._notice) {
      this._notice = document.createElement('div');
      this._notice.id = 'linked-records-notice';
      this._notice.className = 'linked-records-notice';
      this._notice.setAttribute('role', 'status');
      document.body.appendChild(this._notice);
    }
    var notice = this._notice;
    notice.textContent = '';
    lines.forEach(function(text) {
      var line = document.createElement('div');
      line.className = 'linked-records-notice-line';
      line.textContent = text;
      notice.appendChild(line);
    });
    var actions = document.createElement('div');
    actions.className = 'linked-records-notice-actions';
    if (changed > 0) {
      actions.appendChild(this._button('Update', 'linked-records-notice-update', this.update.bind(this)));
    }
    actions.appendChild(this._button('Dismiss', 'linked-records-notice-dismiss', this.dismiss.bind(this)));
    notice.appendChild(actions);
  }

  _button(label: string, className: string, onClick: () => void): HTMLButtonElement {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  _namesOf(nodes: any[]): string {
    return nodes.map(function(node: any) {
      var name = [node.getFirstName && node.getFirstName(), node.getLastName && node.getLastName()]
        .filter(function(part: any) { return !!part; }).join(' ');
      return name || 'an unnamed person';
    }).join(', ');
  }
}
