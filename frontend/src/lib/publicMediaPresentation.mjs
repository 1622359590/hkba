export function shouldShowMediaPlaceholder({ hasAsset, editable }) {
  return !hasAsset && editable;
}

export function newsCardClassName(type, hasCover) {
  const variant = String(type || 'news.grid').replace('news.', '');
  return `hk-news-card hk-news-card--${variant} ${hasCover ? 'has-cover' : 'is-text-only'}`;
}
