// Ambient declarations for Raphaël globals used in visuals source files.
// Types are intentionally loose (any) to minimise churn during migration.

declare function Raphael(container: any, width?: number, height?: number): RaphaelPaper;

interface RaphaelPaper {
  path(pathString: string): RaphaelElement;
  circle(x: number, y: number, r: number): RaphaelElement;
  ellipse(x: number, y: number, rx: number, ry: number): RaphaelElement;
  rect(x: number, y: number, w: number, h: number, r?: number): RaphaelElement;
  text(x: number, y: number, text: string): RaphaelElement;
  image(src: string, x: number, y: number, w: number, h: number): RaphaelElement;
  set(): RaphaelSet;
  setSize(width: number, height: number): void;
  setViewBox(x: number, y: number, w: number, h: number, fit?: boolean): void;
  canvas: any;
  width: number;
  height: number;
  forEach(callback: Function, context?: any): any;
  getById(id: number): RaphaelElement | null;
}

interface RaphaelElement {
  attr(name: string, value?: any): any;
  attr(attrs: any): RaphaelElement;
  animate(attrs: any, ms: number, easing?: string, callback?: Function): RaphaelElement;
  getBBox(): { x: number; y: number; width: number; height: number; x2: number; y2: number };
  remove(): void;
  show(): RaphaelElement;
  hide(): RaphaelElement;
  toFront(): RaphaelElement;
  toBack(): RaphaelElement;
  click(handler: Function): RaphaelElement;
  hover(inHandler: Function, outHandler: Function): RaphaelElement;
  mousedown(handler: Function): RaphaelElement;
  mouseup(handler: Function): RaphaelElement;
  mousemove(handler: Function): RaphaelElement;
  transform(tString: string): any;
  translate(dx: number, dy: number): RaphaelElement;
  node: SVGElement;
  type: string;
  paper: RaphaelPaper;
  id: number;
  data(key: string, value?: any): any;
  [key: string]: any;
}

interface RaphaelSet {
  push(...elements: RaphaelElement[]): RaphaelSet;
  attr(name: string, value?: any): any;
  attr(attrs: any): RaphaelSet;
  remove(): void;
  show(): RaphaelSet;
  hide(): RaphaelSet;
  forEach(callback: Function, context?: any): RaphaelSet;
  [key: string]: any;
}

declare namespace Raphael {
  function hsb2rgb(h: number, s: number, b: number): { hex: string; r: number; g: number; b: number };
  function getColor(brightness?: number): string;
  function rgb(r: number, g: number, b: number): string;
  function color(clr: string): any;
}
