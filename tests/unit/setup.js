// Minimal PrototypeJS Class.create() stub so modules using it can load in jsdom.
// Only the no-parent form Class.create({...methods}) is needed for the test import chain.
globalThis.Class = {
  create: function(parent, methods) {
    var proto = {};
    if (typeof parent === 'function') {
      proto = Object.create(parent.prototype);
      Object.assign(proto, methods || {});
    } else {
      Object.assign(proto, parent || {});
    }
    var klass = function() {
      if (typeof this.initialize === 'function') {
        this.initialize.apply(this, arguments);
      }
    };
    klass.prototype = proto;
    klass.prototype.constructor = klass;
    return klass;
  },
};
