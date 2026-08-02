# Studio Property Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Studio's raw schema form with a modern, non-technical property editor while fixing the drawer focus theft and preserving all existing page data contracts.

**Architecture:** Keep the registry-driven `PropertyForm` and its existing `onChange` persistence path. Add focused reusable controls for rich text and media, improve object/optional-field presentation inside `PropertyForm`, and apply one shared CSS vocabulary in `forms.css` and `studio.css`. No API schema, database, public renderer, bilingual model, or canvas rendering changes are required.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS modules imported through the existing global stylesheet, existing `/api/admin/media/uploads` endpoint.

## Global Constraints

- Preserve `FieldDef`, `Definition`, `RenderBlock`, and the current `onChange(scope, key, value)` interface.
- Keep stored rich-text values as HTML strings compatible with `BlockRenderer`.
- Do not change API/backend code, database schema, public block rendering, bilingual state, or Studio dark preview.
- All interactive controls retain visible keyboard focus and a minimum 40px control height; media actions use 44px touch targets where practical.
- Respect the existing light admin gold/cyan token override.

---

### Task 1: Stable Drawer Focus

**Files:**
- Modify: `frontend/src/components/admin/shell/Drawer.tsx`

**Interfaces:**
- Consumes: `open: boolean`, `onClose: () => void`.
- Produces: identical `Drawer` public props with focus applied once per closed-to-open transition.

- [ ] **Step 1: Store the latest close callback in a ref**

Add `onCloseRef`, synchronize it in a small effect, and call `onCloseRef.current()` from the Escape listener.

- [ ] **Step 2: Limit the focus effect to `open` transitions**

Change the keyboard/focus effect dependency list to `[open]`; its 40ms timer must not restart when an inline `onClose` function changes identity during typing.

- [ ] **Step 3: Verify TypeScript and keyboard behavior**

Run `npm run build` in `frontend`. Manually open a property drawer, type at least ten Chinese characters, press Escape, reopen, and confirm that focus is never stolen while typing.

### Task 2: Visual Rich Text and Media Controls

**Files:**
- Create: `frontend/src/components/admin/studio/RichTextEditor.tsx`
- Create: `frontend/src/components/admin/studio/MediaField.tsx`
- Modify: `frontend/src/app/admin/studio/PropertyForm.tsx`

**Interfaces:**
- Produces: `RichTextEditor({ value, onChange, label, required, maxLength })`.
- Produces: `MediaField({ value, onChange, label, required, onPickMedia })`.
- Media upload POSTs `FormData(file)` to `/api/admin/media/uploads` and writes `body.data.asset.id` through `onChange`.

- [ ] **Step 1: Implement the visual rich-text surface**

Render a compact paragraph/heading, bold, italic, list, link, undo and redo toolbar above a `contentEditable` document surface. Prevent toolbar mousedown from clearing selection, reject unsafe link protocols, normalize pasted HTML to headings, paragraphs, lists, emphasis and links, and emit an empty string for visually empty content.

- [ ] **Step 2: Preserve caret state**

Synchronize `value` into `editorRef.current.innerHTML` only when the editor is not focused and the external HTML differs. Emit local edits through `onInput` without assigning `innerHTML` during the same keystroke.

- [ ] **Step 3: Implement media drag/drop and picker fallback**

Render a drop target with upload state, error state, current selection summary, hidden file input, media-library button and clear button. Accept the backend-supported upload types and use the existing admin bearer/cookie/CSRF request shape.

- [ ] **Step 4: Route schema fields to the new controls**

Use `RichTextEditor` only for `definition.type === 'content.rich-text' && fieldKey === 'html'`. Use `MediaField` for `def.media`. Leave ordinary strings, integers, enums, booleans, arrays and other long text values on schema-driven controls.

- [ ] **Step 5: Verify data compatibility**

Run the frontend build and manually confirm that existing HTML opens formatted, edits update Studio preview, switching ZH/EN reloads the correct HTML, uploaded media IDs populate the selected field, and media-library selection still works.

### Task 3: Unified Property Form Presentation

**Files:**
- Modify: `frontend/src/app/admin/studio/PropertyForm.tsx`
- Modify: `frontend/src/styles/forms.css`
- Modify: `frontend/src/styles/studio.css`
- Modify: `docs/superpowers/specs/2026-08-02-studio-rich-text-focus-design.md`

**Interfaces:**
- Keeps all schema field values and callbacks unchanged.
- Adds presentation classes only: `hk-form__section`, `hk-form__compound`, `hk-field__head`, `hk-field__count`, `hk-toggle`, `hk-media-field`, and `hk-rich-editor`.

- [ ] **Step 1: Remove nested form cards**

Render top-level content and settings as border-separated sections. Render object fields as subtle compound groups, arrays as individually removable repeat rows, and labels with required/optional metadata and character counts.

- [ ] **Step 2: Make optional link objects progressive**

For object fields whose children are not required and currently empty, show an off toggle and hide the child inputs. Enabling initializes the object defaults; disabling clears its child values. Required link objects remain expanded.

- [ ] **Step 3: Modernize standard controls**

Give text, textarea, select, number, checkbox/toggle and range-like controls consistent 8px radii, 42px height, restrained cyan focus, readable placeholders, hover states and mobile stacking. Replace inline styling in the touched property-field paths with named classes.

- [ ] **Step 4: Align drawer shell with the approved prototype**

Use a 64-76px header, restrained backdrop/shadow, 440-472px default editing width, and a single-layer body. Do not animate or decorate inactive controls.

- [ ] **Step 5: Document and verify**

Expand the design spec to cover the complete property-control system, then run `npm run build` from `frontend`. Inspect `/admin/studio` at desktop and narrow widths and confirm there is no horizontal overflow, field labels remain visible, optional fields are understandable, and all controls remain keyboard reachable.
