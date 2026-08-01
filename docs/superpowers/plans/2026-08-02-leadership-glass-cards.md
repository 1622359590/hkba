# Leadership Glass Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tiered leadership profile cards with prestigious static glass materials and one subtle, pointer-reactive WebGL fluid layer mounted only on the active card.

**Architecture:** A pure helper resolves every role into one of three visual tiers and exposes shader parameters. A focused client leaf owns the React Three Fiber canvas and procedural fragment shader. `AssocPeople` owns the active profile id, while each board card updates pointer coordinates through refs so no continuous pointer data enters React state.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, CSS, React Three Fiber 9.7, Three.js 0.185, Node `node:test`; no new dependencies.

## Global Constraints

- Apply only to public CMS-rendered `association.board` cards.
- Preserve profile content, order, links, portraits, alt text, and administration data.
- Honorary Chairman is the prestige tier; leadership roles are the middle tier; professional and unknown roles use the quiet fallback tier.
- At most one WebGL canvas may exist in a board at one time.
- Pointer coordinates must update through refs, not React state.
- No card rotation, perspective tilt, scale animation, neon outer glow, textures, or post-processing.
- Mobile, coarse-pointer devices, and `prefers-reduced-motion: reduce` receive complete static glass cards with no WebGL canvas.

---

## File Structure

- Create `frontend/src/lib/leadershipCardTiers.mjs`: pure role-to-tier and tier-parameter resolver.
- Create `frontend/src/lib/leadershipCardTiers.test.mjs`: tier and fallback contract tests.
- Create `frontend/src/components/webgl/LeadershipFluidLayer.tsx`: lazy, full-card React Three Fiber shader layer.
- Create `frontend/src/components/ui/LeadershipGlassCard.tsx`: pointer-ref adapter and active-card wrapper.
- Modify `frontend/src/components/blocks/BlockRenderer.tsx`: use one active profile id and render tiered board cards.
- Modify `frontend/src/styles/blocks.css`: static tier materials, hierarchy, focus, reduced-motion, and mobile rules.

---

### Task 1: Define and test role hierarchy

**Files:**
- Create: `frontend/src/lib/leadershipCardTiers.mjs`
- Test: `frontend/src/lib/leadershipCardTiers.test.mjs`

**Interfaces:**
- Consumes: `role: unknown`.
- Produces: `resolveLeadershipCardTier(role): 'prestige' | 'leadership' | 'professional'`.
- Produces: `leadershipTierConfig(tier)` with `primary`, `secondary`, `intensity`, `speed`, and `distortion`.

- [ ] **Step 1: Write the failing hierarchy tests**

Create `frontend/src/lib/leadershipCardTiers.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leadershipTierConfig,
  resolveLeadershipCardTier,
} from './leadershipCardTiers.mjs';

test('leadership roles resolve into three deliberate tiers', () => {
  assert.equal(resolveLeadershipCardTier('honorary_chairman'), 'prestige');
  for (const role of ['co_chairman', 'chairman', 'vice_chairman']) {
    assert.equal(resolveLeadershipCardTier(role), 'leadership');
  }
  for (const role of ['industry_expert', 'advisor', 'ambassador', 'secretary_general', 'committee']) {
    assert.equal(resolveLeadershipCardTier(role), 'professional');
  }
});

test('unknown and malformed roles use the quiet professional fallback', () => {
  assert.equal(resolveLeadershipCardTier('future_role'), 'professional');
  assert.equal(resolveLeadershipCardTier(undefined), 'professional');
  assert.equal(resolveLeadershipCardTier(null), 'professional');
});

test('tier shader strength descends with role hierarchy', () => {
  const prestige = leadershipTierConfig('prestige');
  const leadership = leadershipTierConfig('leadership');
  const professional = leadershipTierConfig('professional');
  assert.ok(prestige.intensity > leadership.intensity);
  assert.ok(leadership.intensity > professional.intensity);
  assert.ok(prestige.distortion > leadership.distortion);
  assert.ok(leadership.distortion > professional.distortion);
  assert.equal(leadershipTierConfig('unknown'), professional);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `cd frontend && node --test src/lib/leadershipCardTiers.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the hierarchy resolver**

Create `frontend/src/lib/leadershipCardTiers.mjs`:

