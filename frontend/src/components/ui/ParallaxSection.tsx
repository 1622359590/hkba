'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

export default function ParallaxSection({ children, speed = 0.5, className = '' }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const offset = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : speed * 100]);

  return (
    <motion.div ref={ref} className={className} style={{ y: offset }}>
      {children}
    </motion.div>
  );
}
