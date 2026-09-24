// localEditor.html creates an editor on page load, and its Controller listens for events such
// as pedigree:node:setproperty on `document`. A test that builds its own editor with
// window.OpenPedigree.initialiseEditor() leaves that first Controller listening, so every
// property change is handled twice - once per Controller, both acting on the current editor.
// Usually the second pass finds the value already applied and does nothing, but not always: a
// value a setter rejected on the first pass can be accepted on the second (this hid a real
// date-ordering bug), and a strictly compared value that never equals what's stored (a date
// string vs the stored Date) is applied again, adding a second undo step.
//
// The Controller's listeners are arrow functions calling this.handleX(e), so shadowing its
// handle* methods on the instance retires it completely. (The first editor's other leftover
// listeners - node-menu colour events, keydown, mousedown, window resize - don't touch
// property changes or undo.) Call this before initialiseEditor().
export async function retireAutoCreatedEditor(page) {
  await page.evaluate(() => {
    const oldController = window.editor && window.editor.getController && window.editor.getController();
    if (!oldController) {
      return;
    }
    Object.getOwnPropertyNames(Object.getPrototypeOf(oldController))
      .filter((name) => name.startsWith('handle'))
      .forEach((name) => { oldController[name] = () => {}; });
  });
}
