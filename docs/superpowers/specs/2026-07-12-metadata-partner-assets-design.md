# HKBA Metadata and Partner Assets Design

## Goal

Make the browser identity and homepage partner section feel complete and institutional. The browser tab must always show the association name, while every partner logo must remain legible, correctly scaled, and visually balanced across desktop and mobile.

## Site Metadata

- Use `香港區塊鏈協會 HKBA | Hong Kong Blockchain Association` as the default site title.
- Add a title template so interior pages produce useful titles without replacing the association identity.
- Keep a bilingual association description and add application, Open Graph, and Twitter metadata.
- Provide a committed local favicon rather than relying on a browser fallback.
- Keep metadata server-rendered so the title exists before client JavaScript runs.

## Partner Assets

- Store partner logos locally under `frontend/public/partners` so the homepage does not depend on third-party hotlinks.
- Preserve each organization logo's original colors and aspect ratio.
- Use a stable logo viewport with consistent optical padding; logos use `object-fit: contain` and never crop or stretch.
- Replace the current bright gradient tiles with restrained neutral logo surfaces that fit the existing dark institutional design.
- Keep the organization name available through `alt`, `title`, and accessible link labeling.
- Preserve the existing destination behavior: external website when configured, otherwise the member directory.
- Fall back to the current API image URL if a local curated asset is unavailable.

## Responsive And Interaction

- Use a responsive grid instead of manually centered rows, with stable column widths and no orphaned narrow tile.
- Provide concise hover, active, and keyboard-focus states without changing layout dimensions.
- Respect reduced-motion settings.

## Verification

- Build the Next.js frontend and confirm the root HTML contains the approved title and icon metadata.
- Check all eleven partner logos for successful loading, preserved aspect ratio, and meaningful accessible text.
- Browser-check the homepage at desktop and mobile widths.
- After deployment, verify the live title, favicon response, partner image responses, and homepage rendering.
