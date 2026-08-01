'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const TARGETS = '.hero, .fade-in-up, .feature-card, .content-reveal';

export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = (element: Element) => element.classList.add('visible');
    const elements = Array.from(document.querySelectorAll(TARGETS));

    if (reducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach(reveal);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });

    elements.forEach(element => observer.observe(element));
    const mutations = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches(TARGETS)) observer.observe(node);
        node.querySelectorAll(TARGETS).forEach(element => observer.observe(element));
      }));
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
