# Studio Rich Text and Focus Design

## Goal

Make the Studio property drawer usable by non-technical editors:

- typing must never move focus to the drawer close button;
- rich-text content must be edited visually instead of as raw HTML;
- existing stored HTML and public rendering must remain compatible.

## Focus Behavior

`Drawer` will focus its close button only when the drawer transitions from closed to open. Re-renders caused by field edits must not repeat this focus action. The latest `onClose` callback will be held in a ref so Escape handling remains current without restarting the focus effect.

Expected behavior:

- opening a drawer places focus on its close button once;
- clicking or tabbing into a field keeps focus there while typing;
- Escape still closes the current drawer;
- reopening the drawer restores the initial focus behavior.

## Visual Rich-Text Editor

The `content.rich-text` component's `html` field will use a dedicated visual editor in `PropertyForm`. Other long string fields continue using the existing textarea.

The editor will provide a compact toolbar for:

- paragraph;
- heading levels 2, 3, and 4;
- bold and italic;
- bulleted and numbered lists;
- links;
- undo and redo.

The editable surface will render formatted content through `contenteditable`. It will emit sanitized HTML-compatible markup through the existing `onChange` path, so the API, database schema, bilingual editing, preview, and public `BlockRenderer` remain unchanged. Raw HTML will not be shown in the default editing experience.

## Data Synchronization

The editor receives the current HTML value from the selected block. It updates its DOM only when an external value changes, not on every local keystroke, preserving the caret and selection. User input emits the editor's HTML immediately to the Studio's existing debounced persistence flow.

Empty visual content emits an empty string. Existing headings, paragraphs, lists, emphasis, and links load as formatted content without conversion loss.

## Safety and Accessibility

- Toolbar buttons use semantic button elements and descriptive labels.
- The editor surface is keyboard focusable and labelled.
- Link creation rejects unsafe protocols and blank URLs.
- Pasted content is normalized to the supported formatting set before persistence.
- Existing backend validation and public HTML sanitization remain authoritative.

## Testing

Automated tests will cover:

- drawer focus occurs only on the open transition;
- drawer rerenders do not steal field focus;
- rich-text fields select the visual editor while ordinary strings retain existing inputs;
- HTML normalization preserves supported markup and removes unsupported or unsafe markup;
- frontend production build succeeds.

Manual browser verification will cover typing multiple Chinese characters continuously, toolbar formatting, switching languages, closing with Escape, and previewing the formatted result.

## Scope

No API, database, public renderer, bilingual model, page schema, or Studio canvas behavior will change. This work is limited to the reusable drawer focus mechanism and the Studio rich-text property control.
