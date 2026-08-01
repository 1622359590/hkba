import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/blocks.css', import.meta.url), 'utf8');
const aboutPage = readFileSync(new URL('../components/pages/AboutPageClient.tsx', import.meta.url), 'utf8');

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1] || '';
}

test('partner carousel uses one shared white strip instead of grey item cards', () => {
  const stripRule = css.match(/\.hk-partner-carousel\s*\{([^}]*)\}/s)?.[1] || '';
  assert.match(stripRule, /background:\s*#f7f8fa;/);
  assert.match(stripRule, /border-radius:\s*12px;/);
  assert.match(css, /\.hk-partner-carousel \.hk-partner__tile\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
  assert.match(css, /\.hk-partner-carousel::before[\s\S]*#f7f8fa/);
});

test('final carousel link rules override the later shared-card cascade', () => {
  const sharedCardRules = css.indexOf('/* Shared public card language */');
  const outerSelector = ':is(.public-main, .hk-canvas) .hk-partner-carousel .hk-partner';
  const hoverSelector = ':is(.public-main, .hk-canvas) .hk-partner-carousel .hk-partner:hover';
  const highlightSelector = ':is(.public-main, .hk-canvas) .hk-partner-carousel .hk-partner::before';

  assert.ok(css.lastIndexOf(outerSelector) > sharedCardRules);
  assert.match(ruleBody(outerSelector), /border:\s*0;/);
  assert.match(ruleBody(outerSelector), /border-radius:\s*0;/);
  assert.match(ruleBody(outerSelector), /background:\s*transparent;/);
  assert.match(ruleBody(outerSelector), /box-shadow:\s*none;/);
  assert.match(ruleBody(outerSelector), /transform:\s*none;/);
  assert.match(ruleBody(hoverSelector), /transform:\s*none;/);
  assert.match(ruleBody(highlightSelector), /content:\s*none;/);
  assert.match(ruleBody(highlightSelector), /display:\s*none;/);
});

test('carousel viewport focus is drawn inside the clipped white strip', () => {
  const focusRule = ruleBody('.hk-partner-carousel .partner-carousel__viewport:focus-visible');
  assert.match(focusRule, /outline:\s*0;/);
  assert.match(focusRule, /box-shadow:\s*inset\s+0\s+0\s+0\s+2px/);
});

test('legacy About fallback uses the same white strip and cardless partner tiles', () => {
  assert.match(aboutPage, /className="hk-partner-carousel about-partner-carousel"/);
  assert.match(aboutPage, /className="hk-partner"/);
  assert.match(aboutPage, /className="hk-partner__tile"/);
  assert.doesNotMatch(aboutPage, /member-logo-card/);
});
