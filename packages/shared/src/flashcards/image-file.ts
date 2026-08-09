export type RasterImageMetadata = {
  mimetype: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
};

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function inspectRasterImage(bytes: Uint8Array): RasterImageMetadata | null {
  if (bytes.length >= 24
    && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG'
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    const width = u32be(bytes, 16);
    const height = u32be(bytes, 20);
    return width > 0 && height > 0 ? { mimetype: 'image/png', width, height } : null;
  }

  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) return null;
      const length = u16be(bytes, offset);
      if (length < 2 || offset + length > bytes.length) return null;
      const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3)
        || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb)
        || (marker >= 0xcd && marker <= 0xcf);
      if (isStartOfFrame && length >= 7) {
        const height = u16be(bytes, offset + 3);
        const width = u16be(bytes, offset + 5);
        return width > 0 && height > 0 ? { mimetype: 'image/jpeg', width, height } : null;
      }
      offset += length;
    }
  }

  if (bytes.length >= 30 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === 'VP8X') {
      return { mimetype: 'image/webp', width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
    }
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
      const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
      return width > 0 && height > 0 ? { mimetype: 'image/webp', width, height } : null;
    }
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
      return {
        mimetype: 'image/webp',
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
  }

  return null;
}
