const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.HKBA_UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-media-store-'));

const { imageSize } = require('./imageSize');
const { prepareUpload, sanitizeSvg, storeUpload, MediaRejected, uploadsRoot } = require('./mediaStore');

test.after(() => {
  fs.rmSync(process.env.HKBA_UPLOADS_DIR, { recursive: true, force: true });
});

function pngBuffer(width, height) {
  const buffer = Buffer.alloc(33);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpegBuffer(width, height) {
  // SOI + SOF0 segment with dimensions; no real scan data needed for parsing.
  const buffer = Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
  return buffer;
}

function webpBuffer(width, height) {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8 ', 12, 'ascii');
  buffer.writeUInt16LE(width & 0x3fff, 26);
  buffer.writeUInt16LE(height & 0x3fff, 28);
  return buffer;
}

test('imageSize parses PNG headers', () => {
  assert.deepEqual(imageSize(pngBuffer(640, 480)), { width: 640, height: 480 });
});

test('imageSize parses JPEG SOF markers', () => {
  assert.deepEqual(imageSize(jpegBuffer(1920, 1080)), { width: 1920, height: 1080 });
});

test('imageSize parses lossy WebP and returns null for garbage', () => {
  assert.deepEqual(imageSize(webpBuffer(300, 200)), { width: 300, height: 200 });
  assert.equal(imageSize(Buffer.from('not an image at all')), null);
  assert.equal(imageSize(Buffer.alloc(0)), null);
});

test('sanitizeSvg strips scripts, handlers and javascript URLs', () => {
  const dirty = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
    <script>alert(2)</script>
    <a href="javascript:alert(3)"><rect width="10" height="10" onclick='alert(4)'/></a>
  </svg>`;
  const clean = sanitizeSvg(dirty);
  assert.ok(!/script/i.test(clean));
  assert.ok(!/onload|onclick/i.test(clean));
  assert.ok(!/javascript:/i.test(clean));
  assert.ok(/<rect/.test(clean));
});

test('storeUpload validates, sanitizes, hashes and persists', () => {
  const stored = storeUpload({ buffer: pngBuffer(32, 16), originalFilename: 'logo.png' });
  assert.equal(stored.mimeType, 'image/png');
  assert.deepEqual({ width: stored.width, height: stored.height }, { width: 32, height: 16 });
  assert.match(stored.checksum, /^[a-f0-9]{64}$/);
  const absolute = path.join(uploadsRoot(), stored.storageKey);
  assert.ok(fs.existsSync(absolute));

  const svg = storeUpload({
    buffer: Buffer.from('<svg onload="x()"><script>y()</script><rect width="1"/></svg>'),
    originalFilename: 'icon.svg',
  });
  assert.equal(svg.mimeType, 'image/svg+xml');
  const saved = fs.readFileSync(path.join(uploadsRoot(), svg.storageKey), 'utf8');
  assert.ok(!/script|onload/i.test(saved));
});

test('prepareUpload validates media without writing to local disk', () => {
  const prepared = prepareUpload({ buffer: pngBuffer(20, 10), originalFilename: 'oss.png' });
  assert.equal(prepared.mimeType, 'image/png');
  assert.ok(Buffer.isBuffer(prepared.content));
  assert.equal(fs.existsSync(path.join(uploadsRoot(), prepared.storageKey)), false);
});

test('storeUpload rejects unknown types, empty files and oversize images', () => {
  assert.throws(() => storeUpload({ buffer: null }), MediaRejected);
  assert.throws(() => storeUpload({ buffer: Buffer.from('plain text') }), (error) => {
    assert.ok(error instanceof MediaRejected);
    assert.equal(error.fields[0].code, 'type');
    return true;
  });
  const big = Buffer.alloc(15 * 1024 * 1024 + 1);
  pngBuffer(1, 1).copy(big, 0);
  assert.throws(() => storeUpload({ buffer: big }), (error) => {
    assert.equal(error.fields[0].code, 'size');
    return true;
  });
  // The same bytes are fine when the sniffed kind allows a larger limit.
  const pdf = Buffer.alloc(16 * 1024 * 1024);
  Buffer.from('%PDF-1.7').copy(pdf, 0);
  const stored = storeUpload({ buffer: pdf, originalFilename: 'doc.pdf' });
  assert.equal(stored.mimeType, 'application/pdf');
});
