import test from 'node:test';
import assert from 'node:assert/strict';
import { heroWordmarkPresentation } from './heroWordmark.mjs';

test('hero wordmark exposes one accessible label and hides decorative scan layers', () => {
  const presentation = heroWordmarkPresentation('HKBA');

  assert.equal(presentation.cycleMs, 3400);
  assert.deepEqual(presentation.layers, [
    { kind: 'base', className: 'hero-wordmark__base', text: 'HKBA', ariaHidden: false },
    { kind: 'light', className: 'hero-wordmark__light', text: 'HKBA', ariaHidden: true },
    { kind: 'texture', className: 'hero-wordmark__texture', text: 'HKBA', ariaHidden: true },
  ]);
  assert.equal(presentation.layers.filter((layer) => !layer.ariaHidden).length, 1);
});

test('hero wordmark keeps the scan beam and internal highlight narrow', () => {
  const presentation = heroWordmarkPresentation('HKBA');

  assert.deepEqual(presentation.scan, {
    bandEdgePct: 4,
    corePct: 1.5,
    beamPx: 1,
    glowPx: 3,
  });
});
