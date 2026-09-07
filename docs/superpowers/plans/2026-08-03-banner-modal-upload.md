# Banner Central Modal Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline Banner editor with a centered modal whose image field supports click-to-upload and drag-and-drop, automatically stores uploads in the media library, and never exposes an image URL input.

**Architecture:** Keep Banner persistence unchanged (`image_url` remains the saved field), but route image uploads through `/api/admin/media/uploads` and extract the returned media asset URL. Isolate file validation and response parsing in a pure module, isolate upload UI/state in a focused component, and let the Banner page own modal state, form state, save behavior, and focus restoration.

**Tech Stack:** Next.js 16, React 19, TypeScript, native drag-and-drop and file input APIs, existing Express media upload endpoint, Node `node:test`, existing admin CSS tokens.

## Global Constraints

- The editor must open as a centered floating modal over the current Banner list, never as a left drawer or inline panel.
- The image field must support both click selection and single-image drag-and-drop.
- Successful uploads must create a media-library asset through `/api/admin/media/uploads`.
- The UI must not render an editable image URL field.
- Banner storage remains `image_url`; no database or public-rendering changes are in scope.
- Uploading and saving must prevent accidental close and duplicate submission.
- Editing an existing Banner must preview its current image and allow replace or remove.
- Desktop dialog width is approximately `760px`; narrow screens use a single-column, full-height-safe layout.

---

## File Structure

- Create `frontend/src/lib/bannerImageUpload.mjs`: pure file validation and media response parsing.
- Create `frontend/src/lib/bannerImageUpload.test.mjs`: behavior tests for validation and response parsing.
- Create `frontend/src/components/admin/BannerImageUpload.tsx`: accessible upload/drop/preview component.
- Create `frontend/src/components/admin/BannerImageUpload.contract.test.mjs`: source-level interaction contract for click, drop, endpoint, and absence of URL input.
- Modify `frontend/src/app/admin/banners/page.tsx`: replace inline form with centered modal and wire the upload component.
- Create `frontend/src/app/admin/banners/page.contract.test.mjs`: modal and no-URL-field contract tests.
- Modify `frontend/src/styles/admin.css`: Banner modal sizing, upload states, preview, responsive behavior, and reduced motion.
- Create `frontend/src/styles/bannerModal.contract.test.mjs`: CSS contract tests for centered placement and narrow-screen layout.

### Task 1: Define the Banner upload contract

**Files:**
- Create: `frontend/src/lib/bannerImageUpload.mjs`
- Create: `frontend/src/lib/bannerImageUpload.test.mjs`

**Interfaces:**
- Produces: `validateBannerImageFiles(files: ArrayLike<File> | File[]): { ok: true; file: File } | { ok: false; error: string }`
- Produces: `parseBannerMediaUpload(payload: unknown): { url: string; originalFilename: string }`
- Consumes: unified media response shape `{ success: true, data: { asset: { url, originalFilename } } }`.

- [ ] **Step 1: Write failing validation and parsing tests**

```js
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
  assert.deepEqual(validateBannerImageFiles([file('a.png', 'image/png'), file('b.png', 'image/png')]), { ok: false, error: '每次只能上傳一張圖片。' });
  assert.deepEqual(validateBannerImageFiles([file('brochure.pdf', 'application/pdf')]), { ok: false, error: '只支援 JPG、PNG、WebP、AVIF 或 SVG 圖片。' });
});

test('extracts the media-library URL and filename', () => {
  assert.deepEqual(parseBannerMediaUpload({ success: true, data: { asset: { url: '/uploads/media/banner.webp', originalFilename: 'banner.webp' } } }), {
    url: '/uploads/media/banner.webp', originalFilename: 'banner.webp',
  });
  assert.throws(() => parseBannerMediaUpload({ success: true, data: {} }), /沒有返回圖片資料/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd frontend && node --test src/lib/bannerImageUpload.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `bannerImageUpload.mjs`.

- [ ] **Step 3: Implement the pure contract**

```js
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']);

export function validateBannerImageFiles(files) {
  const list = Array.from(files || []);
  if (list.length === 0) return { ok: false, error: '請選擇一張圖片。' };
  if (list.length !== 1) return { ok: false, error: '每次只能上傳一張圖片。' };
  if (!TYPES.has(list[0].type)) return { ok: false, error: '只支援 JPG、PNG、WebP、AVIF 或 SVG 圖片。' };
  return { ok: true, file: list[0] };
}

