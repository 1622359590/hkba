# Partner Logo Marquee Simplification

## Goal

Replace the current separate grey logo cards with one continuous white partner marquee. Partner artwork remains the visual focus, and the motion is obvious enough to be noticed without becoming distracting.

## Scope

- Apply to the CMS-rendered association partner block used on public pages.
- Preserve partner order, links, responsive behavior, source images, and accessible alt text.
- Keep the existing CMS autoplay, speed, direction, and pause-on-hover settings.
- Remove visible partner names from the logo-wall and carousel variants.
- Keep website text available only in the explicit `cards` variant, where additional partner detail is intentional.
- Do not change association data, page content, routes, navigation, or other card components.

## Visual Direction

The page remains dark and institutional. The complete carousel sits inside a single soft-white strip aligned to the normal content width. The strip uses the page's existing 12px radius, a restrained border, and no heavy shadow. Individual partners have no grey card, border, nested frame, metallic gradient, or per-brand treatment.

Desktop spacing should allow six to seven marks across the available content width. Logo artwork uses a consistent maximum height while retaining its natural width and aspect ratio. Logos are vertically centered with generous horizontal spacing. The marquee edges use subtle white fades so the loop enters and exits naturally.

## Component Behavior

- `LogoTile` continues to own image loading and fallback initials, but the carousel variant presents it without an individual tile surface.
- `AssocPartners` renders the logo tile as the only visible content for `logo-wall` and `carousel` variants.
- The partner link continues to wrap the logo and keeps its accessible name.
- Failed or missing images show a subdued initial directly on the marquee strip.
- Autoplay remains continuous and slow. Hover, focus, dragging, touch interaction, and reduced-motion preferences pause it according to the existing behavior contract.

## Responsive Behavior

- Grid layouts use fewer columns as the viewport narrows without shrinking logos below a legible size.
- Carousel item width remains stable enough for logo recognition, while the white strip reduces its padding and radius on small screens.
- Touch and keyboard focus states remain visible.

## Verification

- Check representative white, black, transparent, yellow, and purple logos in the browser against the shared white strip.
- Confirm no visible company-name labels remain in logo-wall and carousel variants.
- Measure `scrollLeft` over time on the real public page to prove autoplay is advancing.
- Confirm links, keyboard focus, hover pause, pointer dragging, fallback initials, grid wrapping, and seamless wrapping still work.
- Run the frontend production build.
