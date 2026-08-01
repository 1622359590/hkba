const CYCLE_MS = 3400;

export function heroWordmarkPresentation(text = 'HKBA') {
  return {
    cycleMs: CYCLE_MS,
    scan: {
      bandEdgePct: 4,
      corePct: 1.5,
      beamPx: 1,
      glowPx: 3,
    },
    layers: [
      { kind: 'base', className: 'hero-wordmark__base', text, ariaHidden: false },
      { kind: 'light', className: 'hero-wordmark__light', text, ariaHidden: true },
      { kind: 'texture', className: 'hero-wordmark__texture', text, ariaHidden: true },
    ],
  };
}
