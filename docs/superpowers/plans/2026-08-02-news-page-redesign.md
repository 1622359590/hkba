# HKBA Premium News Page Implementation Plan

> Superseded by `2026-08-02-news-page-cms-synced-redesign.md`, which adds the confirmed CMS registry, Studio preview, pinned query, and safe default-page upgrade scope.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sparse news page with the approved A “flagship editorial” layout while preserving bilingual content, public-to-legacy API fallback, filters, pagination, and resilient empty/error states.

**Architecture:** Normalize both public and legacy API records into one view model before rendering. Keep fetching and query state in `NewsListClient`, move visual sections into focused news components, and keep the page-specific presentation in one CSS file. The hero uses semantic static SVG/CSS artwork and only displays statistics derivable from current data.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript/JavaScript modules, Tailwind CSS 4 global imports, CSS, Node.js built-in test runner.

## Global Constraints

- Keep the existing framework and dependency set; add no third-party package.
- Preserve new public API preference and legacy API fallback.
- Preserve year/category filters, pagination, bilingual rendering, loading, retry, and empty states.
- Use cyan as the only foreground accent; blue is permitted only for background depth.
- Never fabricate partner, region, or on-chain statistics.
- Use real cover images when available and deterministic CSS/SVG artwork when absent or broken.
- Respect `prefers-reduced-motion` and retain keyboard-visible focus states.
- Do not change the news detail page, admin news editing, API contracts, or database schema.

---

## File Structure

- Create `frontend/src/components/news/newsViewModel.mjs`: pure normalization, date formatting, and featured/feed splitting.
- Create `frontend/src/components/news/newsViewModel.test.mjs`: Node tests for new/legacy normalization and list splitting.
- Create `frontend/src/components/news/newsTypes.ts`: shared `NewsViewItem` contract for rendering components.
- Create `frontend/src/components/news/NewsHero.tsx`: approved technology hero and real-data status rail.
- Create `frontend/src/components/news/NewsArtwork.tsx`: decorative network artwork and image fallback surface.
- Create `frontend/src/components/news/NewsFilters.tsx`: accessible year/category controls for both data modes.
- Create `frontend/src/components/news/FeaturedNews.tsx`: one-primary/two-secondary feature layout.
- Create `frontend/src/components/news/NewsFeed.tsx`: editorial list for remaining articles.
- Create `frontend/src/components/news/NewsLoadingSkeleton.tsx`: first-load skeleton matching the featured/feed geometry.
- Create `frontend/src/components/news/NewsPagination.tsx`: accessible pagination.
- Create `frontend/src/styles/news.css`: all page-specific responsive, interaction, loading, and reduced-motion styles.
- Modify `frontend/src/components/pages/NewsListClient.tsx`: retain data orchestration and compose normalized visual sections.
- Modify `frontend/src/app/globals.css`: import `news.css` once.

---

### Task 1: Unified news view model

**Files:**
- Create: `frontend/src/components/news/newsViewModel.mjs`
- Create: `frontend/src/components/news/newsViewModel.test.mjs`
- Create: `frontend/src/components/news/newsTypes.ts`

**Interfaces:**
- Consumes: `PublicNewsListItem`, legacy `NewsItem`, language value `'zh' | 'en'`, and `imgUrl`-resolved image strings.
- Produces: `NewsViewItem`, `normalizePublicNews(items, lang, resolveImage)`, `normalizeLegacyNews(items, lang, resolveImage)`, and `splitNews(items)` returning `{ featured, secondary, feed }`.

- [ ] **Step 1: Write failing normalization and splitting tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyNews, normalizePublicNews, splitNews } from './newsViewModel.mjs';

