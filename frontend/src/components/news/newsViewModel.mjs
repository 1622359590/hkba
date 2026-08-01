function localized(primary, fallback) {
  return primary || fallback || '';
}

function dateValue(value, locale) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function normalizePublicNews(items, lang, resolveImage) {
  const isEnglish = lang === 'en';
  return items.map((item) => {
    const title = localized(isEnglish ? item.titleEn : item.titleZh, isEnglish ? item.titleZh : item.titleEn);
    const firstCategory = item.categories[0];
    const category = firstCategory
      ? localized(isEnglish ? firstCategory.nameEn : firstCategory.nameZh, isEnglish ? firstCategory.nameZh : firstCategory.nameEn)
      : '';
    const coverAlt = item.cover
      ? localized(isEnglish ? item.cover.altEn : item.cover.altZh, localized(isEnglish ? item.cover.altZh : item.cover.altEn, title))
      : '';
    return {
      id: String(item.id),
      href: `/news/${item.slug}`,
      title,
      summary: localized(isEnglish ? item.summaryEn : item.summaryZh, isEnglish ? item.summaryZh : item.summaryEn),
      category,
      date: dateValue(item.publishedAt, isEnglish ? 'en-US' : 'zh-HK'),
      year: item.year || undefined,
      image: item.cover ? { src: resolveImage(item.cover.url), alt: coverAlt || title } : undefined,
    };
  });
}

export function normalizeLegacyNews(items, lang, resolveImage) {
  const isEnglish = lang === 'en';
  return items.map((item) => {
    const title = localized(isEnglish ? item.title_en : item.title_zh, isEnglish ? item.title_zh : item.title_en);
    const parsedYear = item.published_at ? new Date(item.published_at).getFullYear() : NaN;
    return {
      id: String(item.id),
      href: `/news/${item.id}`,
      title,
      summary: localized(isEnglish ? item.summary_en : item.summary_zh, isEnglish ? item.summary_zh : item.summary_en),
      category: item.category || '',
      date: dateValue(item.published_at, isEnglish ? 'en-US' : 'zh-HK'),
      year: Number.isInteger(parsedYear) ? parsedYear : undefined,
      image: item.cover_image ? { src: resolveImage(item.cover_image), alt: title } : undefined,
    };
  });
}

export function selectNewsLayout(items, pinnedItems = [], secondaryCount = 2) {
  const focusCandidates = [];
  const seen = new Set();
  for (const item of [...pinnedItems, ...items]) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    focusCandidates.push(item);
  }
  const featured = focusCandidates[0] || null;
  const secondary = focusCandidates.slice(1, 1 + Math.max(0, secondaryCount));
  const focusIds = new Set([featured, ...secondary].filter(Boolean).map((item) => item.id));
  return { featured, secondary, feed: items.filter((item) => !focusIds.has(item.id)) };
}
