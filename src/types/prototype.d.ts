// Ambient declarations for PrototypeJS globals used in source files.
// Types are intentionally loose (any) to minimise churn during migration.
// skipLibCheck: true prevents conflicts with lib.dom.d.ts re-declarations.

declare function $$(selector: string): any[];
declare function $(id: string | Element | any): any;
declare function $F(element: string | Element): any;

declare namespace Ajax {
  class Request {
    constructor(url: string, options?: any);
    [key: string]: any;
  }
}

declare namespace Class {
  function create(parent?: any, methods?: any): any;
}

// PrototypeJS augments Element instances with additional methods
interface Element {
  observe(eventName: string, handler: Function): any;
  stopObserving(eventName?: string, handler?: Function): any;
  show(): any;
  hide(): any;
  toggle(): any;
  update(content?: any): any;
  insert(content: any): any;
  wrap(tagName: string, attributes?: any): any;
  down(selector?: string | number): any;
  up(selector?: string): any;
  next(selector?: string): any;
  previous(selector?: string): any;
  addClassName(className: string): any;
  removeClassName(className: string): any;
  hasClassName(className: string): boolean;
  setStyle(styles: any): any;
  getStyle(style: string): string | null;
  getDimensions(): { width: number; height: number };
  cumulativeOffset(): { top: number; left: number };
  makePositioned(): any;
  identify(): string;
  select(selector: string): any[];
  readAttribute(name: string): string | null;
  writeAttribute(name: string, value?: any): any;
  on(eventName: string, handler: Function): any;
  fire(eventName: string, memo?: any): any;
  description?: any;
  viewport?: any;
}

// PrototypeJS also allows calling Element as a constructor with a tag name and attributes.
// Override to allow any-typed construction: new Element('div', {class: 'foo'})
declare var Element: any;

// PrototypeJS augments Element with static methods
declare namespace Element {
  function extend(element: any): any;
  function observe(element: any, eventName: string, handler: Function): any;
  function addClassName(element: any, className: string): any;
  function removeClassName(element: any, className: string): any;
}

interface Document {
  observe(eventName: string, handler: Function): any;
  stopObserving(eventName?: string, handler?: Function): any;
  fire(eventName: string, memo?: any): any;
  on(eventName: string, selector: string, handler: Function): any;
  viewport?: any;
}

// PrototypeJS augments Event with static fire/observe methods
declare var Event: any;

// PrototypeJS adds methods to String prototype
interface String {
  strip(): string;
  stripTags(): string;
  stripScripts(): string;
  escapeHTML(): string;
  unescapeHTML(): string;
  truncate(length?: number, truncation?: string): string;
  camelize(): string;
  dasherize(): string;
  underscore(): string;
  blank(): boolean;
  empty(): boolean;
  include(pattern: string): boolean;
  interpret(): string;
  toQueryParams(separator?: string): any;
  parseQuery(separator?: string): any;
  evalJSON(sanitize?: boolean): any;
  isJSON(): boolean;
  succ(): string;
  times(count: number): string;
  toColorPart(): string;
  toArray(): string[];
}

// PrototypeJS adds methods to Array prototype
interface Array<T> {
  each(iterator: (item: T, index: number, array: T[]) => void, context?: any): T[];
  eachSlice(number: number, iterator?: Function): any[];
  all(iterator?: Function, context?: any): boolean;
  any(iterator?: Function, context?: any): boolean;
  collect(iterator: Function, context?: any): any[];
  detect(iterator: Function, context?: any): T | undefined;
  findAll(iterator: Function, context?: any): T[];
  grep(pattern: any, iterator?: Function, context?: any): any[];
  include(value: any): boolean;
  inGroupsOf(number: number, fillWith?: any): any[];
  inject(memo: any, iterator: Function, context?: any): any;
  invoke(methodName: string, ...args: any[]): any[];
  max(iterator?: Function, context?: any): any;
  min(iterator?: Function, context?: any): any;
  partition(iterator?: Function, context?: any): [T[], T[]];
  pluck(propertyName: string): any[];
  reject(iterator: Function, context?: any): T[];
  sortBy(iterator: Function, context?: any): T[];
  without(...values: any[]): T[];
  flatten(): any[];
  zip(...sequences: any[]): any[];
  size(): number;
  compact(): T[];
  uniq(sorted?: boolean): T[];
  intersect(array: T[]): T[];
  clone(): T[];
}

declare var editor: any;
declare var XWiki: any;
declare var jQuery: any;
declare var $j: any;
declare var PhenoTips: any;
declare function $A(iterable: any): any[];
declare function $R(start: any, end: any, exclusive?: boolean): any;

interface Function {
  bindAsEventListener(context: any, ...args: any[]): Function;
  bind(context: any, ...args: any[]): Function;
  curry(...args: any[]): Function;
  delay(timeout: number, ...args: any[]): number;
  defer(...args: any[]): number;
  wrap(wrapper: Function): Function;
  methodize(): Function;
}

interface Window {
  observe(eventName: string, handler: Function): any;
  stopObserving(eventName?: string, handler?: Function): any;
}

// CSS module side-effect import support
declare module '*.css' {
  const css: any;
  export default css;
}
