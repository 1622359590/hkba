const SPEEDS = Object.freeze({ slow: 28, normal: 30, fast: 46 });

/** @typedef {'slow' | 'normal' | 'fast'} PartnerCarouselSpeed */
/** @typedef {'left' | 'right'} PartnerCarouselDirection */
/** @typedef {{ autoPlay: boolean, speed: PartnerCarouselSpeed, direction: PartnerCarouselDirection, pauseOnHover: boolean }} PartnerCarouselOptions */

/**
 * @param {Record<string, unknown>} settings
 * @returns {PartnerCarouselOptions}
 */
export function resolvePartnerCarouselOptions(settings = {}) {
  return {
    autoPlay: typeof settings.autoPlay === 'boolean' ? settings.autoPlay : true,
    speed: Object.hasOwn(SPEEDS, settings.speed) ? /** @type {PartnerCarouselSpeed} */ (settings.speed) : 'slow',
    direction: settings.direction === 'right' ? 'right' : 'left',
    pauseOnHover: typeof settings.pauseOnHover === 'boolean' ? settings.pauseOnHover : true,
  };
}

export function partnerShowsDetails(variant) {
  return variant === 'cards';
}

export function partnerCarouselPixelsPerSecond(speed) {
  return SPEEDS[speed] || SPEEDS.slow;
}

export function shouldPartnerCarouselAnimate(state) {
  return Boolean(
    state.autoPlay
    && state.overflowing
    && !state.reducedMotion
    && state.pageVisible
    && state.carouselVisible
    && !state.hovered
    && !state.focused
    && !state.dragging
    && !state.manuallyPaused
  );
}

export function shouldPartnerCarouselPauseForFocus({ focusVisible, pointerActive }) {
  return Boolean(focusVisible && !pointerActive);
}

export function nextPartnerCarouselFocusState(currentFocused, event) {
  if (event.type === 'pointer-down' || event.type === 'focus-out') return false;
  if (event.type === 'focus-in') {
    return shouldPartnerCarouselPauseForFocus({
      focusVisible: event.focusVisible,
      pointerActive: event.pointerActive,
    });
  }
  return currentFocused;
}

export function partnerCarouselIsOverflowing({ itemCount, contentWidth, viewportWidth }) {
  return itemCount > 1 && contentWidth > viewportWidth + 1;
}

export function partnerCarouselDelta({ elapsedMs, pixelsPerSecond, direction }) {
  const distance = pixelsPerSecond * Math.min(Math.max(elapsedMs, 0), 64) / 1000;
  return direction === 'right' ? -distance : distance;
}

export function wrapPartnerCarouselScroll({ scrollLeft, cycleWidth, direction }) {
  if (!(cycleWidth > 0)) return scrollLeft;
  if (direction === 'right' && scrollLeft <= 0) return scrollLeft + cycleWidth;
  if (direction !== 'right' && scrollLeft >= cycleWidth) return scrollLeft - cycleWidth;
  return scrollLeft;
}
