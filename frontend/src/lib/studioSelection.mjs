/**
 * Keep every studio selection entry point consistent: selecting content
 * should immediately reveal the form that edits it.
 */
export function selectStudioBlock(blockId, setSelectedId, setRightPane) {
  setSelectedId(blockId);
  setRightPane('props');
}