test('normalizes public news with localized fallbacks and cover alt text', () => {
  const [item] = normalizePublicNews([{
    id: 'n1', slug: 'policy-update', titleZh: '政策更新', titleEn: '',
    summaryZh: '摘要', summaryEn: '', year: 2026, publishedAt: '2026-08-02T08:00:00Z',
    cover: { url: '/media/a.jpg', altZh: '', altEn: '' },
    categories: [{ id: 'c1', slug: 'policy', nameZh: '政策', nameEn: 'Policy' }], tags: []
  }], 'en', (url) => `/api${url}`);
  assert.equal(item.href, '/news/policy-update');
  assert.equal(item.title, '政策更新');
  assert.equal(item.category, 'Policy');
  assert.deepEqual(item.image, { src: '/api/media/a.jpg', alt: '政策更新' });
});

test('normalizes legacy news and uses the title as image alt text', () => {
  const [item] = normalizeLegacyNews([{
    id: 7, title_zh: '協會消息', title_en: 'Association update',
    summary_zh: '摘要', summary_en: 'Summary', cover_image: '/legacy.jpg',
    category: 'HKBA', published_at: '2023-08-28T00:00:00Z'
  }], 'zh', (url) => `/api${url}`);
  assert.equal(item.href, '/news/7');
  assert.deepEqual(item.image, { src: '/api/legacy.jpg', alt: '協會消息' });
});

test('splits the first three records without duplicating the feed', () => {
  const items = Array.from({ length: 6 }, (_, index) => ({ id: String(index) }));
  const result = splitNews(items);
  assert.equal(result.featured.id, '0');
  assert.deepEqual(result.secondary.map((item) => item.id), ['1', '2']);
  assert.deepEqual(result.feed.map((item) => item.id), ['3', '4', '5']);
});
```

- [ ] **Step 2: Run the tests and confirm they fail because the module does not exist**

Run: `node --test src/components/news/newsViewModel.test.mjs` from `frontend/`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure view-model functions**

Create the shared rendering contract in `newsTypes.ts`:

```ts
export type NewsViewItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  year?: number;
  image?: { src: string; alt: string };
};
```

Then implement the pure functions in `newsViewModel.mjs`:

```js
function localized(primary, fallback) { return primary || fallback || ''; }
function dateValue(value, locale) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function normalizePublicNews(items, lang, resolveImage) {
  const isEnglish = lang === 'en';
  return items.map((item) => {
    const title = localized(isEnglish ? item.titleEn : item.titleZh, isEnglish ? item.titleZh : item.titleEn);
    const category = item.categories[0]
      ? localized(isEnglish ? item.categories[0].nameEn : item.categories[0].nameZh,
          isEnglish ? item.categories[0].nameZh : item.categories[0].nameEn)
      : '';
    const alt = item.cover
      ? localized(isEnglish ? item.cover.altEn : item.cover.altZh,
          localized(isEnglish ? item.cover.altZh : item.cover.altEn, title))
      : '';
    return {
      id: item.id, href: `/news/${item.slug}`, title,
      summary: localized(isEnglish ? item.summaryEn : item.summaryZh, isEnglish ? item.summaryZh : item.summaryEn),
      category, date: dateValue(item.publishedAt, isEnglish ? 'en-US' : 'zh-HK'), year: item.year || undefined,
      image: item.cover ? { src: resolveImage(item.cover.url), alt: alt || title } : undefined
    };
  });
}

export function normalizeLegacyNews(items, lang, resolveImage) {
  const isEnglish = lang === 'en';
  return items.map((item) => {
    const title = localized(isEnglish ? item.title_en : item.title_zh, isEnglish ? item.title_zh : item.title_en);
    return {
      id: String(item.id), href: `/news/${item.id}`, title,
      summary: localized(isEnglish ? item.summary_en : item.summary_zh, isEnglish ? item.summary_zh : item.summary_en),
      category: item.category || '', date: dateValue(item.published_at, isEnglish ? 'en-US' : 'zh-HK'),
      year: item.published_at ? new Date(item.published_at).getFullYear() : undefined,
      image: item.cover_image ? { src: resolveImage(item.cover_image), alt: title } : undefined
    };
  });
}

