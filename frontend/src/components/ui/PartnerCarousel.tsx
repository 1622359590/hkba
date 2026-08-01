'use client';

import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  partnerCarouselDelta,
  partnerCarouselPixelsPerSecond,
  resolvePartnerCarouselOptions,
  shouldPartnerCarouselAnimate,
  wrapPartnerCarouselScroll,
} from '@/lib/partnerCarousel.mjs';

export type PartnerCarouselItem = { id: string | number };

export type PartnerCarouselProps<T extends PartnerCarouselItem> = {
  items: T[];
  ariaLabel: string;
  autoPlay?: boolean;
  speed?: 'slow' | 'normal' | 'fast';
  direction?: 'left' | 'right';
  pauseOnHover?: boolean;
  className?: string;
  renderItem: (item: T, duplicate: boolean) => ReactNode;
};

type DragState = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
};

export default function PartnerCarousel<T extends PartnerCarouselItem>({
  items,
  ariaLabel,
  autoPlay = true,
  speed = 'slow',
  direction = 'left',
  pauseOnHover = true,
  className = '',
  renderItem,
}: PartnerCarouselProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstSetRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const draggedRef = useRef(false);
  const clearDraggedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedDirectionRef = useRef<string>('');

  const [overflowing, setOverflowing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  const options = resolvePartnerCarouselOptions({ autoPlay, speed, direction, pauseOnHover });

  const pauseTemporarily = useCallback(() => {
    setManuallyPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      setManuallyPaused(false);
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      if (clearDraggedTimerRef.current) clearTimeout(clearDraggedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    const markVisible = () => setPageVisible(document.visibilityState !== 'hidden');
    const markHidden = () => setPageVisible(false);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('focus', markVisible);
    window.addEventListener('blur', markHidden);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('focus', markVisible);
      window.removeEventListener('blur', markHidden);
    };
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const firstSet = firstSetRef.current;
    if (!viewport || !firstSet) return;

    const measure = () => {
      const nextOverflowing = firstSet.scrollWidth > viewport.clientWidth + 1;
      setOverflowing(nextOverflowing);
      if (!nextOverflowing) viewport.scrollLeft = 0;
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(firstSet);
    return () => observer.disconnect();
  }, [items]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const firstSet = firstSetRef.current;
    if (!viewport || !firstSet || !overflowing) {
      initializedDirectionRef.current = '';
      return;
    }
    const initializationKey = `${options.direction}:${items.map((item) => item.id).join(',')}`;
    if (initializedDirectionRef.current === initializationKey) return;
    viewport.scrollLeft = options.direction === 'right' ? firstSet.scrollWidth : 0;
    initializedDirectionRef.current = initializationKey;
  }, [items, options.direction, overflowing]);

  useEffect(() => {
    const animate = shouldPartnerCarouselAnimate({
      autoPlay: options.autoPlay,
      overflowing,
      reducedMotion,
      pageVisible,
      hovered: options.pauseOnHover && hovered,
      focused,
      dragging,
      manuallyPaused,
    });

    if (!animate) {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      lastTimestampRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      const viewport = viewportRef.current;
      const firstSet = firstSetRef.current;
      if (!viewport || !firstSet) return;

      const previous = lastTimestampRef.current ?? timestamp;
      lastTimestampRef.current = timestamp;
      const next = viewport.scrollLeft + partnerCarouselDelta({
        elapsedMs: timestamp - previous,
        pixelsPerSecond: partnerCarouselPixelsPerSecond(options.speed),
        direction: options.direction,
      });
      viewport.scrollLeft = wrapPartnerCarouselScroll({
        scrollLeft: next,
        cycleWidth: firstSet.scrollWidth,
        direction: options.direction,
      });
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      lastTimestampRef.current = null;
    };
  }, [dragging, focused, hovered, manuallyPaused, options.autoPlay, options.direction, options.pauseOnHover, options.speed, overflowing, pageVisible, reducedMotion]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (clearDraggedTimerRef.current) clearTimeout(clearDraggedTimerRef.current);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: viewport.scrollLeft };
    draggedRef.current = false;
    setDragging(true);
    viewport.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) draggedRef.current = true;
    viewport.scrollLeft = drag.startScrollLeft - delta;
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (!viewport || !drag || drag.pointerId !== event.pointerId) return;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
    pauseTemporarily();
    clearDraggedTimerRef.current = setTimeout(() => {
      draggedRef.current = false;
      clearDraggedTimerRef.current = null;
    }, 0);
  };

  const suppressDraggedClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!draggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    draggedRef.current = false;
  };

  const rootClassName = [
    'partner-carousel',
    overflowing ? 'is-overflowing' : '',
    dragging ? 'is-dragging' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <div
        ref={viewportRef}
        className="partner-carousel__viewport"
        role="region"
        aria-label={ariaLabel}
        tabIndex={overflowing ? 0 : undefined}
        onMouseEnter={() => options.pauseOnHover && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={suppressDraggedClick}
        onWheel={pauseTemporarily}
      >
        <div className="partner-carousel__track">
          <div ref={firstSetRef} className="partner-carousel__set">
            {items.map((item) => (
              <div className="partner-carousel__item" key={item.id}>{renderItem(item, false)}</div>
            ))}
          </div>
          {overflowing ? (
            <div className="partner-carousel__set" aria-hidden="true" inert>
              {items.map((item) => (
                <div className="partner-carousel__item" key={`duplicate-${item.id}`}>{renderItem(item, true)}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
