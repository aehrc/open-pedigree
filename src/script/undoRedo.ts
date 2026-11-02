class State {
  serializedState: any;
  eventToGetToThisState: any;
  eventToUndo: any;

  constructor(serializedState: any, eventToGetToThisState: any, eventToUndo: any) {
    this.serializedState = serializedState;
    this.eventToGetToThisState = eventToGetToThisState;
    this.eventToUndo = eventToUndo;
  }
}

export default class ActionStack {
  _currentState: number;
  _stack: any[];
  _MAXUNDOSIZE: number;
  _newStepNext: boolean;

  constructor() {
    this._currentState = 0;
    this._stack = [];
    this._MAXUNDOSIZE = 100;
    this._newStepNext = false;
  }

  // The next change is a step of its own, not combined with the current one: called when the user
  // goes back to a step (an edit combined into it would make one undo skip its own value) and when
  // the node menu opens or closes (typing in a field again later is a new edit).
  startNewStep(): void {
    this._newStepNext = true;
  }

  redo(): void {
    const nextState = this._getNextState();
    if (!nextState) {
      return;
    }

    this.startNewStep();
    if (nextState.eventToGetToThisState) {
      const memo = Object.assign({}, nextState.eventToGetToThisState.memo, { noUndoRedo: true });
      document.dispatchEvent(new CustomEvent(nextState.eventToGetToThisState.eventName, { detail: memo }));
      this._currentState++;
      return;
    }

    editor.getSaveLoadEngine().createGraphFromSerializedData(nextState.serializedState, true);
    this._currentState++;
  }

  undo(): void {
    const prevState = this._getPreviousState();
    if (!prevState) {
      return;
    }

    this.startNewStep();
    const currentState = this._getCurrentState();
    if (currentState.eventToUndo) {
      const memo = Object.assign({}, currentState.eventToUndo.memo, { noUndoRedo: true });
      document.dispatchEvent(new CustomEvent(currentState.eventToUndo.eventName, { detail: memo }));
      this._currentState--;
      return;
    }

    editor.getSaveLoadEngine().createGraphFromSerializedData(prevState.serializedState, true);
    this._currentState--;
  }

  addState(eventToGetToThisState: any, eventToUndo: any, serializedState: any): void {
    eventToGetToThisState = ActionStack._replayable(eventToGetToThisState);
    eventToUndo = ActionStack._replayable(eventToUndo);

    if (this._currentState < this._size()) {
      this._stack.splice(this._currentState, this._stack.length - this._currentState);
    }

    if (!serializedState) {
      serializedState = editor.getSaveLoadEngine().serialize();
    }

    const state = new State(serializedState, eventToGetToThisState, eventToUndo);

    const newStep = this._newStepNext;
    this._newStepNext = false;

    const currentState = this._getCurrentState();
    if (
      !newStep &&
      eventToGetToThisState &&
      currentState &&
      currentState.eventToGetToThisState &&
      currentState.eventToGetToThisState.eventName == 'pedigree:node:setproperty' &&
      eventToGetToThisState.eventName == 'pedigree:node:setproperty' &&
      this._combinableEvents(currentState.eventToGetToThisState, eventToGetToThisState)
    ) {
      currentState.eventToGetToThisState = eventToGetToThisState;
      currentState.serializedState = serializedState;
      return;
    }

    this._addNewest(state);

    if (this._size() > this._MAXUNDOSIZE) {
      this._removeOldest();
    }
  }

  // The Controller hands over the DOM CustomEvent it handled (name in .type, payload in .detail);
  // redo, undo and combining read the {eventName, memo} shape of its hand-built undo events.
  static _replayable(event: any): any {
    if (!event || event.eventName) {
      return event;
    }
    return { eventName: event.type, memo: event.detail || {} };
  }

  // Keys typed in one text field, each sent as its own change. Only changes to that one property
  // combine: the step keeps the first change's undo and the last change's redo, so anything else
  // either changed (a patient link also sets the name, say) would be lost from one or the other.
  _combinableEvents(event1: any, event2: any): boolean {
    if (
      !event1.memo.hasOwnProperty('nodeID') ||
      !event2.memo.hasOwnProperty('nodeID') ||
      event1.memo.nodeID != event2.memo.nodeID
    ) {
      return false;
    }
    const setters1 = Object.keys(event1.memo.properties || {});
    const setters2 = Object.keys(event2.memo.properties || {});
    return setters1.length == 1 && setters2.length == 1 && setters1[0] == setters2[0] &&
      ['setFirstName', 'setLastName', 'setComments'].indexOf(setters1[0]) != -1;
  }

  _size(): number {
    return this._stack.length;
  }

  _addNewest(state: any): void {
    this._stack.push(state);
    this._currentState++;
  }

  _removeOldest(): void {
    this._stack.splice(0, 1);
    this._currentState--;
  }

  _getCurrentState(): any {
    return this._size() == 0 || this._currentState == 0 ? null : this._stack[this._currentState - 1];
  }

  _getNextState(): any {
    return this._size() <= 1 || this._currentState >= this._size() ? null : this._stack[this._currentState];
  }

  _getPreviousState(): any {
    return this._size() == 1 || this._currentState <= 1 ? null : this._stack[this._currentState - 2];
  }

  _debug_print_states(): void {
    console.log('------------');
    for (let i = 0; i < this._stack.length; i++) {
      console.log(
        '[' + i + '] EventToState: ' + JSON.stringify(this._stack[i].eventToGetToThisState) + '\n' +
        '    EventUndo: ' + JSON.stringify(this._stack[i].eventToUndo) + '\n' +
        '    EventSerial: ' + JSON.stringify(this._stack[i].serializedState)
      );
    }
    console.log('------------');
  }
}
