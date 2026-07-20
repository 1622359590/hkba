// Media asset storage pipeline (spec: data-api §7; decisions D8, D10).
//
// D10 keeps first-phase storage on local disk behind the backend, so uploads
// are a single multipart POST (not the spec's signed two-phase object-storage
// flow). The module validates type by magic bytes (never by client-supplied
// MIME), enforces per-kind size limits, sanitizes SVG, hashes content for
// dedup and extracts image dimensions before writing the file.
//
// Allowed kinds (spec §7): jpeg / png / webp / avif / svg / pdf.
// Images <= 15 MB, PDF <= 30 MB. Direct video upload stays closed until
// operations capacity is confirmed.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { imageSize } = require('./imageSize');

const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const PDF_MAX_BYTES = 30 * 1024 * 1024;

const KINDS = {
  jpeg: { mime: 'image/jpeg', ext: '.jpg', maxBytes: IMAGE_MAX_BYTES, image: true },
  png: { mime: 'image/png', ext: '.png', maxBytes: IMAGE_MAX_BYTES, image: true },
  webp: { mime: 'image/webp', ext: '.webp', maxBytes: IMAGE_MAX_BYTES, image: true },
  avif: { mime: 'image/avif', ext: '.avif', maxBytes: IMAGE_MAX_BYTES, image: true },
  svg: { mime: 'image/svg+xml', ext: '.svg', maxBytes: IMAGE_MAX_BYTES, image: true },
  pdf: { mime: 'application/pdf', ext: '.pdf', maxBytes: PDF_MAX_BYTES, image: false },
};

// Thrown for every client-correctable rejection; the route maps it to the
// UPLOAD_REJECTED envelope.
class MediaRejected extends Error {
  constructor(fields) {
    super('media_rejected');
    this.fields = fields;
  }
}

function sniff(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }
  if (buffer.length >= 5 && buffer.toString('latin1', 0, 5) === '%PDF-') return 'pdf';
  // SVG is text: allow an optional BOM / XML prolog before the root element.
  const head = buffer.toString('utf8', 0, Math.min(buffer.length, 4096)).replace(/^﻿/, '');
  if (/<svg[\s>]/i.test(head) || (/^\s*<\?xml/i.test(head) && /<svg[\s>]/i.test(head))) return 'svg';
  return null;
}

// Removes active content from SVG markup (spec §7: SVG must be sanitized).
// Strips script/foreignObject elements, on* event attributes and
// javascript:/data: script URLs in href-like attributes.
function sanitizeSvg(text) {
  return text
    .replace(/<\s*(script|foreignObject)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|foreignObject)\b[^>]*\/\s*>/gi, '')
    .replace(/\s+on[a-zA-Z]+\s*=\s*"[^"]*"/g, '')
    .replace(/\s+on[a-zA-Z]+\s*=\s*'[^']*'/g, '')
    .replace(/\s+on[a-zA-Z]+\s*=\s*[^\s>]+/g, '')
    .replace(/(href|xlink:href)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, '$1=$2#$2');
}

function uploadsRoot() {
  return process.env.HKBA_UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
}

// Validates and persists an upload buffer. Returns everything the route needs
// to insert the media_assets row. Throws MediaRejected on validation failure.
function storeUpload({ buffer, originalFilename = '' }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new MediaRejected([{ field: 'file', code: 'required', message: '未選擇檔案' }]);
  }
  const kind = sniff(buffer);
  if (!kind) {
    throw new MediaRejected([
      { field: 'file', code: 'type', message: '允許格式：JPEG、PNG、WebP、AVIF、SVG、PDF' },
    ]);
  }
  const spec = KINDS[kind];
  if (buffer.length > spec.maxBytes) {
    const limit = spec.image ? '15MB' : '30MB';
    throw new MediaRejected([
      { field: 'file', code: 'size', message: `${spec.image ? '圖片' : 'PDF'} 單檔不可超過 ${limit}` },
    ]);
  }

  let content = buffer;
  if (kind === 'svg') {
    content = Buffer.from(sanitizeSvg(buffer.toString('utf8')), 'utf8');
  }
  const dimensions = spec.image && kind !== 'svg' ? imageSize(content) : null;

  const id = crypto.randomUUID();
  const storageKey = `media/${id}${spec.ext}`;
  const absolute = path.join(uploadsRoot(), storageKey);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);

  return {
    id,
    storageKey,
    originalFilename: String(originalFilename).slice(0, 255),
    mimeType: spec.mime,
    sizeBytes: content.length,
    width: dimensions ? dimensions.width : null,
    height: dimensions ? dimensions.height : null,
    checksum: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

// Best-effort file removal; missing files are not an error (the row delete is
// the source of truth for permanence).
function removeStored(storageKey) {
  try {
    fs.unlinkSync(path.join(uploadsRoot(), storageKey));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('media file removal failed:', error.message);
  }
}

module.exports = {
  MediaRejected,
  storeUpload,
  removeStored,
  sanitizeSvg,
  uploadsRoot,
  KINDS,
  IMAGE_MAX_BYTES,
  PDF_MAX_BYTES,
};
