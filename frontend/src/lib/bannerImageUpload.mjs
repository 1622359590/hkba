const SUPPORTED_BANNER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);

export function validateBannerImageFiles(files) {
  const list = Array.from(files || []);
  if (list.length === 0) return { ok: false, error: '請選擇一張圖片。' };
  if (list.length !== 1) return { ok: false, error: '每次只能上傳一張圖片。' };
  if (!SUPPORTED_BANNER_IMAGE_TYPES.has(list[0].type)) {
    return { ok: false, error: '只支援 JPG、PNG、WebP、AVIF 或 SVG 圖片。' };
  }
  return { ok: true, file: list[0] };
}

export function parseBannerMediaUpload(payload) {
  const asset = payload?.data?.asset;
  if (!asset?.url) throw new Error('伺服器沒有返回圖片資料。');
  return {
    url: asset.url,
    originalFilename: asset.originalFilename || '',
  };
}
