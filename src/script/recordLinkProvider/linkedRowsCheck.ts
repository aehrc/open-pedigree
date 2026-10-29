import { classifyLinkedRows, snapshotKey } from 'pedigree/recordLinkProvider/staleLinkedRows';
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

  constructor(editor: any) {
    this._editor = editor;
    this._ran = false;
    this._rows = {};
    this._changed = [];
    this._missing = [];
    this._otherRecord = [];
    this._notice = null;
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
          return _this._editor._linkedRecordRefreshChanges(node, answers, false);
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
   * Brings each changed person's record in, as closing Edit in REDCap does (one undo step each),
   * then removes the marks and the notice. The pedigree is then unsaved, as after any edit.
   */
  update(): void {
    var _this = this;
    var changed = this._changed;
    this._clear();
    changed.forEach(function(person: any) {
      _this._nodesMatching(person).forEach(function(node: any) {
        var row = _this._rows[person.ref];
        if (row && Array.isArray(row.answers)) {
          _this._editor._dispatchLinkedRecordRefresh(node.getID(), row.answers, person.ref);
        }
      });
    });
  }

  dismiss(): void {
    this._clear();
  }

  _clear(): void {
    this._changed = [];
    this._missing = [];
    this._otherRecord = [];
    this.refreshMarks();
  }

  /**
   * Re-applies the marks and notice to the people as they are now: anyone whose ref or snapshot
   * has changed since the check (re-linked, refreshed, removed) drops out.
   */
  refreshMarks(): void {
    var _this = this;
    var stillThere = function(person: any) { return _this._nodesMatching(person).length > 0; };
    this._changed = this._changed.filter(stillThere);
    this._missing = this._missing.filter(stillThere);
    this._otherRecord = this._otherRecord.filter(stillThere);

    var view = this._editor.getView && this._editor.getView();
    if (view) {
      var marked = [] as any[];
      this._changed.forEach(function(person: any) {
        marked = marked.concat(_this._nodesMatching(person));
      });
      this._persons().forEach(function(node: any) {
        var graphics = node.getGraphics && node.getGraphics();
        if (graphics && typeof graphics.setLinkedRecordChangedMark === 'function') {
          graphics.setLinkedRecordChangedMark(marked.indexOf(node) >= 0);
        }
      });
    }
    this._renderNotice();
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

  // The people now linked to this person's record with the snapshot they were checked with.
  _nodesMatching(person: LinkedPerson<any>): any[] {
    var _this = this;
    return this._persons().filter(function(node: any) {
      var state = _this._stateOf(node);
      return state.ref === person.ref && state.snapshot === person.snapshot;
    });
  }

  _renderNotice(): void {
    var lines = [] as string[];
    var changed = this._changed.length;
    if (changed > 0) {
      lines.push(changed === 1
        ? '1 person\'s linked record has changed since this pedigree was saved.'
        : changed + ' people\'s linked records have changed since this pedigree was saved.');
    }
    if (this._missing.length > 0) {
      lines.push('Linked to a record that no longer exists: ' + this._namesOf(this._missing) + '.');
    }
    if (this._otherRecord.length > 0) {
      lines.push('Linked to another record\'s rows, so not checked - link them again: ' + this._namesOf(this._otherRecord) + '.');
    }

    if (lines.length === 0) {
      this._notice && this._notice.remove();
      this._notice = null;
      return;
    }
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

  _namesOf(people: LinkedPerson<any>[]): string {
    var _this = this;
    var names = [] as string[];
    people.forEach(function(person) {
      _this._nodesMatching(person).forEach(function(node: any) {
        var name = [node.getFirstName && node.getFirstName(), node.getLastName && node.getLastName()]
          .filter(function(part: any) { return !!part; }).join(' ');
        names.push(name || 'an unnamed person');
      });
    });
    return names.join(', ');
  }
}
