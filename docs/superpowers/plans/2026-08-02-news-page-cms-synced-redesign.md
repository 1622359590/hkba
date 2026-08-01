# HKBA CMS-Synced Premium News Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved premium blockchain-news layout and expose its hero, featured source, secondary count, year, category, and list controls through the existing CMS component system with shared Studio/public rendering.

**Architecture:** Extend existing component variants rather than adding a monolithic portal component. Normalize public and legacy records into one `NewsViewItem`, render shared presentation components in the legacy page, published `/news` experience, and Studio canvas, and keep query state in a dedicated published-page coordinator. Add a read-only published-news-by-ID endpoint for pinned focus items and upgrade only untouched legacy default news pages through an idempotent draft migration.

**Tech Stack:** Node.js built-in test runner, Express, better-sqlite3, Next.js 16.2 App Router, React 19, TypeScript/JavaScript modules, Tailwind CSS 4 global imports, CSS.

## Global Constraints

- Add no third-party package and do not change the database schema.
- Preserve public-first/legacy-fallback behavior when `/news` has no published page tree.
- Store news query conditions in page blocks; never copy article bodies into page configuration.
- Reuse the same React presentation components in public rendering and Studio preview.
- Use cyan as the only foreground accent and blue only for background depth.
- Never fabricate partner, region, network, or on-chain statistics.
- Keep existing custom `/news` pages untouched; upgrade only the exact old system default.
- Respect keyboard focus, reduced motion, bilingual content, missing images, loading, empty, and error states.
- Do not change the news detail page or backend news editing/upload workflow.

---

## File Structure

- Modify `backend/components/registry/definitions/content.js`: add the `network-news` hero variant.
- Modify `backend/components/registry/definitions/newsDisplay.js`: add `flagship`, `editorial`, and `technology` variants and their controls.
- Modify `backend/components/registry/registry.test.js`: lock the new component contracts.
- Modify `backend/lib/newsQuery.js`: add ordered published-news-by-ID lookup.
- Modify `backend/routes/publicContent.js`: expose `/news/by-ids` before `/news/item/:slug`.
- Modify `backend/test/publicContent.test.js`: prove ordering and draft/withdrawn filtering.
- Modify `backend/lib/ensureSystemPages.js`: seed the four-block layout and safely upgrade the exact old default.
- Modify `backend/lib/ensureSystemPages.test.js`: prove fresh install, safe upgrade, custom-page preservation, and idempotence.
- Create `frontend/src/components/news/newsTypes.ts`: shared view and configuration contracts.
- Create `frontend/src/components/news/newsViewModel.mjs`: pure normalization, pinned selection, and feed exclusion.
- Create `frontend/src/components/news/newsViewModel.test.mjs`: frontend pure-logic tests.
- Create `frontend/src/components/news/NewsArtwork.tsx`: real cover with deterministic fallback.
- Create `frontend/src/components/news/NewsHero.tsx`: network hero using CMS text and real counts.
- Create `frontend/src/components/news/NewsFilters.tsx`: controlled year/category groups.
- Create `frontend/src/components/news/FeaturedNews.tsx`: one-primary/configurable-secondary layout.
- Create `frontend/src/components/news/NewsFeed.tsx`: two-column editorial feed.
- Create `frontend/src/components/news/NewsPagination.tsx`: accessible pagination.
- Create `frontend/src/components/news/NewsLoadingSkeleton.tsx`: geometry-matched first-load state.
- Create `frontend/src/components/news/NewsExperience.tsx`: shared presentational composition for public and Studio.
- Create `frontend/src/components/news/PublishedNewsExperience.tsx`: published block parsing and query coordination.
- Modify `frontend/src/lib/publicContent.ts`: add `fetchPublicNewsByIds`.
- Modify `frontend/src/components/pages/NewsListClient.tsx`: use shared fallback presentation while retaining API fallback.
- Modify `frontend/src/components/PublicPageSwitch.tsx`: route published `/news` to `PublishedNewsExperience`.
- Modify `frontend/src/components/blocks/BlockRenderer.tsx`: render premium variants in Studio using shared components.
- Create `frontend/src/styles/news.css`: all news-specific presentation and responsive states.
- Modify `frontend/src/app/globals.css`: import news styles.

