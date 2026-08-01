'use client';

import { useEffect, useRef, useState } from 'react';
import { parseAnimatedStat } from '@/lib/animatedStat.mjs';

type AnimatedStatProps = {
  value: string;
  duration?: number;
  className?: string;
};

export default function AnimatedStat({ value, duration = 1100, className }: AnimatedStatProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(() => {
    const parsed = parseAnimatedStat(value);
    return `${parsed.target.toFixed(parsed.decimals)}${parsed.suffix}`;
  });

  useEffect(() => {
    const parsed = parseAnimatedStat(value);
    const finalValue = `${parsed.target.toFixed(parsed.decimals)}${parsed.suffix}`;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || parsed.target <= 0) {
      setDisplayValue(finalValue);
      return;
    }

    let animationFrame = 0;
    let started = false;
    let startTime = 0;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = parsed.target * eased;
      setDisplayValue(`${current.toFixed(parsed.decimals)}${parsed.suffix}`);
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };

    const start = () => {
      if (started) return;
      started = true;
      setDisplayValue(`${(0).toFixed(parsed.decimals)}${parsed.suffix}`);
      animationFrame = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        start();
        observer.disconnect();
      }
    }, { threshold: 0.4 });

    if (elementRef.current) observer.observe(elementRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [duration, value]);

  return <span ref={elementRef} className={className}>{displayValue}</span>;
}
