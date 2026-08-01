import test from 'node:test';
import assert from 'node:assert/strict';
import * as partnerCarousel from './partnerCarousel.mjs';
import {
  advancePartnerCarouselPosition,
  partnerCarouselDelta,
  partnerCarouselPixelsPerSecond,
  observePartnerCarouselPageVisibility,
  partnerShowsDetails,
  resolvePartnerCarouselOptions,
  shouldPartnerCarouselAnimate,
  shouldPartnerCarouselPauseForFocus,
  wrapPartnerCarouselScroll,
} from './partnerCarousel.mjs';

test('partner carousel preserves subpixel movement on high-refresh displays', () => {
  let position = 0;
  for (let frame = 0; frame < 144; frame += 1) {
    position = advancePartnerCarouselPosition({
      position,
      elapsedMs: 1000 / 144,
      pixelsPerSecond: 28,
      direction: 'left',
      cycleWidth: 1000,
    });
  }

  assert.ok(Math.abs(position - 28) < 0.000001);
});

test('partner carousel keeps playing while the page is visible even if the window loses focus', () => {
  const documentTarget = new EventTarget();
  documentTarget.visibilityState = 'visible';
  const states = [];

  const stopObserving = observePartnerCarouselPageVisibility(documentTarget, (visible) => states.push(visible));
  documentTarget.dispatchEvent(new Event('blur'));
  assert.deepEqual(states, [true]);
  documentTarget.visibilityState = 'hidden';
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  stopObserving();

  assert.deepEqual(states, [true, false]);
});

test('partner details are visible only in the explicit cards variant', () => {
  assert.equal(partnerShowsDetails('cards'), true);
  assert.equal(partnerShowsDetails('logo-wall'), false);
  assert.equal(partnerShowsDetails('carousel'), false);
  assert.equal(partnerShowsDetails(undefined), false);
});

test('partner carousel settings use safe defaults and reject invalid values', () => {
  assert.deepEqual(resolvePartnerCarouselOptions({}), {
    autoPlay: true,
    speed: 'slow',
    direction: 'left',
    pauseOnHover: true,
  });
  assert.deepEqual(resolvePartnerCarouselOptions({ autoPlay: false, speed: 'fast', direction: 'right', pauseOnHover: false }), {
    autoPlay: false,
    speed: 'fast',
    direction: 'right',
    pauseOnHover: false,
  });
  assert.equal(resolvePartnerCarouselOptions({ speed: 'warp' }).speed, 'slow');
  assert.equal(resolvePartnerCarouselOptions({ direction: 'up' }).direction, 'left');
});

test('partner carousel speeds remain deliberately slow', () => {
  assert.equal(partnerCarouselPixelsPerSecond('slow'), 28);
  assert.equal(partnerCarouselPixelsPerSecond('normal'), 30);
  assert.equal(partnerCarouselPixelsPerSecond('fast'), 46);
});

test('partner carousel wraps to the equivalent position without a visible jump', () => {
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: 610, cycleWidth: 600, direction: 'left' }), 10);
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: -8, cycleWidth: 600, direction: 'right' }), 592);
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: 0, cycleWidth: 600, direction: 'right' }), 600);
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: 245, cycleWidth: 600, direction: 'left' }), 245);
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: 245, cycleWidth: 0, direction: 'left' }), 245);
});

test('partner carousel animates only when playback is safe', () => {
  const ready = {
    autoPlay: true,
    overflowing: true,
    reducedMotion: false,
    pageVisible: true,
    carouselVisible: true,
    hovered: false,
    focused: false,
    dragging: false,
    manuallyPaused: false,
  };
  assert.equal(shouldPartnerCarouselAnimate(ready), true);
  for (const blockedBy of ['autoPlay', 'overflowing', 'pageVisible', 'carouselVisible']) {
    assert.equal(shouldPartnerCarouselAnimate({ ...ready, [blockedBy]: false }), false);
  }
  for (const blockedBy of ['reducedMotion', 'hovered', 'focused', 'dragging', 'manuallyPaused']) {
    assert.equal(shouldPartnerCarouselAnimate({ ...ready, [blockedBy]: true }), false);
  }
});

test('keyboard focus followed by pointer drag resumes after the manual delay', () => {
  assert.equal(typeof partnerCarousel.nextPartnerCarouselFocusState, 'function');
  const ready = {
    autoPlay: true,
    overflowing: true,
    reducedMotion: false,
    pageVisible: true,
    carouselVisible: true,
    hovered: false,
    dragging: false,
  };

  let focused = partnerCarousel.nextPartnerCarouselFocusState(false, { type: 'focus-in', focusVisible: true });
  assert.equal(focused, true);
  assert.equal(shouldPartnerCarouselAnimate({ ...ready, focused, manuallyPaused: false }), false);

  focused = partnerCarousel.nextPartnerCarouselFocusState(focused, { type: 'pointer-down' });
  assert.equal(focused, false);
  assert.equal(shouldPartnerCarouselAnimate({ ...ready, focused, manuallyPaused: true }), false);
  assert.equal(shouldPartnerCarouselAnimate({ ...ready, focused, manuallyPaused: false }), true);
});

test('a single partner never overflows even when its content is wider than the viewport', () => {
  assert.equal(typeof partnerCarousel.partnerCarouselIsOverflowing, 'function');
  assert.equal(partnerCarousel.partnerCarouselIsOverflowing({ itemCount: 1, contentWidth: 420, viewportWidth: 180 }), false);
  assert.equal(partnerCarousel.partnerCarouselIsOverflowing({ itemCount: 2, contentWidth: 420, viewportWidth: 180 }), true);
  assert.equal(partnerCarousel.partnerCarouselIsOverflowing({ itemCount: 2, contentWidth: 180, viewportWidth: 180 }), false);
});

test('pointer focus does not keep autoplay paused after dragging', () => {
  assert.equal(shouldPartnerCarouselPauseForFocus({ focusVisible: true, pointerActive: false }), true);
  assert.equal(shouldPartnerCarouselPauseForFocus({ focusVisible: true, pointerActive: true }), false);
  assert.equal(shouldPartnerCarouselPauseForFocus({ focusVisible: false, pointerActive: false }), false);
});

test('partner carousel delta follows direction and caps long frames', () => {
  assert.equal(partnerCarouselDelta({ elapsedMs: 1000, pixelsPerSecond: 18, direction: 'left' }), 1.152);
  assert.equal(partnerCarouselDelta({ elapsedMs: 16, pixelsPerSecond: 30, direction: 'right' }), -0.48);
});
