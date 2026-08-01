# Leadership Glass Cards Design

## Goal

Turn leadership profiles into a tiered digital business-card system. Every role receives a distinct presentation, while Honorary Chairman cards carry the most prestigious material and motion treatment.

## Scope

- Apply to public CMS-rendered `association.board` profile cards.
- Preserve names, titles, biographies, portraits, social links, ordering, content, routes, and administration data.
- Do not alter compact member lists, partner cards, news cards, or other generic card components.
- Keep the existing dark institutional page theme and blue-cyan brand language.

## Role Hierarchy

### Prestige Tier

Roles: `honorary_chairman`.

Material: cold silver-black glass with a restrained champagne refraction, fine metallic edge, strongest inner depth, larger portrait, and stronger name hierarchy.

Motion: the clearest fluid refraction in the system, still subtle enough for an institutional site.

### Leadership Tier

Roles: `co_chairman`, `chairman`, and `vice_chairman`.

Material: deep cobalt glass with cyan-blue edge refraction. Contrast and fluid brightness are approximately sixty percent of the prestige tier.

Motion: a narrower and slower blue-cyan fluid highlight.

### Professional Tier

Roles: `industry_expert`, `advisor`, `ambassador`, `secretary_general`, `committee`, and unknown role values.

Material: smoke-blue glass. Role families use restrained edge accents while sharing the same structural system.

Motion: a localized low-opacity sheen with the smallest travel radius.

## Card Composition

- Keep one consistent soft radius across every tier.
- Place the portrait and identity block at the top, followed by title and biography.
- Prestige cards receive a modestly larger portrait and stronger name weight, not a different information architecture.
- Role labels remain compact and readable. They do not become decorative metallic badges.
- Glass uses backdrop blur, a fine inner refraction line, and background-tinted shadows. There is no neon outer glow.

## WebGL Interaction

- A dedicated client leaf renders the fluid layer with React Three Fiber and a small fragment shader.
- The board owns the active profile id. Only the active card mounts the WebGL layer, so at most one canvas runs at any time.
- Pointer coordinates update shader uniforms through refs and do not pass through React state on every frame.
- Hover activation fades in over approximately 250ms. The fluid field moves slowly toward the pointer and fades out over approximately 500ms.
- The card may translate upward by at most 2px. It does not tilt, rotate, scale, or emit a large outer glow.
- The shader palette, opacity, flow speed, and distortion strength come from the resolved role tier.

## Performance and Accessibility

- Do not mount a canvas for every profile.
- Stop and unmount the fluid layer when the pointer leaves the active card.
- Cap device pixel ratio and use a small full-card plane with no textures or post-processing.
- Disable WebGL on coarse pointers, touch-first devices, and `prefers-reduced-motion: reduce`.
- Static glass remains complete and readable when WebGL is unavailable or disabled.
- Keyboard focus receives the same tier-appropriate border emphasis without automatic animation.
- Preserve text contrast, portrait alt text, social-link labels, and current keyboard navigation.

## Mobile Behavior

- Cards collapse using the existing responsive grid.
- Mobile renders static tiered glass only.
- Prestige hierarchy remains visible through material, border, portrait scale, and typography rather than motion.

## Testing and Verification

- Unit-test role-to-tier mapping, unknown-role fallback, and tier parameter selection.
- Verify that only board cards receive the enhanced treatment.
- Verify that no more than one WebGL canvas exists while moving between cards.
- Verify static fallback under reduced motion and coarse pointer conditions.
- Inspect representative cards from every tier at desktop and mobile widths.
- Run the full frontend test set and production build.
