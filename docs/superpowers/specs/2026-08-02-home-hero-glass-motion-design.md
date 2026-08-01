# HKBA Home Hero Glass Motion Design

## Scope

Upgrade only the public homepage hero. Do not alter the admin shell, studio canvas, block renderer contracts, public content API, or other public pages.

## Visual Direction

Use a restrained dark-glass treatment for the hero content area:

- A translucent navy panel over the existing Hong Kong technology image.
- Fine cyan-blue edge highlights with a soft top-edge glow.
- Background blur and saturation that preserve image detail without making text difficult to read.
- Subtle grid texture and a low-opacity scanning highlight contained inside the panel.
- Square-to-soft corners consistent with the existing site system; no oversized rounded card treatment.

The panel must remain visually integrated with the full-width hero rather than appearing as a floating modal.

## Motion

The entrance sequence runs once after the homepage is ready:

1. The glass panel fades in and moves upward by a small distance.
2. The title, subtitle, divider, actions, and statistics enter in a short stagger.
3. Statistics count from zero to their displayed values while preserving suffixes such as `+`.
4. A faint scanning highlight crosses the panel slowly and repeats with a long pause.

Pointer movement may shift the internal highlight by a few pixels. It must not rotate or visibly tilt the panel. Buttons retain their existing hover translation and arrow response.

## Performance And Accessibility

- Implement presentation with CSS transforms, opacity, pseudo-elements, and the existing React structure.
- Do not add a WebGL canvas or another animation dependency for this change.
- Use one small client-side counter component for statistic animation.
- Disable pointer-reactive effects on coarse pointers.
- Under `prefers-reduced-motion: reduce`, remove scanning, staggering, parallax, and counting animation; render final values immediately.
- Keep all controls at least 44px high.

## Responsive Behavior

- Desktop: the glass panel occupies the left content zone while the image remains visible on the right.
- Tablet: reduce blur, padding, and statistic gaps while retaining the glass treatment.
- Mobile: use a single-column content panel, remove pointer response and scanning, and keep statistics readable without horizontal overflow.

## Verification

- Run the frontend production build.
- Inspect the homepage at desktop and mobile widths.
- Confirm there is no horizontal overflow, clipped text, layout shift, or overlap with the header.
- Confirm reduced-motion mode displays stable final content.
