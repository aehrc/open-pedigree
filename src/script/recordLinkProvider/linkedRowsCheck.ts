import { classifyLinkedRows, snapshotKey, stateKey } from 'pedigree/recordLinkProvider/staleLinkedRows';
import type { LinkedPerson } from 'pedigree/recordLinkProvider/staleLinkedRows';
import type { LinkedRow } from 'pedigree/recordLinkProvider/AbstractRecordLinkProvider';

/**
 * The check on opening a pedigree (pedigree-editor-stale-linked-rows): asks the record-link
 * provider for every linked person's record at once, marks the people whose records have changed
 * since the pedigree last took them in, and shows a notice offering to update them.
 *
 * What the check found is held by each person's ref and snapshot, not their node: node IDs shift
 * as nodes are removed. The marks follow the people on the diagram - each refresh matches what was
 * found against each person's current ref and snapshot, so a re-link, refresh or Update removes a
 * person's mark, and an undo that puts them back puts it back.
 */
export default class LinkedRowsCheck {
  _editor: any;
  _ran: boolean;
  _rows: { [ref: string]: LinkedRow };
  // People whose records answered: marked while refreshing them would change what they show.
  _answered: LinkedPerson<any>[];
  _missing: LinkedPerson<any>[];
  _otherRecord: LinkedPerson<any>[];
  _notice: HTMLElement | null;
  _noticeContent: string;
  _markedNodes: any[];
  _updating: boolean;

  constructor(editor: any) {
    this._editor = editor;
    this._ran = false;
    this._rows = Object.create(null);
    this._answered = [];
    this._missing = [];
    this._otherRecord = [];
    this._notice = null;
    this._noticeContent = '';
    this._markedNodes = [];
    this._updating = false;
    var refresh = this.refreshMarks.bind(this);
    // Anything that can change, re-link, remove or rebuild a person. Registered after the
    // Controller's own listeners, so these run once the change is applied. Each refresh works out
    // afresh who has changed: one property change can change other people too (e.g. twins).
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
    var provider = this._provider();
    if (!provider || this._editor.isReadOnlyMode()) {
      return Promise.resolve();
    }
    var people = this._linkedPeople();
    if (people.length === 0) {
      return Promise.resolve();
    }
    var _this = this;
    return Promise.resolve()
      .then(function() { return provider.fetchLinkedRows(uniqueRefs(people)); })
      .then(function(rows: any) {
        var result = classifyLinkedRows(people, rows, function(node: any) {
          return _this._isInView(node) ? _this._stateOf(node) : null;
        });
        _this._rows = Object.create(null);
        _this._mergeRows(rows);
        _this._answered = result.answered;
        _this._missing = result.missing;
        _this._otherRecord = result.otherRecord;
        _this.refreshMarks();
      })
      .catch(function(err: any) {
        console.warn('Checking linked records for changes failed - the pedigree is shown as saved', err);
      });
  }

  /**
   * Brings each marked person's record in, as closing Edit in REDCap does (one undo step each),
   * fetching the records again first so what's applied is current. The marks and the count go;
   * the lines about missing and other-record links stay until dismissed, as nothing was done about
   * them. The pedigree is then unsaved, as after any edit.
   */
  update(): Promise<void> {
    var provider = this._provider();
    var marked = this._current().changed;
    if (this._updating || !provider || marked.length === 0) {
      return Promise.resolve();
    }
    // Also holds back refreshMarks until every person is updated: one refresh at the end.
    this._updating = true;
    this._renderNotice(this._current());
    var _this = this;
    var asked = marked.map(function(node: any) {
      return { node: node, ref: node.getLinkedRecordRef(), state: _this._stateKey(node) };
    });
    return Promise.resolve()
      .then(function() { return provider.fetchLinkedRows(uniqueRefs(asked)); })
      .then(function(rows: any) {
        _this._mergeRows(rows);
        asked.forEach(function(entry: any) {
          // Re-linked, refreshed or removed while the records were being fetched: leave them.
          if (!_this._isInView(entry.node) || _this._stateKey(entry.node) !== entry.state) {
            return;
          }
          var row = _this._rows[entry.ref];
          var person = { key: entry.node, ref: entry.ref, snapshot: _this._stateOf(entry.node).snapshot };
          if (row && Array.isArray(row.answers)) {
            _this._editor._dispatchLinkedRecordRefresh(entry.node.getID(), row.answers, entry.ref);
          } else if (row && row.otherRecord) {
            _this._otherRecord.push(person);
          } else if (row && row.missing) {
            // Deleted since the pedigree was opened.
            _this._missing.push(person);
          }
        });
      })
      .catch(function(err: any) {
        console.warn('Fetching linked records to update them failed - nothing was changed', err);
      })
      .then(function() {
        _this._updating = false;
        _this.refreshMarks();
      });
  }

