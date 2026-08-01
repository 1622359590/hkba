/**
 * Switch pages inside the studio without asking Next.js to navigate the
 * entire route. Hash navigation remains shareable and survives a refresh,
 * but does not make Next.js fetch the current route again.
 */
export function selectStudioPage(pageId, setPageId, location) {
  setPageId(pageId);
  location.hash = `page=${encodeURIComponent(pageId)}`;
}
