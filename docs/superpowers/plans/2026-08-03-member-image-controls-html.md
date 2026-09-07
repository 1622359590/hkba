# Member Image Controls HTML Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a standalone interactive HTML prototype showing component-level controls for member image size, ratio, crop position, and grid columns.

**Architecture:** A single browser-openable HTML file owns the mock Studio layout, preview cards, styles, and dependency-free interaction logic. A small Node.js test reads the artifact and verifies the agreed controls, bounds, and event bindings without adding production dependencies.

**Tech Stack:** Semantic HTML, CSS custom properties, vanilla JavaScript, Node.js built-in test runner.

## Global Constraints

- Do not modify the existing CMS or connect the prototype to backend data.
- Avatar size range is 64–140px with a default of 96px.
- Image ratio options are square and portrait 4:5.
- Crop position options are center and top.
- Grid column options are 2, 3, and 4.
- Controls update the preview immediately and include a reset-to-default action.
- On narrow screens, the settings panel moves below the preview.

---

### Task 1: Interactive member image controls prototype

**Files:**
- Create: `docs/member-image-controls-prototype.html`
- Create: `scripts/member-image-controls-prototype.test.mjs`

**Interfaces:**
- Consumes: The approved design spec at `docs/superpowers/specs/2026-08-03-member-image-controls-html-design.md` and the supplied Studio screenshot.
- Produces: A standalone page whose DOM exposes `#avatarSize`, `#imageRatio`, `#cropPosition`, `#gridColumns`, and `#resetControls`; CSS variables `--avatar-size`, `--avatar-ratio`, `--avatar-position`, and `--grid-columns` drive the preview.

- [x] **Step 1: Write the failing artifact test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../docs/member-image-controls-prototype.html', import.meta.url);

test('prototype exposes the approved member image controls', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const id of ['avatarSize', 'imageRatio', 'cropPosition', 'gridColumns', 'resetControls']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /min="64"/);
  assert.match(html, /max="140"/);
  assert.match(html, /value="96"/);
  assert.match(html, /--avatar-size/);
  assert.match(html, /--avatar-ratio/);
  assert.match(html, /--avatar-position/);
  assert.match(html, /--grid-columns/);
  assert.match(html, /addEventListener\(['"]input['"]/);
  assert.match(html, /addEventListener\(['"]change['"]/);
  assert.match(html, /addEventListener\(['"]click['"]/);
});
```

- [x] **Step 2: Run the test and confirm the artifact is missing**

Run: `node --test scripts/member-image-controls-prototype.test.mjs`

Expected: FAIL with `ENOENT` for `docs/member-image-controls-prototype.html`.

- [x] **Step 3: Generate and inspect the visual reference**

Generate one large desktop reference for a light Studio shell with a dark six-card member directory selected on the canvas. The right inspector shows a prominent image-size slider, square/4:5 segmented control, center/top crop control, 2/3/4 column selector, and reset action. Inspect hierarchy, spacing, control clarity, and avatar prominence before translating it to HTML.

- [x] **Step 4: Implement the standalone prototype**

Create `docs/member-image-controls-prototype.html` with:

```html
<input id="avatarSize" type="range" min="64" max="140" value="96">
<select id="imageRatio">
  <option value="1 / 1">正方形</option>
  <option value="4 / 5">直向 4:5</option>
</select>
<select id="cropPosition">
  <option value="center">置中</option>
  <option value="center top">靠上</option>
</select>
<select id="gridColumns">
  <option value="2">2 列</option>
  <option value="3" selected>3 列</option>
  <option value="4">4 列</option>
</select>
<button id="resetControls" type="button">恢復預設</button>
```

Use six local-looking member portraits rendered through remote placeholder image URLs with initial-based fallbacks, a dark navy preview component, a light inspector, and CSS custom properties updated by vanilla JavaScript. Add a responsive breakpoint at 900px that stacks the inspector below the canvas.

- [x] **Step 5: Run the automated artifact check**

Run: `node --test scripts/member-image-controls-prototype.test.mjs`

Expected: PASS with 1 test and 0 failures.

- [x] **Step 6: Verify visual behavior in a browser-sized capture**

Open the HTML at a desktop viewport, verify the default 96px/1:1/center/3-column state, then exercise 140px, 4:5, top crop, and 2-column settings. Confirm cards do not overflow and reset restores defaults. Repeat at a width below 900px and confirm the inspector stacks beneath the preview.

- [x] **Step 7: Commit the prototype and test**

```bash
git add docs/member-image-controls-prototype.html scripts/member-image-controls-prototype.test.mjs
git commit -m "feat: prototype member image controls"
```