```js
const ROLE_TIERS = Object.freeze({
  honorary_chairman: 'prestige',
  co_chairman: 'leadership',
  chairman: 'leadership',
  vice_chairman: 'leadership',
  industry_expert: 'professional',
  advisor: 'professional',
  ambassador: 'professional',
  secretary_general: 'professional',
  committee: 'professional',
});

const TIER_CONFIG = Object.freeze({
  prestige: Object.freeze({
    primary: '#d7e4f5',
    secondary: '#d7b96f',
    intensity: 0.34,
    speed: 0.18,
    distortion: 0.32,
  }),
  leadership: Object.freeze({
    primary: '#60a5fa',
    secondary: '#67e8f9',
    intensity: 0.21,
    speed: 0.14,
    distortion: 0.22,
  }),
  professional: Object.freeze({
    primary: '#7189aa',
    secondary: '#7dd3fc',
    intensity: 0.12,
    speed: 0.1,
    distortion: 0.13,
  }),
});

export function resolveLeadershipCardTier(role) {
  return typeof role === 'string' && Object.hasOwn(ROLE_TIERS, role)
    ? ROLE_TIERS[role]
    : 'professional';
}

export function leadershipTierConfig(tier) {
  return Object.hasOwn(TIER_CONFIG, tier)
    ? TIER_CONFIG[tier]
    : TIER_CONFIG.professional;
}
```

- [ ] **Step 4: Run the hierarchy tests**

Run: `cd frontend && node --test src/lib/leadershipCardTiers.test.mjs`

Expected: 3 tests PASS.

---

### Task 2: Build the on-demand WebGL fluid layer

**Files:**
- Create: `frontend/src/components/webgl/LeadershipFluidLayer.tsx`

**Interfaces:**
- Consumes: `tier`, `pointerRef`, and `active`.
- Produces: one decorative full-card canvas with class `leadership-fluid-layer` and `aria-hidden="true"`.
- Depends on: `leadershipTierConfig(tier)` from Task 1.

- [ ] **Step 1: Create the isolated shader component**

Create `frontend/src/components/webgl/LeadershipFluidLayer.tsx` with:

```tsx
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { leadershipTierConfig } from '@/lib/leadershipCardTiers.mjs';

type Tier = 'prestige' | 'leadership' | 'professional';
type Pointer = { x: number; y: number };

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform float uDistortion;

  float wave(vec2 p, float t) {
    float a = sin((p.x * 5.2 + p.y * 2.1) + t * 1.3);
    float b = sin((p.y * 6.1 - p.x * 1.7) - t * 0.9);
    float c = sin(length(p - uPointer) * 13.0 - t * 1.6);
    return (a + b + c) / 3.0;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * uSpeed;
    float field = wave(uv + vec2(sin(t) * 0.05, cos(t) * 0.04), t);
    vec2 warped = uv + vec2(field, -field) * uDistortion * 0.12;
    float pointerLight = 1.0 - smoothstep(0.08, 0.72, distance(warped, uPointer));
    float ribbon = smoothstep(0.18, 0.92, field * 0.5 + 0.5);
    vec3 color = mix(uPrimary, uSecondary, clamp(ribbon + pointerLight * 0.28, 0.0, 1.0));
    float edge = 1.0 - smoothstep(0.18, 0.8, distance(uv, vec2(0.5)));
    float alpha = (ribbon * 0.36 + pointerLight * 0.52) * uIntensity * edge;
    gl_FragColor = vec4(color, alpha);
  }
`;

function FluidPlane({ tier, pointerRef }: { tier: Tier; pointerRef: MutableRefObject<Pointer> }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const config = leadershipTierConfig(tier);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uPrimary: { value: new THREE.Color(config.primary) },
    uSecondary: { value: new THREE.Color(config.secondary) },
    uIntensity: { value: config.intensity },
    uSpeed: { value: config.speed },
    uDistortion: { value: config.distortion },
  }), [config]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    material.uniforms.uTime.value = clock.getElapsedTime();
    material.uniforms.uPointer.value.set(pointerRef.current.x, pointerRef.current.y);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} transparent depthWrite={false} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} />
    </mesh>
  );
}

export default function LeadershipFluidLayer({ tier, pointerRef, active }: { tier: Tier; pointerRef: MutableRefObject<Pointer>; active: boolean }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setEnabled(!coarse.matches && !reduced.matches);
    sync();
    coarse.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    return () => {
      coarse.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
    };
  }, []);

  if (!active || !enabled) return null;

  return (
    <div className="leadership-fluid-layer" aria-hidden="true">
      <Canvas orthographic camera={{ position: [0, 0, 1], zoom: 1 }} dpr={[1, 1.25]} gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}>
        <FluidPlane tier={tier} pointerRef={pointerRef} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript validation**

