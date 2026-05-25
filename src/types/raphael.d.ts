// Ambient declarations for Raphael SVG library
declare var Raphael: {
  new (container: any, width: number, height: number): any;
  (container: any, width: number, height: number): any;
  (x: number, y: number, width: number, height: number): any;
  fn: any;
  el: any;
  is: (o: any, type: string) => boolean;
  getRGB: (colour: string) => any;
  hsb: (h: number, s: number, b: number) => string;
  hsb2rgb: (h: number, s: number, b: number) => any;
  rgb: (r: number, g: number, b: number) => string;
  getColor: (value?: number) => string;
  findDotsAtSegment: (...args: any[]) => any;
};
