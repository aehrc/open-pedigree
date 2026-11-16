import { describe, it, expect } from 'vitest';
import { FillPatternRegistry, PATTERNS } from 'pedigree/view/fillPatterns';

describe('FillPatternRegistry', () => {
  // A registry over a given legend order.
  const over = (order) => new FillPatternRegistry(() => order);

  it('gives each entry the pattern for its place in the legends\' order, the first solid black', () => {
    const registry = over(['disorder:D1', 'gene:BRCA1']);
    expect(PATTERNS[0].name).toBe('solid');
    expect(registry.indexFor('disorder:D1')).toBe(0);
    expect(registry.indexFor('gene:BRCA1')).toBe(1);
    expect(PATTERNS.map((p) => p.name)).toEqual(['solid', 'diagonal /', 'diagonal \\', 'cross-hatch', 'dots',
      'horizontal', 'vertical', 'grid', 'sparse dots', 'dense diagonal']);
  });

  it('repeats past the last pattern', () => {
    const order = Array.from({ length: PATTERNS.length + 1 }, (_, i) => 'disorder:' + i);
    expect(over(order).indexFor('disorder:' + PATTERNS.length)).toBe(0);
  });

  it('follows the order as it changes: an entry gone moves the later ones up', () => {
    const order = ['disorder:A', 'disorder:B'];
    const registry = over(order);
    expect(registry.indexFor('disorder:B')).toBe(1);
    order.shift();
    expect(registry.indexFor('disorder:B')).toBe(0);
  });

  it('gives an entry no legend lists yet the next place', () => {
    expect(over(['disorder:A']).indexFor('gene:new')).toBe(1);
  });

  it('has its own pattern ids, so two editors on a page don\'t share them', () => {
    const a = new FillPatternRegistry(() => ['disorder:D1']);
    const b = new FillPatternRegistry();
    expect(a.patternId(0)).not.toBe(b.patternId(0));
    expect(a.fillFor('disorder:D1')).toBe('url(#' + a.patternId(0) + ')');
  });

  it('adds every pattern to the SVG\'s defs once', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    const registry = new FillPatternRegistry();
    registry.ensureDefinitions(svg);
    registry.ensureDefinitions(svg);
    const patterns = svg.querySelectorAll('defs > pattern');
    // each, and each turned back +45° for diamonds (drawn turned -45°)
    expect(patterns).toHaveLength(PATTERNS.length * 2);
    expect(svg.querySelector('#' + registry.patternId(1) + '-r').getAttribute('patternTransform')).toBe('rotate(45)');
    expect(patterns[0].getAttribute('id')).toBe(registry.patternId(0));
    expect(patterns[1].getAttribute('patternUnits')).toBe('userSpaceOnUse');
    // each over white, so a pattern's gaps read as white
    expect(patterns[1].querySelector('rect').getAttribute('fill')).toBe('#FFFFFF');
  });

  it('names the turned variant for a diamond, and knows the solid one', () => {
    const registry = new FillPatternRegistry(() => ['disorder:A', 'gene:B']);
    expect(registry.fillFor('disorder:A', true)).toBe('url(#' + registry.patternId(0) + '-r)');
    expect(registry.isSolid('disorder:A')).toBe(true);
    expect(registry.isSolid('gene:B')).toBe(false);
  });

  it('draws a legend swatch of a pattern', () => {
    const registry = new FillPatternRegistry();
    const swatch = registry.swatchSVG(3);
    expect(swatch).toContain('<pattern id="' + registry.patternId(3) + '-swatch"');
    expect(swatch).toContain('fill="url(#' + registry.patternId(3) + '-swatch)"');
  });
});