Run: `cd frontend && npx tsc --noEmit`

Expected: exit code 0 with no TypeScript errors.

---

### Task 3: Integrate one active fluid card and tiered materials

**Files:**
- Create: `frontend/src/components/ui/LeadershipGlassCard.tsx`
- Modify: `frontend/src/components/blocks/BlockRenderer.tsx:9-20,397-454`
- Modify: `frontend/src/styles/blocks.css:255-290,432-460,540-550`

**Interfaces:**
- Consumes: `personId`, `role`, `activePersonId`, `setActivePersonId`, and profile content.
- Produces: `.hk-person--board`, `.hk-person--prestige`, `.hk-person--leadership`, or `.hk-person--professional`.
- Depends on: Task 1 tier resolver and Task 2 fluid layer.

- [ ] **Step 1: Create the pointer-ref card wrapper**

Create `frontend/src/components/ui/LeadershipGlassCard.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useRef, type Dispatch, type PointerEvent, type ReactNode, type SetStateAction } from 'react';
import { resolveLeadershipCardTier } from '@/lib/leadershipCardTiers.mjs';

const LeadershipFluidLayer = dynamic(() => import('@/components/webgl/LeadershipFluidLayer'), { ssr: false });

export default function LeadershipGlassCard({ personId, role, activePersonId, setActivePersonId, children }: {
  personId: number;
  role: string;
  activePersonId: number | null;
  setActivePersonId: Dispatch<SetStateAction<number | null>>;
  children: ReactNode;
}) {
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const tier = resolveLeadershipCardTier(role);
  const active = activePersonId === personId;

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current.x = (event.clientX - rect.left) / rect.width;
    pointerRef.current.y = 1 - ((event.clientY - rect.top) / rect.height);
  };

  return (
    <article
      className={`hk-person hk-person--board hk-person--${tier}`}
      onPointerEnter={() => setActivePersonId(personId)}
      onPointerMove={move}
      onPointerLeave={() => setActivePersonId((current) => current === personId ? null : current)}
      data-leadership-tier={tier}
      data-leadership-role={role}
    >
      <LeadershipFluidLayer tier={tier} pointerRef={pointerRef} active={active} />
      <div className="hk-person__content">{children}</div>
    </article>
  );
}
```

- [ ] **Step 2: Connect active-card ownership in `AssocPeople`**

Add `const [activePersonId, setActivePersonId] = useState<number | null>(null);` inside `AssocPeople`. For board cards, replace the outer generic `div` with `LeadershipGlassCard`, passing `person.id`, `person.group`, and the shared active state. Keep compact member cards on the existing `.hk-person.hk-person--compact` path.

- [ ] **Step 3: Add tiered static glass CSS**

Add scoped styles that override the generic public-card rule:

