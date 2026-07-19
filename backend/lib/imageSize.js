// Minimal image dimension parser for the media pipeline (spec: data-api §2.6).
//
// Hand-rolled to keep the zero-new-dependency constraint: reads only headers
// (no decode) for PNG / JPEG / GIF / WebP / AVIF. Returns
// { width, height } or null when the format is unknown or the header is
// malformed — dimension extraction is best-effort metadata, never a reason to
// reject an upload.

function pngSize(buffer) {
  // 8-byte signature, then IHDR length(4) type(4) width(4) height(4).
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function gifSize(buffer) {
  if (buffer.length < 10 || buffer.toString('ascii', 0, 3) !== 'GIF') return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    // SOF markers carry dimensions (exclude DHT/DAC/RSTn/TEM).
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && marker !== 0x01;
    if (isSof) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webpSize(buffer) {
  if (buffer.length < 30) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    // Extended format: 24-bit width/height minus one at offsets 24/27.
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunk === 'VP8L') {
    // Lossless: 14-bit dimensions packed after the signature byte.
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') {
    // Lossy: frame tag(3) + start code(3) then 16-bit LE dims masked to 14 bits.
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

function avifSize(buffer) {
  // ISO-BMFF: locate the `meta` box, then the first `ispe` (image spatial
  // extents) property which stores width/height as big-endian uint32.
  if (buffer.length < 32 || buffer.toString('ascii', 4, 8) !== 'ftyp') return null;
  const brand = buffer.toString('ascii', 8, 12);
  if (brand !== 'avif' && brand !== 'avis') return null;
  const needle = Buffer.from('ispe');
  const at = buffer.indexOf(needle);
  if (at === -1 || at + 12 > buffer.length) return null;
  return { width: buffer.readUInt32BE(at + 4), height: buffer.readUInt32BE(at + 8) };
}

// Returns { width, height } or null. Never throws.
function imageSize(buffer) {
  try {
    return (
      pngSize(buffer) ||
      gifSize(buffer) ||
      jpegSize(buffer) ||
      webpSize(buffer) ||
      avifSize(buffer) ||
      null
    );
  } catch {
    return null;
  }
}

module.exports = { imageSize };