---

### Task 1: CMS component contracts

**Files:**
- Modify: `backend/components/registry/definitions/content.js`
- Modify: `backend/components/registry/definitions/newsDisplay.js`
- Modify: `backend/components/registry/registry.test.js`

**Interfaces:**
- Produces `content.hero.settings.variant = 'network-news'`.
- Produces `news.featured.settings.variant = 'flagship'` plus existing `source`, `pinnedIds`, `secondaryCount`, and `fallbackToLatest`.
- Produces `news.list.settings.variant = 'editorial'`, `pageSize`, `showSummary`, and `showDate`.
- Produces `news.category-tabs.settings.variant = 'technology'`, `showYearFilter`, `showCategoryFilter`, and `maxTabs`.

- [ ] **Step 1: Add failing registry contract tests**

```js
test('premium news variants expose editable CMS controls', () => {
  const hero = registry.getDefinition('content.hero').schema.settings.fields;
  assert.ok(hero.variant.values.includes('network-news'));

  const featured = registry.getDefinition('news.featured').schema.settings.fields;
  assert.ok(featured.variant.values.includes('flagship'));
  assert.deepEqual(featured.source.values, ['auto', 'pinned']);
  assert.equal(featured.secondaryCount.min, 2);
  assert.equal(featured.secondaryCount.max, 4);

  const list = registry.getDefinition('news.list').schema.settings.fields;
  assert.ok(list.variant.values.includes('editorial'));
  assert.equal(list.pageSize.min, 5);
  assert.equal(list.showSummary.type, 'boolean');
  assert.equal(list.showDate.type, 'boolean');

  const tabs = registry.getDefinition('news.category-tabs').schema.settings.fields;
  assert.ok(tabs.variant.values.includes('technology'));
  assert.equal(tabs.showYearFilter.type, 'boolean');
  assert.equal(tabs.showCategoryFilter.type, 'boolean');
});
```

- [ ] **Step 2: Run the registry tests and verify the new contract test fails**

Run: `node --test components/registry/registry.test.js` from `backend/`  
Expected: FAIL because the new variant fields are absent.

- [ ] **Step 3: Extend the definitions without changing component types or versions**

Use these exact enum/default additions:

```js
// content.hero
variant: { type: 'enum', values: ['full', 'left', 'center', 'split', 'network-news'], default: 'full', label: '變體' }

// news.featured extraSettings
variant: { type: 'enum', values: ['cards', 'flagship'], default: 'cards', label: '變體' }

// news.list extraSettings
variant: { type: 'enum', values: ['compact', 'thumb', 'timeline', 'editorial'], default: 'thumb', label: '變體' },
showSummary: { type: 'boolean', default: true, label: '顯示摘要' },
showDate: { type: 'boolean', default: true, label: '顯示日期' }

// news.category-tabs extraSettings
variant: { type: 'enum', values: ['plain', 'technology'], default: 'plain', label: '變體' },
showYearFilter: { type: 'boolean', default: true, label: '顯示年份篩選' },
showCategoryFilter: { type: 'boolean', default: true, label: '顯示欄目篩選' }
```

- [ ] **Step 4: Run all registry tests**

Run: `node --test components/registry/registry.test.js` from `backend/`  
Expected: all tests PASS.

- [ ] **Step 5: Commit only Task 1 files if Git permissions are available**

```bash
git add backend/components/registry/definitions/content.js backend/components/registry/definitions/newsDisplay.js backend/components/registry/registry.test.js
git commit -m "feat: add premium news component variants"
```

---

### Task 2: Ordered pinned-news public query

**Files:**
- Modify: `backend/lib/newsQuery.js`
- Modify: `backend/routes/publicContent.js`
- Modify: `backend/test/publicContent.test.js`
- Modify: `frontend/src/lib/publicContent.ts`

**Interfaces:**
- Backend `queryPublishedNewsByIds(conn, ids: string[])` returns published rows in the first-occurrence order of at most 24 unique IDs.
- Public endpoint `GET /api/public/news/by-ids?ids=id-1,id-2` returns `{ items: PublicNewsListItem[] }`.
- Frontend `fetchPublicNewsByIds(ids: string[]): Promise<PublicNewsListItem[] | null>`.

