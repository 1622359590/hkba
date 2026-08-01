# Partner Logo Wall Simplification

## Goal

Replace the current nested-card presentation with a quiet, professional logo wall. Partner artwork remains the visual focus and logos with transparent, light, or dark pixels remain readable.

## Scope

- Apply to the CMS-rendered association partner block used on public pages.
- Preserve partner order, links, carousel behavior, responsive behavior, source images, and accessible alt text.
- Remove visible partner names from the logo-wall and carousel variants.
- Keep website text available only in the explicit `cards` variant, where additional partner detail is intentional.
- Do not change association data, page content, routes, navigation, or other card components.

## Visual Direction

The page remains dark and institutional. Each logo sits on one restrained, softly bright neutral surface. There is no outer card, nested frame, metallic gradient, heavy shadow, or individual per-brand treatment.

Desktop spacing should allow six to seven marks across the available content width. Logo artwork uses a consistent maximum height while retaining its natural width and aspect ratio. The surface has a small radius matching the existing page system. Hover only adjusts border and surface brightness; it does not translate or scale.

## Component Behavior

- `LogoTile` continues to own image loading and fallback initials.
- `AssocPartners` renders the logo tile as the only visible content for `logo-wall` and `carousel` variants.
- The partner link continues to wrap the logo and keeps its accessible name.
- Failed or missing images show a subdued initial on the same neutral surface.

## Responsive Behavior

- Grid layouts use fewer columns as the viewport narrows without shrinking logos below a legible size.
- Carousel item width remains stable enough for logo recognition and horizontal movement remains unchanged.
- Touch and keyboard focus states remain visible.

## Verification

- Check representative white, black, transparent, yellow, and purple logos in the browser.
- Confirm no visible company-name labels remain in logo-wall and carousel variants.
- Confirm links, keyboard focus, fallback initials, grid wrapping, and carousel behavior still work.
- Run the frontend production build.
