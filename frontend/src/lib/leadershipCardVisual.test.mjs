import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/blocks.css', import.meta.url), 'utf8');

test('honorary chairman hover preserves the champagne ceremonial edge', () => {
  assert.match(
    css,
    /data-leadership-role="honorary_chairman"\]:(?:hover|focus-visible)[^{]*\{[^}]*border-color:\s*color-mix\(in srgb, var\(--role-secondary\)/s,
  );
});

test('honorary chairman names inherit the champagne role color', () => {
  assert.match(
    css,
    /data-leadership-role="honorary_chairman"\][^{]*\.hk-person__name\s*\{[^}]*var\(--role-secondary\)/s,
  );
});

test('board portraits have the approved stronger visual scale', () => {
  assert.match(css, /\.hk-person--board \.hk-person__avatar--large\s*\{[^}]*width:\s*92px;[^}]*height:\s*92px;/s);
});

test('leadership card interactions never scale or tilt the card', () => {
  const section = css.slice(css.indexOf('/* Leadership directory:'), css.indexOf('.hk-news-cards'));
  assert.doesNotMatch(section, /scale\(|rotate[XYZ]?\(|perspective\(/);
});