- [ ] **Step 1: Add a failing public endpoint test**

Extend the published-news test fixture to create a second published item, then add:

```js
test('public pinned-news lookup preserves request order and excludes unpublished rows', async () => {
  const published = db.prepare("SELECT id FROM news_items WHERE slug = 'm8-news-slug'").get();
  db.prepare(
    `INSERT INTO news_items
      (id, slug, title_zh, title_en, summary_zh, summary_en, status)
     VALUES ('draft-pin', 'draft-pin', '草稿', 'Draft', '草稿摘要', 'Draft summary', 'draft')`
  ).run();

  const res = await publicGet(`/news/by-ids?ids=draft-pin,${published.id},${published.id}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.items.map((item) => item.id), [published.id]);
});
```

- [ ] **Step 2: Run the public content test and verify 404/failure**

Run: `node --test test/publicContent.test.js` from `backend/`  
Expected: FAIL because `/news/by-ids` is not registered.

- [ ] **Step 3: Implement the ordered query helper**

```js
function queryPublishedNewsByIds(conn, ids = []) {
  const ordered = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))].slice(0, 24);
  if (!ordered.length) return [];
  const rows = conn.prepare(
    `SELECT id, slug, title_zh, title_en, summary_zh, summary_en, cover_media_id,
            published_at, display_year, ${EFFECTIVE_YEAR_SQL} AS effective_year
     FROM news_items WHERE status = 'published' AND id IN (${ordered.map(() => '?').join(',')})`
  ).all(...ordered);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ordered.map((id) => byId.get(id)).filter(Boolean);
}
```

Export the helper from `newsQuery.js`.

- [ ] **Step 4: Add the endpoint before `/news/item/:slug`**

Parse `ids` with `String(req.query.ids || '').split(',')`, call `queryPublishedNewsByIds`, and map every row through the same public item serializer used by `/news`. Extract the existing inline serializer into `newsListItemJson(conn, item)` so list and pinned endpoints cannot drift.

- [ ] **Step 5: Add the frontend fetch helper**

```ts
export async function fetchPublicNewsByIds(ids: string[]): Promise<PublicNewsListItem[] | null> {
  if (!ids.length) return [];
  const data = await get<{ items: PublicNewsListItem[] }>(
    `/api/public/news/by-ids?ids=${encodeURIComponent(ids.join(','))}`
  );
  return data ? data.items : null;
}
```

- [ ] **Step 6: Run the public integration test**

Run: `node --test test/publicContent.test.js` from `backend/`  
Expected: all tests PASS.

- [ ] **Step 7: Commit only Task 2 files if Git permissions are available**

```bash
git add backend/lib/newsQuery.js backend/routes/publicContent.js backend/test/publicContent.test.js frontend/src/lib/publicContent.ts
git commit -m "feat: query published news by pinned ids"
```

---

### Task 3: Safe default `/news` page upgrade

**Files:**
- Modify: `backend/lib/ensureSystemPages.js`
- Modify: `backend/lib/ensureSystemPages.test.js`

**Interfaces:**
- Fresh installs seed block types `['content.hero', 'news.featured', 'news.category-tabs', 'news.list']`.
- `upgradeDefaultNewsPage(conn): boolean` creates or updates a draft only when the source exactly matches the old two-block default.
- `ensureSystemPages` report gains `upgraded: string[]` and remains idempotent.

- [ ] **Step 1: Change the fresh-install expectation and add safe-upgrade tests**

Use these literal assertions:

```js
assert.deepEqual(expectedBlocks['/news'], [
  'content.hero', 'news.featured', 'news.category-tabs', 'news.list'
]);
assert.deepEqual(JSON.parse(newsBlocks[0].settings), { variant: 'network-news', overlay: 35 });
assert.equal(JSON.parse(newsBlocks[1].settings).variant, 'flagship');
assert.equal(JSON.parse(newsBlocks[2].settings).variant, 'technology');
assert.equal(JSON.parse(newsBlocks[3].settings).variant, 'editorial');
```

Add one fixture with the exact old default hero/list and one with an extra custom rich-text block. Assert the exact default receives one four-block draft, the custom page remains unchanged, and a second `ensureSystemPages` call reports no upgrade and keeps block/version counts stable.

- [ ] **Step 2: Run the system-page test and verify it fails on the old two-block seed**

Run: `node --test lib/ensureSystemPages.test.js` from `backend/`  
Expected: FAIL because `/news` still contains two blocks and no upgrade report exists.

- [ ] **Step 3: Update the default block definition**

Use this block sequence and defaults:

```js
[
  ['content.hero', heroZh, heroEn, { variant: 'network-news', overlay: 35 }],
  ['news.featured', { title: '焦點新聞', description: '' }, { title: 'Featured', description: '' },
    { yearMode: 'all', limit: 5, sort: 'newest', source: 'auto', pinnedIds: [], secondaryCount: 2, fallbackToLatest: true, variant: 'flagship' }],
  ['news.category-tabs', { title: '新聞篩選', description: '' }, { title: 'News filters', description: '' },
    { yearMode: 'visitor-select', limit: 8, sort: 'newest', maxTabs: 8, variant: 'technology', showYearFilter: true, showCategoryFilter: true }],
  ['news.list', { title: '最新新聞', description: '' }, { title: 'Latest News', description: '' },
    { yearMode: 'visitor-select', limit: 9, pageSize: 9, sort: 'newest', variant: 'editorial', showSummary: true, showDate: true }]
]
```

- [ ] **Step 4: Implement exact-default detection and draft-only upgrade**

`upgradeDefaultNewsPage` must require exactly two source blocks, types `content.hero` then `news.list`, old default Chinese/English hero titles, and old list titles. If the page has only a published version, call the existing `clonePublishedToDraft`. Replace blocks only in the draft version. Return `true` once and `false` thereafter.

- [ ] **Step 5: Run the system-page test**

Run: `node --test lib/ensureSystemPages.test.js` from `backend/`  
Expected: all tests PASS.

- [ ] **Step 6: Commit only Task 3 files if Git permissions are available**

```bash
git add backend/lib/ensureSystemPages.js backend/lib/ensureSystemPages.test.js
git commit -m "feat: upgrade default news page components"
```

---

### Task 4: Shared frontend news model

**Files:**
- Create: `frontend/src/components/news/newsTypes.ts`
- Create: `frontend/src/components/news/newsViewModel.mjs`
- Create: `frontend/src/components/news/newsViewModel.test.mjs`

**Interfaces:**
- `NewsViewItem` contains `id`, `href`, `title`, `summary`, `category`, `date`, optional `year`, and optional image.
- `normalizePublicNews`, `normalizeLegacyNews`, and `selectNewsLayout` are pure functions.
- `selectNewsLayout(items, pinnedItems, secondaryCount)` returns `{ featured, secondary, feed }` with no duplicate IDs.

- [ ] **Step 1: Write failing localization and selection tests**

```js
test('selectNewsLayout keeps pinned order and removes focus items from the feed', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const pinned = [{ id: 'c' }, { id: 'a' }];
  const result = selectNewsLayout(items, pinned, 2);
  assert.equal(result.featured.id, 'c');
  assert.deepEqual(result.secondary.map((item) => item.id), ['a', 'b']);
  assert.deepEqual(result.feed.map((item) => item.id), ['d']);
});

