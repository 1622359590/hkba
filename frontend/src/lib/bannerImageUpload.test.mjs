import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBannerMediaUpload, validateBannerImageFiles } from './bannerImageUpload.mjs';

const file = (name, type) => ({ name, type });

test('accepts exactly one supported image', () => {
  const image = file('hero.webp', 'image/webp');
  assert.deepEqual(validateBannerImageFiles([image]), { ok: true, file: image });
});

test('rejects empty, multiple, and non-image selections', () => {
  assert.deepEqual(validateBannerImageFiles([]), { ok: false, error: '請選擇一張圖片。' });
  assert.deepEqual(
    validateBannerImageFiles([file('a.png', 'image/png'), file('b.png', 'image/png')]),
    { ok: false, error: '每次只能上傳一張圖片。' }
  );
  assert.deepEqual(
    validateBannerImageFiles([file('brochure.pdf', 'application/pdf')]),
    { ok: false, error: '只支援 JPG、PNG、WebP、AVIF 或 SVG 圖片。' }
  );
});

test('extracts the media-library URL and filename', () => {
  assert.deepEqual(
    parseBannerMediaUpload({
      success: true,
      data: { asset: { url: '/uploads/media/banner.webp', originalFilename: 'banner.webp' } },
    }),
    { url: '/uploads/media/banner.webp', originalFilename: 'banner.webp' }
  );
  assert.throws(() => parseBannerMediaUpload({ success: true, data: {} }), /沒有返回圖片資料/);
});