export function splitNews(items) {
  return { featured: items[0] || null, secondary: items.slice(1, 3), feed: items.slice(3) };
}
```

- [ ] **Step 4: Run the view-model tests**

Run: `node --test src/components/news/newsViewModel.test.mjs` from `frontend/`  
Expected: 3 tests PASS.

- [ ] **Step 5: Commit the view-model task**

```bash
git add frontend/src/components/news/newsTypes.ts frontend/src/components/news/newsViewModel.mjs frontend/src/components/news/newsViewModel.test.mjs
git commit -m "refactor: normalize news list data"
```

---

### Task 2: Technology hero and resilient news artwork

**Files:**
- Create: `frontend/src/components/news/NewsHero.tsx`
- Create: `frontend/src/components/news/NewsArtwork.tsx`
- Create: `frontend/src/styles/news.css`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- `NewsHero` props: `{ lang: 'zh' | 'en'; total: number; categoryCount: number; activeYear?: number; latestDate?: string }`.
- `NewsArtwork` props: `{ image?: { src: string; alt: string }; className?: string }`; it switches to deterministic SVG/CSS artwork on missing image or `onError`.

- [ ] **Step 1: Add `NewsArtwork` with runtime image fallback**

Create a client component with local `failed` state. Render `<img>` only when `image && !failed`; call `setFailed(true)` in `onError`. Otherwise render an `aria-hidden="true"` SVG containing seven named circles and connecting paths. Keep the SVG decorative and deterministic.

- [ ] **Step 2: Add the approved `NewsHero` semantic structure**

Use a `<section className="news-hero">` containing:

```tsx
<p className="news-hero__eyebrow">HKBA INTELLIGENCE NETWORK</p>
<h1>{lang === 'zh' ? <>洞察產業脈動，<br />連接<span>區塊鏈未來</span></> : <>Signals shaping<br /><span>the blockchain future</span></>}</h1>
<p className="news-hero__summary">{lang === 'zh' ? '追蹤香港及全球區塊鏈生態的政策、技術與產業進展。' : 'Tracking policy, technology and industry progress across Hong Kong and the global blockchain ecosystem.'}</p>
<div className="news-hero__coordinates">22.3193° N · 114.1694° E · NETWORK ONLINE</div>
<svg className="news-hero__network" viewBox="0 0 390 205" aria-hidden="true">
  <path d="M42 154 117 75 210 100 300 45 356 126 277 171 210 100 137 168 117 75" />
  <circle cx="117" cy="75" r="4" /><circle cx="210" cy="100" r="5" />
</svg>
<aside className="news-hero__pulse" aria-label={lang === 'zh' ? '生態內容脈衝' : 'Ecosystem content pulse'}>
  <span aria-hidden="true" /><b>ECOSYSTEM PULSE</b><strong>{total}</strong>
</aside>
<dl className="news-hero__rail">
  <div><dt>PUBLICATIONS</dt><dd>{total}</dd></div>
  <div><dt>CATEGORIES</dt><dd>{categoryCount}</dd></div>
  <div><dt>ACTIVE YEAR</dt><dd>{activeYear || new Date().getFullYear()}</dd></div>
  <div><dt>LAST UPDATE</dt><dd>{latestDate || '—'}</dd></div>