test('normalizePublicNews uses localized fallbacks and title image alt', () => {
  const [item] = normalizePublicNews([publicFixture], 'en', (url) => `/api${url}`);
  assert.equal(item.title, '政策更新');
  assert.equal(item.category, 'Policy');
  assert.deepEqual(item.image, { src: '/api/media/a.jpg', alt: '政策更新' });
});
```

The full `publicFixture` must mirror every `PublicNewsListItem` field: IDs, slug, bilingual title/summary, year, published date, cover, categories, and tags.

- [ ] **Step 2: Run tests and verify module-not-found failure**

Run: `node --test src/components/news/newsViewModel.test.mjs` from `frontend/`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement shared types and pure functions**

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

Selection algorithm: de-duplicate pinned items, take the first as primary, fill secondary slots from remaining pinned items then non-focus page items, and filter every selected ID out of the feed. With no pinned items, use the page list in order.

- [ ] **Step 4: Run the view-model tests**

Run: `node --test src/components/news/newsViewModel.test.mjs` from `frontend/`  
Expected: all tests PASS.

- [ ] **Step 5: Commit only Task 4 files if Git permissions are available**

```bash
git add frontend/src/components/news/newsTypes.ts frontend/src/components/news/newsViewModel.mjs frontend/src/components/news/newsViewModel.test.mjs
git commit -m "refactor: unify news presentation data"
```

---

### Task 5: Shared premium presentation and Studio rendering

**Files:**
- Create: `frontend/src/components/news/NewsArtwork.tsx`
- Create: `frontend/src/components/news/NewsHero.tsx`
- Create: `frontend/src/components/news/NewsFilters.tsx`
- Create: `frontend/src/components/news/FeaturedNews.tsx`
- Create: `frontend/src/components/news/NewsFeed.tsx`
- Create: `frontend/src/components/news/NewsPagination.tsx`
- Create: `frontend/src/components/news/NewsLoadingSkeleton.tsx`
- Create: `frontend/src/components/news/NewsExperience.tsx`
- Create: `frontend/src/styles/news.css`
- Modify: `frontend/src/components/blocks/BlockRenderer.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- `NewsExperience` receives localized hero copy, normalized items, years/categories, active filters, loading/error flags, display settings, and callbacks.
- `BlockRenderer` uses `network-news`, `flagship`, `technology`, and `editorial` branches in both public block and Studio canvas contexts.
- Canvas links continue using the existing `.hk-canvas-block` navigation guard.

