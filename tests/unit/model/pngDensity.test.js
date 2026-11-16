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

  it('goes right after the header, the rest unchanged', () => {
    const png = new Uint8Array(33 + 4).map((_, i) => i);
    const out = withDensity(png, 300);
    expect(out).toHaveLength(37 + 21);
    expect(Array.from(out.subarray(0, 33))).toEqual(Array.from(png.subarray(0, 33)));
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs');
    expect(Array.from(out.subarray(54))).toEqual([33, 34, 35, 36]);
  });
});
