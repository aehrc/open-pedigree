/**
 * Black-and-white fill patterns for the Patterns toggle (pedigree-patterns-and-png-export): a
 * person's disorders, genes and custom legend entries told apart without colour, on screen and in
 * exports.
 *
 * One registry for every legend that fills a symbol, since a person's disorder and gene share it
 * and must differ: entries take patterns in order of first use (the legends' own entries first,
 * see View.setFillPatterns), the first solid black as classic pedigree shading, then hatchings,
 * dots and lines. Past PATTERNS.length they repeat.
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
  { name: 'diagonal \\', size: 6, content: `<path d="M0,0 L6,6 M-1,5 L1,7 M5,-1 L7,1" stroke="${BLACK}" stroke-width="1"/>` },
  { name: 'cross-hatch', size: 6, content: `<path d="M0,6 L6,0 M-1,1 L1,-1 M5,7 L7,5 M0,0 L6,6 M-1,5 L1,7 M5,-1 L7,1" stroke="${BLACK}" stroke-width="0.8"/>` },
  { name: 'dots', size: 5, content: `<circle cx="2.5" cy="2.5" r="1.2" fill="${BLACK}"/>` },
  { name: 'horizontal', size: 5, content: `<path d="M0,2.5 H5" stroke="${BLACK}" stroke-width="1"/>` },
  { name: 'vertical', size: 5, content: `<path d="M2.5,0 V5" stroke="${BLACK}" stroke-width="1"/>` },
  { name: 'grid', size: 6, content: `<path d="M0,3 H6 M3,0 V6" stroke="${BLACK}" stroke-width="0.8"/>` },
  { name: 'sparse dots', size: 9, content: `<circle cx="4.5" cy="4.5" r="1" fill="${BLACK}"/>` },
  { name: 'dense diagonal', size: 3, content: `<path d="M0,3 L3,0 M-1,1 L1,-1 M2,4 L4,2" stroke="${BLACK}" stroke-width="0.7"/>` },
];

let registries = 0;

/** Which pattern each entry has, by `<legend prefix>:<entry id>`; one per editor. */
export class FillPatternRegistry {
  _idPrefix: string;
  _indexOf: Map<string, number> = new Map();

  constructor() {
    registries += 1;
    // (unique per editor: tests, and some hosts, build more than one on a page)
    this._idPrefix = 'op-fill-' + registries + '-';
  }

  /** Forgets every assignment (entries then take patterns afresh, in the order they're asked for). */
  reset(): void {
    this._indexOf.clear();
  }

  /** The pattern index for an entry, assigning the next one on first use (repeating past the list's end). */
  indexFor(key: string): number {
    if (!this._indexOf.has(key)) {
      this._indexOf.set(key, this._indexOf.size);
    }
    return this._indexOf.get(key) % PATTERNS.length;
  }

  /** The `<pattern>` element id for a pattern index. */
  patternId(index: number): string {
    return this._idPrefix + index;
  }

  /** The fill an entry's shapes take: `url(#…)` of its pattern. */
  fillFor(key: string): string {
    return 'url(#' + this.patternId(this.indexFor(key)) + ')';
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

function patternMarkup(id: string, pattern: FillPattern): string {
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${pattern.size}" height="${pattern.size}">`
    + `<rect width="${pattern.size}" height="${pattern.size}" fill="${WHITE}"/>${pattern.content}</pattern>`;
}

function patternElement(id: string, pattern: FillPattern): Element {
  const parsed = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${patternMarkup(id, pattern)}</svg>`, 'image/svg+xml');
  return document.importNode(parsed.documentElement.firstElementChild, true);
}