`NewsExperience` uses this exact contract in its component file:

```ts
export type NewsExperienceProps = {
  lang: 'zh' | 'en';
  hero: { title: string; subtitle: string };
  featured: NewsViewItem | null;
  secondary: NewsViewItem[];
  feed: NewsViewItem[];
  total: number;
  years: number[];
  categories: { id: string; name: string }[];
  year: number;
  categoryId: string;
  page: number;
  pageCount: number;
  loading: boolean;
  initialLoading: boolean;
  error: string;
  showYearFilter: boolean;
  showCategoryFilter: boolean;
  showSummary: boolean;
  showDate: boolean;
  onYearChange: (year: number) => void;
  onCategoryChange: (categoryId: string) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
};
```

- [ ] **Step 1: Create `NewsArtwork` and `NewsHero`**

`NewsArtwork` is a client component with local image-failure state. When no working image exists it renders a deterministic seven-node SVG with `aria-hidden="true"`. `NewsHero` renders CMS title/subtitle, Hong Kong coordinates, static network SVG, a pulse card showing `total`, and a rail limited to real total/category/year/date values.

- [ ] **Step 2: Create feature, filter, feed, pagination, and skeleton components**

Use semantic `section`, `article`, `ol`, and `nav`. Filter buttons use `aria-pressed`; current pagination uses `aria-current="page"`; image alternatives come from `NewsViewItem`; skeleton decorations use `aria-hidden="true"` inside one localized `role="status"` container.

- [ ] **Step 3: Compose `NewsExperience`**

```tsx
<main className="news-page">
  <NewsHero {...hero} total={total} categoryCount={categories.length} activeYear={year} latestDate={latestDate} />
  <section className="news-page__content">
    <NewsFilters {...filterProps} />
    {initialLoading ? <NewsLoadingSkeleton label={loadingLabel} /> : null}
    {error ? <ErrorState message={error} onRetry={onRetry} /> : null}
    {!initialLoading && !error && featured ? <FeaturedNews featured={featured} secondary={secondary} /> : null}
    {!initialLoading && !error ? <NewsFeed items={feed} /> : null}
    <NewsPagination page={page} pageCount={pageCount} loading={loading} onChange={onPageChange} />
  </section>
</main>
```

Use the existing `EmptyState` when no featured item exists after loading.

- [ ] **Step 4: Route premium variants through `BlockRenderer`**

For `content.hero` with `variant === 'network-news'`, render `NewsHero` with the block's localized title/subtitle. For premium `news.*` variants, render the corresponding shared component from Studio's supplied `news` array. Do not alter generic variants. Pinned IDs absent from the Studio array produce a visible localized fallback note and then use latest preview records.

