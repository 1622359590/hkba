function mediaAssetUrl(row) {
  if (!row) return '';
  return row.public_url || `/uploads/${row.storage_key}`;
}

module.exports = { mediaAssetUrl };
