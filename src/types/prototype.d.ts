// Ambient declarations for PrototypeJS globals

declare var $$: (selector: string) => any[];
declare var $: (id: string | any) => any;
declare var $F: (element: any) => any;
declare var $A: (iterable: any) => any[];
declare var $R: (start: any, end: any, exclusive?: boolean) => any;

declare var Class: {
  create: (...args: any[]) => any;
};

declare var Ajax: {
  Request: new (url: string, options?: any) => any;
  Updater: new (container: any, url: string, options?: any) => any;
  PeriodicalUpdater: new (container: any, url: string, options?: any) => any;
  Response: any;
};

// PrototypeJS augments the DOM Element constructor with static methods
interface Window {
  Element: {
    new(tagName: string, attributes?: any): any;
    extend: (element: any) => any;
    addClassName: (element: any, className: string) => any;
    removeClassName: (element: any, className: string) => any;
    hasClassName: (element: any, className: string) => boolean;
    setStyle: (element: any, style: any) => any;
    getStyle: (element: any, property: string) => string;
    select: (element: any, selector: string) => any[];
    update: (element: any, content: any) => any;
    observe: (element: any, event: string, handler: Function) => any;
    stopObserving: (element: any, event: string, handler?: Function) => any;
    hide: (element: any) => any;
    show: (element: any) => any;
  };
  Event: any;
  editor: any;
}

// PrototypeJS augments Element prototype instances with extra methods
interface Element {
  update: (content?: any) => any;
  insert: (content: any) => any;
  wrap: (wrapper: any, attributes?: any) => any;
  observe: (eventName: string, handler: Function) => any;
  stopObserving: (eventName?: string, handler?: Function) => any;
  fire: (eventName: string, memo?: any) => any;
  down: (selector?: any, index?: number) => any;
  up: (selector?: any, index?: number) => any;
  next: (selector?: any, index?: number) => any;
  previous: (selector?: any, index?: number) => any;
  select: (...args: any[]) => any[];
  addClassName: (className: string) => any;
  removeClassName: (className: string) => any;
  hasClassName: (className: string) => boolean;
  toggleClassName: (className: string) => any;
  setStyle: (styles: any) => any;
  getStyle: (style: string) => string;
  getDimensions: () => any;
  getWidth: () => number;
  getHeight: () => number;
  hide: () => any;
  show: () => any;
  visible: () => boolean;
  toggle: () => any;
  remove: () => any;
  replace: (content?: any) => any;
  writeAttribute: (name: any, value?: any) => any;
  readAttribute: (name: string) => any;
  retrieve: (key: string, defaultValue?: any) => any;
  store: (key: string, value: any) => any;
  getLayout: () => any;
  clonePosition: (source: any, options?: any) => any;
  positionedOffset: () => any;
  cumulativeOffset: () => any;
  viewportOffset: () => any;
  absolutize: () => any;
  relativize: () => any;
  scrollTo: () => any;
  makeClipping: () => any;
  undoClipping: () => any;
  makePositioned: () => any;
  undoPositioned: () => any;
  style: any;
  title: string;
  name: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  readOnly: boolean;
  type: string;
  href: string;
  src: string;
  innerHTML: string;
  textContent: string;
  innerText: string;
  text: string;
  immediate: any;
  pedigreeData: any;
}

// PrototypeJS augments Array prototype with extra methods
interface Array<T> {
  each: (iterator: (value: T, index: number) => void) => Array<T>;
  invoke: (method: string, ...args: any[]) => any[];
  pluck: (property: string) => any[];
  without: (...values: any[]) => Array<T>;
  flatten: () => any[];
  compact: () => Array<T>;
  uniq: () => Array<T>;
  sortBy: (iterator: Function) => Array<T>;
  min: () => T;
  max: () => T;
  size: () => number;
  first: () => T;
  last: () => T;
  detect: (iterator: Function) => T;
  findAll: (iterator: Function) => Array<T>;
  select: (iterator: Function) => Array<T>;
  reject: (iterator: Function) => Array<T>;
  all: (iterator?: Function) => boolean;
  any: (iterator?: Function) => boolean;
  intersect: (array: Array<T>) => Array<T>;
  include: (value: any) => boolean;
  inGroupsOf: (number: number, fillWith?: any) => any[];
  inject: (memo: any, iterator: Function) => any;
  toArray: () => Array<T>;
  zip: (...args: any[]) => any[];
}

// PrototypeJS augments Function prototype
interface Function {
  bindAsEventListener: (context: any, ...args: any[]) => Function;
  bind: (context: any, ...args: any[]) => any;
  curry: (...args: any[]) => Function;
  delay: (timeout: number, ...args: any[]) => number;
  wrap: (wrapper: Function) => Function;
  methodize: () => Function;
  argumentNames: () => string[];
}

// PrototypeJS augments Number prototype
interface Number {
  round: () => number;
  ceil: () => number;
  floor: () => number;
  abs: () => number;
  times: (iterator: Function) => void;
  upto: (end: number, iterator: Function) => void;
  downto: (end: number, iterator: Function) => void;
  succ: () => number;
  toPaddedString: (length: number, radix?: number) => string;
}

// PrototypeJS augments String prototype
interface String {
  strip: () => string;
  stripTags: () => string;
  stripScripts: () => string;
  extractScripts: () => string[];
  evalScripts: () => any[];
  escapeHTML: () => string;
  unescapeHTML: () => string;
  toQueryParams: (separator?: string) => any;
  parseQuery: (separator?: string) => any;
  toArray: () => string[];
  succ: () => string;
  times: (count: number) => string;
  camelize: () => string;
  capitalize: () => string;
  underscore: () => string;
  dasherize: () => string;
  inspect: (useDoubleQuotes?: boolean) => string;
  unfilterJSON: (filter?: RegExp) => string;
  isJSON: () => boolean;
  evalJSON: (sanitize?: boolean) => any;
  include: (pattern: string) => boolean;
  startsWith: (pattern: string) => boolean;
  endsWith: (pattern: string) => boolean;
  empty: () => boolean;
  blank: () => boolean;
  interpolate: (object: any, pattern?: RegExp) => string;
  scan: (pattern: RegExp, iterator: Function) => string;
  gsub: (pattern: RegExp | string, replacement: any) => string;
  sub: (pattern: RegExp | string, replacement: any, count?: number) => string;
  truncate: (length?: number, truncation?: string) => string;
}

// Declare editor as a global (set by PedigreeEditor constructor)
declare var editor: any;

// jQuery global
declare var jQuery: any;

// Control (Scriptaculous)
declare var Control: any;

interface Document {
  observe: (eventName: string, handler: Function) => any;
  fire: (eventName: string, memo?: any) => any;
  stopObserving: (eventName?: string, handler?: Function) => any;
  viewport: any;
}

declare var PhenoTips: any;
declare var XWiki: any;
declare var OpenPedigree: any;
declare var Prototype: any;
declare var Effect: any;
declare var Draggable: any;
declare var Droppables: any;
