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

  constructor() {
    this._currentState = 0;
    this._stack = [];
    this._MAXUNDOSIZE = 100;
  }

  redo(): void {
    const nextState = this._getNextState();
    if (!nextState) {
      return;
    }

    if (nextState.eventToGetToThisState) {
      const memo = nextState.eventToGetToThisState.memo;
      memo['noUndoRedo'] = true;
      document.fire(nextState.eventToGetToThisState.eventName, memo);
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

    const currentState = this._getCurrentState();
    if (currentState.eventToUndo) {
      const memo = currentState.eventToUndo.memo;
      memo['noUndoRedo'] = true;
      document.fire(currentState.eventToUndo.eventName, memo);
      this._currentState--;
      return;
    }

    editor.getSaveLoadEngine().createGraphFromSerializedData(prevState.serializedState, true);
    this._currentState--;
  }

  addState(eventToGetToThisState: any, eventToUndo: any, serializedState: any): void {
    if (this._currentState < this._size()) {
      this._stack.splice(this._currentState, this._stack.length - this._currentState);
    }

    if (!serializedState) {
      serializedState = editor.getSaveLoadEngine().serialize();
    }

    const state = new State(serializedState, eventToGetToThisState, eventToUndo);

    const currentState = this._getCurrentState();
    if (
      eventToGetToThisState &&
      currentState &&
      currentState.eventToGetToThisState &&
      currentState.eventToGetToThisState.eventName == 'pedigree:node:setproperty' &&
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

  _combinableEvents(event1: any, event2: any): boolean {
    if (
      !event1.memo.hasOwnProperty('nodeID') ||
      !event2.memo.hasOwnProperty('nodeID') ||
      event1.memo.nodeID != event2.memo.nodeID
    ) {
      return false;
    }
    if (event1.memo.properties.hasOwnProperty('setFirstName') && event2.memo.properties.hasOwnProperty('setFirstName')) {
      return true;
    }
    if (event1.memo.properties.hasOwnProperty('setLastName') && event2.memo.properties.hasOwnProperty('setLastName')) {
      return true;
    }
    if (event1.memo.properties.hasOwnProperty('setComments') && event2.memo.properties.hasOwnProperty('setComments')) {
      return true;
    }
    return false;
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
