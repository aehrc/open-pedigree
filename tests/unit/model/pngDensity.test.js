import { describe, it, expect } from 'vitest';
import { pngSize, fitsCanvas, physChunk, pixelsPerMetre, withDensity, MAX_CANVAS_SIDE } from 'pedigree/model/pngDensity';

describe('PNG size at a resolution', () => {
  it('scales the drawing\'s CSS pixels (96 an inch) by dpi / 96, rounding up', () => {
    expect(pngSize(400, 200, 300)).toEqual({ width: 1250, height: 625 });
    expect(pngSize(400, 200, 150)).toEqual({ width: 625, height: 313 });
    expect(pngSize(96, 96, 600)).toEqual({ width: 600, height: 600 });
  });

  it('refuses a canvas larger than browsers draw', () => {
    expect(fitsCanvas({ width: MAX_CANVAS_SIDE, height: 1000 })).toBe(true);
    expect(fitsCanvas({ width: MAX_CANVAS_SIDE + 1, height: 10 })).toBe(false);
    expect(fitsCanvas({ width: 16000, height: 16000 })).toBe(true);
    expect(fitsCanvas({ width: 16384, height: 16385 })).toBe(false);
    expect(fitsCanvas({ width: 0, height: 10 })).toBe(false);
  });
});

describe('the resolution in the PNG (pHYs)', () => {
  it('records pixels per metre', () => {
    expect(pixelsPerMetre(300)).toBe(11811);
    expect(pixelsPerMetre(96)).toBe(3780);
  });

  it('is a well-formed chunk: length 9, type, x, y, unit metre, CRC', () => {
    const chunk = physChunk(300);
    const view = new DataView(chunk.buffer);
    expect(chunk).toHaveLength(21);
    expect(view.getUint32(0)).toBe(9);
    expect(String.fromCharCode(...chunk.subarray(4, 8))).toBe('pHYs');
    expect(view.getUint32(8)).toBe(11811);
    expect(view.getUint32(12)).toBe(11811);
    expect(chunk[16]).toBe(1);
    // CRC-32 over type + data, as zlib computes it for this chunk
    expect(view.getUint32(17).toString(16)).toBe('78a53f76');
  });

  // A chunk: length, type, data, (a dummy) CRC.
  const chunk = (type, data) => {
    const out = new Uint8Array(12 + data.length);
    new DataView(out.buffer).setUint32(0, data.length);
    out.set([...type].map((c) => c.charCodeAt(0)), 4);
    out.set(data, 8);
    return out;
  };
  const join = (...parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    parts.forEach((p) => { out.set(p, at); at += p.length; });
    return out;
  };
  const header = new Uint8Array(33).map((_, i) => i);
  const types = (png) => {
    const found = [];
    const view = new DataView(png.buffer);
    for (let at = 33; at + 12 <= png.length; at += 12 + view.getUint32(at)) {
      found.push(String.fromCharCode(...png.subarray(at + 4, at + 8)));
    }
    return found;
  };

  it('goes right after the header, the other chunks unchanged', () => {
    const idat = chunk('IDAT', [1, 2, 3]);
    const iend = chunk('IEND', []);
    const out = withDensity(join(header, idat, iend), 300);
    expect(Array.from(out.subarray(0, 33))).toEqual(Array.from(header));
    expect(types(out)).toEqual(['pHYs', 'IDAT', 'IEND']);
    expect(Array.from(out.subarray(54, 54 + idat.length))).toEqual(Array.from(idat));
  });

  it('replaces a pHYs the encoder wrote (a PNG may have only one)', () => {
    const theirs = chunk('pHYs', [0, 0, 11, 19, 0, 0, 11, 19, 1]); // 72 DPI
    const out = withDensity(join(header, theirs, chunk('IDAT', [9]), chunk('IEND', [])), 300);
    expect(types(out)).toEqual(['pHYs', 'IDAT', 'IEND']);
    expect(new DataView(out.buffer).getUint32(41)).toBe(11811);
  });
});
