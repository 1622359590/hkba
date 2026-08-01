# Board Member Selection

## Goal

Allow editors to choose and order the exact people rendered by an `association.board` block while preserving the existing automatic role and limit behavior.

## Data Model

- Add `selectedMemberIds` to `association.board` settings as an ordered array of member IDs.
- When the array contains valid IDs, render those people in the stored order.
- When the array is empty, retain the current role filter and limit behavior.
- Missing or inactive member IDs are ignored without breaking the page.

## Studio UI

- Show a searchable-style member list (all active structured team members) in the board property panel.
- Each row has a checkbox, avatar/name context, and selected rows have move-up/move-down controls.
- Explain that an empty selection enables automatic mode.
- The existing display limit remains part of automatic mode only.

## Verification

- Unit-test explicit selection order and automatic fallback.
- Verify the property panel receives association member data.
- Run the frontend build and inspect the Studio interaction in the browser.

