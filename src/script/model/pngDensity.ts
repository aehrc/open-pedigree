/**
 * PNG export helpers (pedigree-patterns-and-png-export): the image's size at a resolution, the
 * browser's canvas limits, and recording the resolution in the file (a pHYs chunk), so print
 * software sizes it right.
 */

// CSS pixels per inch: the drawing's SVG size is in CSS pixels.
export const CSS_PX_PER_INCH = 96;

// The largest canvas browsers draw (Chromium and Firefox: 32,767 px a side, about 268 MP; Safari is
// lower, 16,384 a side): beyond it a canvas comes out blank, so the export refuses it first.
export const MAX_CANVAS_SIDE = 16384;
export const MAX_CANVAS_AREA = 268435456;

/** The PNG's pixel size for a drawing `width` × `height` CSS pixels at `dpi`. */
export function pngSize(width: number, height: number, dpi: number): { width: number, height: number } {
  return { width: Math.ceil(width * dpi / CSS_PX_PER_INCH), height: Math.ceil(height * dpi / CSS_PX_PER_INCH) };
}

/** Whether a canvas that size can be drawn. */
export function fitsCanvas(size: { width: number, height: number }): boolean {
  return size.width > 0 && size.height > 0 && size.width <= MAX_CANVAS_SIDE && size.height <= MAX_CANVAS_SIDE
    && size.width * size.height <= MAX_CANVAS_AREA;
}

let crcTable: Uint32Array = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Pixels per metre at `dpi` (pHYs records metres). */
export function pixelsPerMetre(dpi: number): number {
  return Math.round(dpi / 0.0254);
}

/** The pHYs chunk for `dpi`: length, type, data (x and y pixels per metre, unit 1 = metre), CRC. */
export function physChunk(dpi: number): Uint8Array {
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // 'pHYs'
  view.setUint32(8, pixelsPerMetre(dpi));
  view.setUint32(12, pixelsPerMetre(dpi));
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

// The PNG signature and the IHDR chunk (always first, always 25 bytes) come before anything else.
const AFTER_IHDR = 8 + 25;

/** The PNG with a pHYs chunk recording `dpi`, right after its header (replacing none: canvases write none). */
export function withDensity(png: Uint8Array, dpi: number): Uint8Array {
  const chunk = physChunk(dpi);
  const result = new Uint8Array(png.length + chunk.length);
  result.set(png.subarray(0, AFTER_IHDR), 0);
  result.set(chunk, AFTER_IHDR);
  result.set(png.subarray(AFTER_IHDR), AFTER_IHDR + chunk.length);
  return result;
}
