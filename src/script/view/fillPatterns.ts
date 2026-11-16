/**
 * Black-and-white fill patterns for the Patterns toggle (pedigree-patterns-and-png-export): a
 * person's disorders, genes and custom legend entries told apart without colour, on screen and in
 * exports.
 *
 * One registry for every legend that fills a symbol, since a person's disorder and gene share it
 * and must differ: entries take patterns in the order the legends list them (disorders, genes, then
 * custom legends), the first solid black as classic pedigree shading, then hatchings, dots and lines.
 * Past PATTERNS.length they repeat.
 *
 * Patterns are SVG <pattern> elements in the canvas's <defs> (Raphael has no pattern fills), so
 * SVG export keeps them and the PDF export (svg-to-pdfkit) draws them.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

export type FillPattern = {
  name: string;
  size: number;
  // the tile's content over a white background: SVG markup in tile coordinates
  content: string;
};

// The order entries get them in: solid black first (decided with David).
export const PATTERNS: FillPattern[] = [
  { name: 'solid', size: 6, content: `<rect width="6" height="6" fill="${BLACK}"/>` },
  { name: 'diagonal /', size: 6, content: `<path d="M0,6 L6,0 M-1,1 L1,-1 M5,7 L7,5" stroke="${BLACK}" stroke-width="1"/>` },
  // Bold and wider apart, so it isn't read as 'diagonal /' turned round once a symbol is small.
  { name: 'bold diagonal \\', size: 10, content: `<path d="M0,0 L10,10 M-2,8 L2,12 M8,-2 L12,2" stroke="${BLACK}" stroke-width="3.5"/>` },
  { name: 'cross-hatch', size: 6, content: `<path d="M0,6 L6,0 M-1,1 L1,-1 M5,7 L7,5 M0,0 L6,6 M-1,5 L1,7 M5,-1 L7,1" stroke="${BLACK}" stroke-width="0.8"/>` },
  { name: 'dots', size: 5, content: `<circle cx="2.5" cy="2.5" r="1.2" fill="${BLACK}"/>` },
  { name: 'horizontal', size: 5, content: `<path d="M0,2.5 H5" stroke="${BLACK}" stroke-width="1"/>` },
  { name: 'vertical', size: 5, content: `<path d="M2.5,0 V5" stroke="${BLACK}" stroke-width="1"/>` },
  { name: 'grid', size: 6, content: `<path d="M0,3 H6 M3,0 V6" stroke="${BLACK}" stroke-width="0.8"/>` },
  { name: 'sparse dots', size: 9, content: `<circle cx="4.5" cy="4.5" r="1" fill="${BLACK}"/>` },
  // Bold, as 'horizontal' is thin: a dense diagonal here read as 'diagonal /' when small.
  { name: 'bold horizontal', size: 10, content: `<path d="M0,5 H10" stroke="${BLACK}" stroke-width="3.5"/>` },
];

let registries = 0;

/**
 * Which pattern each entry has, by `<legend prefix>:<entry id>`; one per editor. An entry's pattern
 * is its place in the order the legends list their entries (`order`, given by the view): nothing is
 * kept, so loads, undo and redo always show what the legends show - the first entry listed solid.
 */
export class FillPatternRegistry {
  _idPrefix: string;
  _order: () => string[];
  // key -> place in the order, rebuilt after the legends change (invalidate)
  _places: Map<string, number> = null;

  constructor(order: () => string[] = () => []) {
    registries += 1;
    // (unique per editor: tests, and some hosts, build more than one on a page)
    this._idPrefix = 'op-fill-' + registries + '-';
    this._order = order;
  }

  /**
   * The pattern index for an entry: its place in the legends' order (repeating past the list's end).
   * An entry no legend lists yet takes the next place.
   */
  indexFor(key: string): number {
    const places = this._placeMap();
    const place = places.has(key) ? places.get(key) : places.size;
    return place % PATTERNS.length;
  }

  /** Forgets the order, so the next lookup reads it again (after a legend entry is added or removed). */
  invalidate(): void {
    this._places = null;
  }

  _placeMap(): Map<string, number> {
    if (!this._places) {
      this._places = new Map();
      this._order().forEach((key) => {
        if (!this._places.has(key)) {
          this._places.set(key, this._places.size);
        }
      });
    }
    return this._places;
  }

  /** The `<pattern>` element id for a pattern index. */
  patternId(index: number): string {
    return this._idPrefix + index;
  }

  /**
   * The fill an entry's shapes take: `url(#…)` of its pattern. `rotated`: for a shape drawn turned
   * -45° (an unknown-sex diamond), the pattern turned back, so it reads as its legend swatch.
   */
  fillFor(key: string, rotated = false): string {
    return 'url(#' + this.patternId(this.indexFor(key)) + (rotated ? ROTATED_SUFFIX : '') + ')';
  }

  /** Whether an entry's pattern is the solid one (marks drawn over it need to stand out); never for an entry no legend lists. */
  isSolid(key: string): boolean {
    return this._placeMap().has(key) && this.indexFor(key) === 0;
  }

  /** Adds every pattern to the SVG's <defs> (making one if needed), once. */
  ensureDefinitions(svg: SVGSVGElement): void {
    if (!svg || svg.querySelector('#' + this.patternId(0))) {
      return;
    }
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    PATTERNS.forEach((pattern, index) => {
      defs.appendChild(patternElement(this.patternId(index), pattern));
      defs.appendChild(patternElement(this.patternId(index) + ROTATED_SUFFIX, pattern, 45));
    });
  }

  /** A small swatch of a pattern, as standalone SVG markup (for the legend). */
  swatchSVG(index: number, size = 12): string {
    const pattern = PATTERNS[index % PATTERNS.length];
    const id = this.patternId(index) + '-swatch';
    return `<svg xmlns="${SVG_NS}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
      + `<defs>${patternMarkup(id, pattern)}</defs>`
      + `<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" fill="url(#${id})" stroke="${BLACK}" stroke-width="1"/></svg>`;
  }
}

// The variant of a pattern for shapes drawn turned -45° (unknown-sex diamonds): turned back +45°.
const ROTATED_SUFFIX = '-r';

function patternMarkup(id: string, pattern: FillPattern, rotate = 0): string {
  const transform = rotate ? ` patternTransform="rotate(${rotate})"` : '';
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${pattern.size}" height="${pattern.size}"${transform}>`
    + `<rect width="${pattern.size}" height="${pattern.size}" fill="${WHITE}"/>${pattern.content}</pattern>`;
}

function patternElement(id: string, pattern: FillPattern, rotate = 0): Element {
  const parsed = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${patternMarkup(id, pattern, rotate)}</svg>`, 'image/svg+xml');
  return document.importNode(parsed.documentElement.firstElementChild, true);
}