```css
.hk-person--board {
  --role-accent: 113 137 170;
  position: relative;
  isolation: isolate;
  min-height: 210px;
  overflow: hidden;
  border-radius: 16px;
  backdrop-filter: blur(18px) saturate(125%);
  -webkit-backdrop-filter: blur(18px) saturate(125%);
  transition: transform 240ms var(--ease-expo), border-color 240ms ease, box-shadow 400ms ease;
}
.hk-person--board::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(70% 90% at 32% 0%, rgb(var(--role-accent) / 0.16), transparent 68%);
  opacity: 0;
  transition: opacity 500ms ease;
}
.hk-person--board:hover::after { opacity: 1; transition-duration: 250ms; }
.hk-person--board::before {
  left: 10%;
  width: 80%;
  opacity: 0.42;
  box-shadow: none;
}
.hk-person--prestige {
  border-color: rgba(215,228,245,0.34);
  background: linear-gradient(145deg, rgba(28,39,57,0.86), rgba(7,14,27,0.94));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(215,185,111,0.12), 0 18px 46px rgba(1,8,20,0.28);
}
.hk-person--leadership {
  border-color: rgba(96,165,250,0.3);
  background: linear-gradient(145deg, rgba(17,38,75,0.84), rgba(7,17,35,0.94));
  box-shadow: inset 0 1px 0 rgba(147,197,253,0.12), 0 14px 34px rgba(1,10,28,0.22);
}
.hk-person--professional {
  border-color: rgba(113,137,170,0.24);
  background: linear-gradient(145deg, rgba(22,34,52,0.86), rgba(9,18,32,0.94));
  box-shadow: inset 0 1px 0 rgba(203,213,225,0.08), 0 10px 26px rgba(1,8,20,0.18);
}
.hk-person--board[data-leadership-role="honorary_chairman"] { --role-accent: 215 185 111; }
.hk-person--board[data-leadership-role="co_chairman"] { --role-accent: 125 170 228; }
.hk-person--board[data-leadership-role="chairman"] { --role-accent: 96 165 250; }
.hk-person--board[data-leadership-role="vice_chairman"] { --role-accent: 103 232 249; }
.hk-person--board[data-leadership-role="industry_expert"] { --role-accent: 110 190 205; }
.hk-person--board[data-leadership-role="ambassador"] { --role-accent: 92 145 220; }
.hk-person--board[data-leadership-role="secretary_general"] { --role-accent: 160 174 192; }
.hk-person--board[data-leadership-role="honorary_chairman"]::before { width: 82%; left: 9%; background: linear-gradient(90deg, transparent, rgba(215,228,245,0.72), rgba(215,185,111,0.64), transparent); }
.hk-person--board[data-leadership-role="vice_chairman"]::before { width: 48%; left: 8%; }
.hk-person--board[data-leadership-role="ambassador"] .hk-person__avatar--large { border-color: rgb(var(--role-accent) / 0.5); }
.hk-person--board[data-leadership-role="secretary_general"] .hk-person__badge { border-style: double; }
.hk-person--board:hover { transform: translateY(-2px); }
.hk-person--board:focus-within { outline: 2px solid rgba(103,232,249,0.62); outline-offset: 3px; }
.hk-person__content { position: relative; z-index: 3; }
.hk-person--prestige .hk-person__avatar--large { width: 78px; height: 78px; }
.hk-person--prestige .hk-person__name { font-size: 21px; font-weight: 760; }
.leadership-fluid-layer { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0; animation: leadership-fluid-in 250ms ease forwards; }
@keyframes leadership-fluid-in { to { opacity: 1; } }
@media (max-width: 768px), (pointer: coarse), (prefers-reduced-motion: reduce) {
  .leadership-fluid-layer { display: none; }
  .hk-person--board { transition: border-color 180ms ease; }
  .hk-person--board:hover { transform: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .hk-person--board { backdrop-filter: none; -webkit-backdrop-filter: none; }
}
```

Ensure the generic shared-card selector does not overwrite these tier values. Use later source order or a more specific `.public-main .hk-person--board` selector if required.

- [ ] **Step 4: Run tests and type validation**

Run: `cd frontend && node --test src/lib/leadershipCardTiers.test.mjs src/lib/partnerCarousel.test.mjs && npx tsc --noEmit`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 5: Run the production build**

Run: `cd frontend && npm run build`

Expected: Next.js production build exits 0. If an existing dev server owns `.next`, build an exact temporary source copy without stopping the user's server.

- [ ] **Step 6: Verify interaction and hierarchy in the browser**

Open `/members` and inspect at desktop and mobile widths:

- Prestige cards read as cold silver-black and remain more prominent than every other tier.
- Leadership cards use quieter blue-cyan refraction.
- Professional cards use restrained smoke-blue material.
- Hovering one card creates exactly one `.leadership-fluid-layer canvas`.
- Moving directly to another card keeps the canvas count at one.
- Leaving the grid returns the canvas count to zero.
- The fluid highlight follows the pointer without React-driven layout updates.
- Mobile and reduced-motion checks show no canvas and retain complete card styling.
- Portraits, names, titles, biographies, and social links remain readable and unchanged.

- [ ] **Step 7: Review the scoped diff**

Run:

```bash
git diff --check -- \
  frontend/src/lib/leadershipCardTiers.mjs \
  frontend/src/lib/leadershipCardTiers.test.mjs \
  frontend/src/components/webgl/LeadershipFluidLayer.tsx \
  frontend/src/components/ui/LeadershipGlassCard.tsx \
  frontend/src/components/blocks/BlockRenderer.tsx \
  frontend/src/styles/blocks.css
```

Expected: only the approved tiered leadership-card presentation and interaction are added.