  dismiss(): void {
    this._answered = [];
    this._missing = [];
    this._otherRecord = [];
    this.refreshMarks();
  }

  // The provider's answers, into _rows: own keys only, and _rows has no prototype, so a ref can't
  // reach Object.prototype (e.g. '__proto__', 'constructor').
  _mergeRows(rows: any): void {
    var _this = this;
    if (rows && typeof rows === 'object') {
      Object.keys(rows).forEach(function(ref) { _this._rows[ref] = rows[ref]; });
    }
  }

  /** Re-applies the marks and notice to the people as they are now. */
  refreshMarks(): void {
    if (this._updating) {
      return;
    }
    var nothingFound = this._answered.length === 0 && this._missing.length === 0 && this._otherRecord.length === 0;
    if (nothingFound && this._markedNodes.length === 0 && !this._notice) {
      return;
    }
    var current = this._current();
    var marked = current.changed;
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
   * whose record answered counts as changed while refreshing them from it would change what they
   * show - so not once the diagram has been edited to match it, and again if it's edited away.
   */
  _current(): { changed: any[], missing: any[], otherRecord: any[] } {
    var _this = this;
    var found: { [state: string]: string } = {};
    var add = function(kind: string) {
      return function(person: LinkedPerson<any>) { found[stateKey(person.ref, person.snapshot)] = kind; };
    };
    this._answered.forEach(add('changed'));
    this._missing.forEach(add('missing'));
    this._otherRecord.forEach(add('otherRecord'));
    var result: any = { changed: [], missing: [], otherRecord: [] };
    if (Object.keys(found).length === 0) {
      return result;
    }
    this._persons().forEach(function(node: any) {
      if (!node.getLinkedRecordRef()) {
        return;
      }
      var kind = found[_this._stateKey(node)];
      if (kind && (kind !== 'changed' || _this._wouldChange(node))) {
        result[kind].push(node);
      }
    });
    return result;
  }

  _wouldChange(node: any): boolean {
    var row = this._rows[node.getLinkedRecordRef()];
    return !!row && Array.isArray(row.answers)
      && this._editor._linkedRecordRefreshChanges(node, row.answers, false).valuesChanged;
  }

  // The provider, if it can fetch linked records in batches and is configured.
  _provider(): any {
    var provider = this._editor.getRecordLinkProvider();
    return provider && typeof provider.fetchLinkedRows === 'function' && provider.isConfigured() ? provider : null;
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

  _linkedPeople(): LinkedPerson<any>[] {
    var _this = this;
    return this._persons().filter(function(node: any) {
      return !!node.getLinkedRecordRef();
    }).map(function(node: any) {
      var state = _this._stateOf(node);
      return { key: node, ref: state.ref, snapshot: state.snapshot };
    });
  }

  _stateOf(node: any): { ref: string, snapshot: string } {
    return { ref: node.getLinkedRecordRef() || '', snapshot: snapshotKey(node.getLinkedRecordSnapshot()) };
  }

  _stateKey(node: any): string {
    var state = this._stateOf(node);
    return stateKey(state.ref, state.snapshot);
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
      lines.push('Linked to a record that no longer exists: ' + namesOf(current.missing) + '.');
    }
    if (current.otherRecord.length > 0) {
      lines.push('Linked to another record\'s rows, so not checked - link them again: ' + namesOf(current.otherRecord) + '.');
    }

    if (lines.length === 0) {
      this._notice && this._notice.remove();
      this._notice = null;
      this._noticeContent = '';
      return;
    }
    // Rebuilt only when what it shows changes, so a focused button keeps its focus.
    var content = JSON.stringify([lines, this._updating]);
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
      var update = button(this._updating ? 'Updating...' : 'Update', 'linked-records-notice-update', this.update.bind(this));
      update.disabled = this._updating;
      actions.appendChild(update);
    }
    // Not while updating: the update's answer would bring back what was dismissed.
    var dismiss = button('Dismiss', 'linked-records-notice-dismiss', this.dismiss.bind(this));
    dismiss.disabled = this._updating;
    actions.appendChild(dismiss);
    notice.appendChild(actions);
  }
}

function uniqueRefs(people: { ref: string }[]): string[] {
  return Array.from(new Set(people.map(function(person) { return person.ref; })));
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  var element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function namesOf(nodes: any[]): string {
  return nodes.map(function(node: any) {
    var name = [node.getFirstName && node.getFirstName(), node.getLastName && node.getLastName()]
      .filter(function(part: any) { return !!part; }).join(' ');
    return name || 'an unnamed person';
  }).join(', ');
}