- [ ] **Step 5: Implement `news.css` and import it**

Implement the approved asymmetric hero, 34px low-contrast grid, network lines, pulse card, bottom rail, 1.55/0.85 focus grid, two-column editorial feed, cyan-only states, 1024px/640px breakpoints, 44px mobile targets, focus rings, image fallback, stable loading opacity, and this reduced-motion rule:

```css
@media (prefers-reduced-motion: reduce) {
  .news-page *, .news-page *::before, .news-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Add `@import "../styles/news.css";` to `globals.css`.

- [ ] **Step 6: Run the frontend production build**

Run: `npm run build` from `frontend/`. If Turbopack fails only because the sandbox forbids local port binding, rerun the same command with approved escalation.  
Expected: build and TypeScript PASS.

- [ ] **Step 7: Commit only Task 5 files if Git permissions are available**

```bash
git add frontend/src/components/news frontend/src/components/blocks/BlockRenderer.tsx frontend/src/styles/news.css frontend/src/app/globals.css
git commit -m "feat: render premium news components"
```

---

### Task 6: Published-page coordination and legacy fallback integration

**Files:**
- Create: `frontend/src/components/news/PublishedNewsExperience.tsx`
- Modify: `frontend/src/components/PublicPageSwitch.tsx`
- Modify: `frontend/src/components/pages/NewsListClient.tsx`

**Interfaces:**
- `PublishedNewsExperience` props: `{ page: PublicPage; lang: 'zh' | 'en' }`.
- It extracts premium block settings, fetches years/categories/list/pinned items, and passes normalized state to `NewsExperience`.
- `NewsListClient` retains legacy/public probing when there is no published page.

- [ ] **Step 1: Implement block configuration parsing**

Inside `PublishedNewsExperience`, find blocks by type and use safe defaults when any optional block is absent. Only activate the combined premium layout when at least one premium variant is present; otherwise `PublicPageSwitch` continues through generic `BlockRenderer` for custom legacy page trees.

- [ ] **Step 2: Implement coordinated fetching**

On mount load years/categories. On page/year/category changes call `fetchPublicNews` using list `pageSize`, resolved year mode, and category. When featured source is pinned, call `fetchPublicNewsByIds(pinnedIds)` in parallel. Preserve current items during subsequent requests and ignore late responses with a cancellation flag.

- [ ] **Step 3: Integrate `PublicPageSwitch`**

After a published page loads, route `path === '/news'` plus a premium block to:

```tsx
<PublishedNewsExperience page={page} lang={lang} />
```

Keep every existing home/team/generic page branch unchanged.

- [ ] **Step 4: Refactor `NewsListClient` onto `NewsExperience`**

Preserve its current effects and state. Replace duplicated public/legacy card JSX with `normalizePublicNews`, `normalizeLegacyNews`, `selectNewsLayout`, and `NewsExperience`. Maintain `PublicPageSwitch path="/news"`, retry behavior, legacy client-side category filtering, and pagination restrictions for filtered legacy subsets.

- [ ] **Step 5: Run targeted backend and frontend tests**

Run:

```bash
cd backend && node --test components/registry/registry.test.js lib/ensureSystemPages.test.js test/publicContent.test.js
cd ../frontend && node --test src/components/news/newsViewModel.test.mjs
npm run build
```

Expected: all targeted tests and the frontend build PASS. The pre-existing unrelated `studioCanvasLayout.test.mjs` failure is not part of this command.

- [ ] **Step 6: Verify responsive and Studio behavior**

Run the built application and inspect `/news` plus the `/news` Studio canvas at 1440×900, 1024×768, and 390×844. Verify bilingual hero copy, automatic and pinned focus selection, secondary count, year/category controls, pagination, missing cover fallback, keyboard focus, reduced motion, no duplicate focus/feed records, and no horizontal mobile overflow.

- [ ] **Step 7: Commit only Task 6 files if Git permissions are available**

```bash
git add frontend/src/components/news/PublishedNewsExperience.tsx frontend/src/components/PublicPageSwitch.tsx frontend/src/components/pages/NewsListClient.tsx
git commit -m "feat: synchronize news page with CMS settings"
```