export function parseBannerMediaUpload(payload) {
  const asset = payload?.data?.asset;
  if (!asset?.url) throw new Error('伺服器沒有返回圖片資料。');
  return { url: asset.url, originalFilename: asset.originalFilename || '' };
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `cd frontend && node --test src/lib/bannerImageUpload.test.mjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the contract**

```bash
git add frontend/src/lib/bannerImageUpload.mjs frontend/src/lib/bannerImageUpload.test.mjs
git commit -m "test: define banner image upload contract"
```

### Task 2: Build the click-and-drop Banner image field

**Files:**
- Create: `frontend/src/components/admin/BannerImageUpload.tsx`
- Create: `frontend/src/components/admin/BannerImageUpload.contract.test.mjs`

**Interfaces:**
- Consumes: `validateBannerImageFiles` and `parseBannerMediaUpload` from Task 1.
- Produces: `BannerImageUpload({ value, onChange, disabled, onUploadingChange })` where `onChange(url: string, filename?: string): void` and `onUploadingChange(uploading: boolean): void`.

- [ ] **Step 1: Write the failing component contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./BannerImageUpload.tsx', import.meta.url), 'utf8');

test('supports click and drag-drop through one upload function', () => {
  assert.match(source, /type="file"/);
  assert.match(source, /onDrop=/);
  assert.match(source, /uploadFiles/);
});

test('uploads to the media library and never renders a URL input', () => {
  assert.match(source, /\/api\/admin\/media\/uploads/);
  assert.doesNotMatch(source, /placeholder=["'][^"']*URL/i);
  assert.doesNotMatch(source, /type=["']url["']/i);
});

test('offers preview replacement and removal states', () => {
  assert.match(source, /Banner 圖片預覽/);
  assert.match(source, /更換圖片/);
  assert.match(source, /移除圖片/);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `cd frontend && node --test src/components/admin/BannerImageUpload.contract.test.mjs`

Expected: FAIL with `ENOENT` for `BannerImageUpload.tsx`.

- [ ] **Step 3: Implement the upload component**

Create a client component that:

```tsx
type Props = {
  value: string;
  onChange: (url: string, filename?: string) => void;
  disabled?: boolean;
  onUploadingChange: (uploading: boolean) => void;
};

async function uploadFiles(files: FileList | File[]) {
  const validation = validateBannerImageFiles(files);
  if (!validation.ok) { setError(validation.error); return; }
  setUploading(true);
  onUploadingChange(true);
  const form = new FormData();
  form.append('file', validation.file);
  const response = await fetch('/api/admin/media/uploads', {
    method: 'POST', credentials: 'include',
    headers: { 'x-requested-with': 'XMLHttpRequest', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `上傳失敗（${response.status}）`);
  const uploaded = parseBannerMediaUpload(payload);
  setFilename(uploaded.originalFilename || validation.file.name);
  onChange(uploaded.url, uploaded.originalFilename || validation.file.name);
}
```

Render one keyboard-accessible `.banner-image-upload` drop zone. Empty state copy is `拖動 Banner 圖片到這裡` and `或點擊選擇圖片`; selected state renders `<img alt="Banner 圖片預覽">`, filename, `更換圖片`, and `移除圖片`. Use a hidden file input with `accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"` and no `multiple` attribute. Preserve the existing value when replacement upload fails.

- [ ] **Step 4: Run contract and pure tests**

Run: `cd frontend && node --test src/lib/bannerImageUpload.test.mjs src/components/admin/BannerImageUpload.contract.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: Run TypeScript**

Run: `cd frontend && npx tsc --noEmit --allowImportingTsExtensions`

Expected: exit 0.

- [ ] **Step 6: Commit the component**

```bash
git add frontend/src/components/admin/BannerImageUpload.tsx frontend/src/components/admin/BannerImageUpload.contract.test.mjs
git commit -m "feat: add banner image drop upload"
```

### Task 3: Replace the inline Banner form with the centered modal

**Files:**
- Modify: `frontend/src/app/admin/banners/page.tsx`
- Create: `frontend/src/app/admin/banners/page.contract.test.mjs`

**Interfaces:**
- Consumes: `BannerImageUpload` from Task 2.
- Maintains: existing `Banner`, `form`, `handleSave`, load, delete, and Toast flows.
- Produces: centered modal behavior for create and edit paths.

- [ ] **Step 1: Write the failing page contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('renders a centered modal dialog instead of an inline AdminCard', () => {
  assert.match(source, /className="admin-editor-modal"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.doesNotMatch(source, /<AdminCard/);
});

test('uses the Banner upload field and has no image URL editor', () => {
  assert.match(source, /<BannerImageUpload/);
  assert.doesNotMatch(source, /<ImageField/);
  assert.doesNotMatch(source, /圖片 URL|image_url[^\n]*<Input/);
});

test('blocks modal dismissal while uploading or saving', () => {
  assert.match(source, /saving\s*\|\|\s*uploading/);
  assert.match(source, /Escape/);
});
```

- [ ] **Step 2: Run the page contract and verify RED**

Run: `cd frontend && node --test src/app/admin/banners/page.contract.test.mjs`

Expected: FAIL because the page still imports and renders `AdminCard` and `ImageField`.

- [ ] **Step 3: Add modal lifecycle helpers to the page**

Add `uploading`, `openerRef`, and `closeButtonRef` state/refs. Centralize every create/edit trigger through `openEditor(event.currentTarget, banner?)`, storing the exact trigger element in `openerRef`; this covers the heading add button, empty-state add button, and each edit button. Implement `closeEditor()` with `useCallback`: return early while `saving || uploading`, clear editing/form state, close the modal, and restore focus with `requestAnimationFrame(() => openerRef.current?.focus())`.

Add an effect active only while `showForm` is true:

```tsx
useEffect(() => {
  if (!showForm) return;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  closeButtonRef.current?.focus();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !saving && !uploading) closeEditor();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => {
    document.body.style.overflow = previousOverflow;
    window.removeEventListener('keydown', onKeyDown);
  };
}, [showForm, saving, uploading]);
```

- [ ] **Step 4: Render the centered Banner modal**

Replace the `AdminCard` branch with `.admin-editor-modal` and `.admin-editor-modal__dialog.admin-banner-modal`. Use the team editor's established header/body/footer structure, `aria-labelledby="banner-editor-title"`, backdrop dismissal through `closeEditor`, and this body order:

1. `<BannerImageUpload value={form.image_url} onChange={(url) => setForm(...)} disabled={saving} onUploadingChange={setUploading} />`
2. Title bilingual field.
3. Subtitle bilingual field.
4. Description bilingual textarea.
5. Link URL and video URL grid.
6. Sort and active state grid.

Footer left copy: `上傳的圖片會自動進入媒體庫`. Footer right controls: `取消` and `保存 Banner`. Disable save while `uploading`; pass `pending={saving}` to `ActionButton`.

- [ ] **Step 5: Run the page contract and TypeScript**

Run: `cd frontend && node --test src/app/admin/banners/page.contract.test.mjs src/components/admin/BannerImageUpload.contract.test.mjs src/lib/bannerImageUpload.test.mjs && npx tsc --noEmit --allowImportingTsExtensions`

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit modal integration**

```bash
git add frontend/src/app/admin/banners/page.tsx frontend/src/app/admin/banners/page.contract.test.mjs
git commit -m "feat: edit banners in a centered modal"
```

### Task 4: Style and verify the confirmed modal design

**Files:**
- Modify: `frontend/src/styles/admin.css`
- Create: `frontend/src/styles/bannerModal.contract.test.mjs`

**Interfaces:**
- Consumes: `.admin-banner-modal`, `.banner-image-upload`, `.banner-image-upload.is-dragging`, `.has-image`, and child class names from Tasks 2–3.
- Produces: centered desktop and safe narrow-screen layout matching the approved mockup.

- [ ] **Step 1: Write the failing CSS contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./admin.css', import.meta.url), 'utf8');

test('centers the editor modal over a dimmed background', () => {
  assert.match(css, /\.admin-editor-modal\s*\{[^}]*place-items:\s*center/s);
  assert.match(css, /\.admin-banner-modal\s*\{[^}]*width:\s*min\(760px,\s*100%\)/s);
});

test('styles click, drag, preview, and responsive states', () => {
  assert.match(css, /\.banner-image-upload\.is-dragging/);
  assert.match(css, /\.banner-image-upload\.has-image/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*\.admin-banner-modal/);
});
```

- [ ] **Step 2: Run the CSS contract and verify RED**

Run: `cd frontend && node --test src/styles/bannerModal.contract.test.mjs`

Expected: FAIL because Banner-specific modal and upload selectors do not exist.

- [ ] **Step 3: Add Banner modal and upload CSS**

Add focused selectors that preserve the existing team modal styles:

```css
.admin-banner-modal { width: min(760px, 100%); max-height: min(760px, calc(100vh - 56px)); border-radius: 18px; }
.admin-banner-modal .admin-editor-modal__footer { justify-content: space-between; }
.admin-banner-modal__hint { color: var(--text-3); font-size: 11px; }
.banner-image-upload { min-height: 116px; border: 1.5px dashed #9bb7e6; border-radius: 13px; background: #f5f8fd; }
.banner-image-upload.is-dragging { border-color: #3276ed; background: #eef5ff; box-shadow: 0 0 0 4px rgba(50,118,237,.1); }
.banner-image-upload.has-image { display: grid; grid-template-columns: 180px 1fr auto; border-style: solid; }
.banner-image-upload__preview { width: 180px; aspect-ratio: 8 / 3; object-fit: cover; border-radius: 9px; }
```

At `max-width: 620px`, keep `.admin-editor-modal` full-screen-safe, set `.admin-banner-modal` to `width: 100%`, and stack `.banner-image-upload.has-image` plus bilingual fields. Add reduced-motion rules for modal and drag-state transitions.

- [ ] **Step 4: Run all focused tests and TypeScript**

Run: `cd frontend && node --test src/lib/bannerImageUpload.test.mjs src/components/admin/BannerImageUpload.contract.test.mjs src/app/admin/banners/page.contract.test.mjs src/styles/bannerModal.contract.test.mjs && npx tsc --noEmit --allowImportingTsExtensions`

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit visual styling**

```bash
git add frontend/src/styles/admin.css frontend/src/styles/bannerModal.contract.test.mjs
git commit -m "style: polish banner editor modal"
```

### Task 5: Full verification and handoff

**Files:**
- Verify: all files changed in Tasks 1–4.

**Interfaces:**
- Consumes: completed Banner modal upload flow.
- Produces: fresh automated and visual verification evidence.

- [ ] **Step 1: Run the full frontend pure-test suite**

Run: `cd frontend && node --test src/**/*.test.mjs src/**/*.test.mts`

Expected: all tests pass, including the new upload and modal contracts.

- [ ] **Step 2: Run TypeScript and production build**

Run: `cd frontend && npx tsc --noEmit --allowImportingTsExtensions && npm run build`

Expected: TypeScript exits 0 and Next.js production build completes successfully.

- [ ] **Step 3: Inspect the real interaction**

At `/admin/banners`:

1. Click `+ 新增` and verify a centered modal appears over the dimmed list.
2. Press `Escape`, reopen, and verify focus returns to the add button after close.
3. Click the drop zone, select a supported image, and verify upload preview plus media-library creation.
4. Drag a second supported image onto the field and verify replacement.
5. Drop multiple files and a PDF separately; verify no request is sent and the correct inline error appears.
6. Save a Banner and verify the modal closes, list refreshes, and Toast appears.
7. Edit the saved Banner, verify preview prefill, remove or replace the image, and save again.
8. Check narrow viewport layout, keyboard reachability, and browser console errors.

- [ ] **Step 4: Run whitespace and scope checks**

Run: `git diff --check -- frontend/src/lib/bannerImageUpload.mjs frontend/src/lib/bannerImageUpload.test.mjs frontend/src/components/admin/BannerImageUpload.tsx frontend/src/components/admin/BannerImageUpload.contract.test.mjs frontend/src/app/admin/banners/page.tsx frontend/src/app/admin/banners/page.contract.test.mjs frontend/src/styles/admin.css frontend/src/styles/bannerModal.contract.test.mjs`

Expected: exit 0 with no output.

- [ ] **Step 5: Record final status**

If browser interaction is unavailable, report visual verification as blocked and request screenshots rather than claiming visual completion. If all checks pass, update the implementation plan checkboxes and hand off the centered Banner modal.