</dl>
```

The rail values are limited to `total`, `categoryCount`, `activeYear || current year`, and `latestDate || '—'`.

- [ ] **Step 3: Implement page-specific styles**

In `news.css`, define the approved off-black/cyan hero, low-contrast 34px grid, node paths, asymmetric copy/network columns, status card, and bottom rail. Add breakpoints at 1024px and 640px. At 640px hide the pulse card, reduce network opacity, and stack rail values. Include:

```css
@media (prefers-reduced-motion: reduce) {
  .news-page *, .news-page *::before, .news-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Import the stylesheet**

Add `@import "../styles/news.css";` alongside the existing public style imports in `frontend/src/app/globals.css`.

- [ ] **Step 5: Run TypeScript/build validation**

Run: `npm run build` from `frontend/`  
Expected: Next.js production build completes without TypeScript or CSS errors.

- [ ] **Step 6: Commit the hero task**

```bash
git add frontend/src/components/news/NewsHero.tsx frontend/src/components/news/NewsArtwork.tsx frontend/src/styles/news.css frontend/src/app/globals.css
git commit -m "feat: add blockchain news hero"
```

---

### Task 3: Featured editorial layout, filters, feed, and pagination

**Files:**
- Create: `frontend/src/components/news/FeaturedNews.tsx`
- Create: `frontend/src/components/news/NewsFeed.tsx`
- Create: `frontend/src/components/news/NewsLoadingSkeleton.tsx`
- Create: `frontend/src/components/news/NewsFilters.tsx`
- Create: `frontend/src/components/news/NewsPagination.tsx`
- Modify: `frontend/src/styles/news.css`

**Interfaces:**
- All content components consume `NewsViewItem` with `id`, `href`, `title`, `summary`, `category`, `date`, optional `year`, and optional `image`.
- `FeaturedNews` props: `{ featured: NewsViewItem | null; secondary: NewsViewItem[]; lang: 'zh' | 'en' }`.
- `NewsFeed` props: `{ items: NewsViewItem[]; startIndex?: number }`.
- `NewsLoadingSkeleton` props: `{ label: string }`; the localized label is exposed on its `role="status"` container.
- `NewsFilters` consumes current year/category, available entries, disabled state, and callbacks.
- `NewsPagination` consumes `page`, `pageCount`, `loading`, and `onChange`.

- [ ] **Step 1: Implement `FeaturedNews`**

Render a `<section aria-labelledby="latest-news-title">`, one main `<article>` and up to two secondary `<article>` elements. Each article contains a single full-card `Link`, `NewsArtwork`, category/date metadata, balanced title, summary, and an arrow with visually hidden “Read article” text.

- [ ] **Step 2: Implement `NewsFeed`**

Render the remaining items as a two-column `<ol>`. Each row includes tabular sequence number, date/category metadata, title, clamped summary, and arrow. Use one column under 760px and do not wrap each row in a generic glass card.

- [ ] **Step 3: Implement accessible filters**

Group year and category buttons in separately labeled `<div role="group">` controls. Every button uses `aria-pressed={active}`, preserves `disabled={loading}`, resets the page through the callback supplied by `NewsListClient`, and uses the existing bilingual category names.

- [ ] **Step 4: Implement the first-load skeleton**

Render one large feature skeleton, two stacked secondary skeletons, and four feed-row skeletons inside a container with `role="status"` and the supplied localized label. Mark every decorative skeleton block `aria-hidden="true"` and use a single low-contrast background-position shimmer that is disabled by the reduced-motion rule.

- [ ] **Step 5: Implement pagination**

Render `<nav aria-label="News pages">` only when `pageCount > 1`. Buttons expose `aria-current="page"`, have a 44px minimum hit area on mobile, and invoke `onChange(pageNumber)`.

- [ ] **Step 6: Add component styles and interaction states**

Extend `news.css` with the 1.55/0.85 featured grid, cover zoom limited to 1.025, cyan border reveal, two-column editorial feed, filter states, pagination states, image fallback artwork, and explicit focus-visible rules. Ensure all interactive transitions use transform/opacity/color/background/border only.

- [ ] **Step 7: Run the production build**

Run: `npm run build` from `frontend/`  
Expected: build completes and all component imports resolve.

- [ ] **Step 8: Commit the content components**

```bash
git add frontend/src/components/news/FeaturedNews.tsx frontend/src/components/news/NewsFeed.tsx frontend/src/components/news/NewsLoadingSkeleton.tsx frontend/src/components/news/NewsFilters.tsx frontend/src/components/news/NewsPagination.tsx frontend/src/styles/news.css
git commit -m "feat: add editorial news layout"
```

---

### Task 4: Integrate the redesigned page without changing data behavior

**Files:**
- Modify: `frontend/src/components/pages/NewsListClient.tsx`
- Modify: `frontend/src/styles/news.css`

**Interfaces:**
- Consumes all components and pure helpers from Tasks 1–3.
- Preserves the current `mode`, fetch effects, retry, filter, total, page, and legacy fallback state.

- [ ] **Step 1: Read the installed Next.js guidance before editing**

Run: `rg --files node_modules/next/dist/docs | rg 'image|link|client|css' | head -40` from `frontend/`, then read the matching installed-version documents for client components, `Link`, images, and global CSS.

- [ ] **Step 2: Replace duplicate new/legacy JSX with normalized render data**

Import normalization helpers and derive the current list with `useMemo`:

```tsx
const viewItems = useMemo(
  () => mode === 'new'
    ? normalizePublicNews(items, lang, imgUrl)
    : normalizeLegacyNews(visibleLegacy, lang, imgUrl),
  [mode, items, visibleLegacy, lang]
);
const { featured, secondary, feed } = splitNews(viewItems);
```

Avoid recreating `visibleLegacy` on every render by memoizing it before using it as a dependency.

- [ ] **Step 3: Compose the new page**

Inside `PublicPageSwitch`, render one `<main className="news-page">` containing `NewsHero`, `NewsFilters`, `NewsLoadingSkeleton`, error/empty feedback, `FeaturedNews`, `NewsFeed`, and `NewsPagination`. Remove the old inline hero, card grids, chip styles, and duplicate new/legacy card markup.

- [ ] **Step 4: Preserve stable content during filter loads**

Add `aria-busy={loading}` and `data-loading={loading || undefined}` to the news results container. Show `NewsLoadingSkeleton` only when no mode/data has resolved; during filter or page loads keep current content visible and apply a controlled opacity style from `news.css`.

- [ ] **Step 5: Correct edge states**

Keep `ErrorState` with retry, keep `EmptyState` with the contact link, hide absent filter groups, calculate `pageCount` from `activeTotal / 9`, and reset `page` to 1 for every filter change. Ensure legacy category filtering does not show pagination for a client-filtered subset.

- [ ] **Step 6: Run unit and production validation**

Run from `frontend/`:

```bash
node --test src/components/news/newsViewModel.test.mjs
npm run build
```

Expected: all view-model tests pass and the Next.js production build completes.

- [ ] **Step 7: Commit the integration**

```bash
git add frontend/src/components/pages/NewsListClient.tsx frontend/src/styles/news.css
git commit -m "feat: redesign public news page"
```

---

### Task 5: Responsive and interaction verification

**Files:**
- Modify if defects are found: `frontend/src/styles/news.css`
- Modify if defects are found: `frontend/src/components/news/*.tsx`

**Interfaces:**
- Verifies the complete `/news` route against the approved design and design spec.

- [ ] **Step 1: Start the frontend against the available backend/API configuration**

Run: `npm start` after the production build, or `npm run dev` when the production API configuration is unavailable. Open `/news` at 1440×900, 1024×768, and 390×844.

- [ ] **Step 2: Verify desktop presentation**

Confirm the hero has no empty dead zone, heading remains highest contrast, network/status layers remain subordinate, one-primary/two-secondary hierarchy is clear, no-cover artwork is complete, and the feed has no duplicate first-three items.

- [ ] **Step 3: Verify keyboard, loading, and language behavior**

Tab through filters, every article, and pagination; confirm focus rings. Switch Traditional Chinese/English, apply available year/category filters, paginate, trigger retry if the backend is unavailable, and confirm no stale mixed-language content.

- [ ] **Step 4: Verify mobile and reduced motion**

At 390px, confirm no horizontal page overflow, 44px interactive targets, readable single-column articles, and usable filter overflow/wrapping. Emulate `prefers-reduced-motion: reduce` and confirm there is no persistent pulse or translation.

- [ ] **Step 5: Re-run automated checks after any visual corrections**

Run from `frontend/`:

```bash
node --test src/components/news/newsViewModel.test.mjs
npm run build
```

Expected: tests and build pass after final CSS/component corrections.

- [ ] **Step 6: Commit verification corrections if any**

```bash
git add frontend/src/styles/news.css frontend/src/components/news frontend/src/components/pages/NewsListClient.tsx
git commit -m "fix: polish responsive news experience"
```
