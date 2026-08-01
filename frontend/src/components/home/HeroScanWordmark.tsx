import type { CSSProperties } from 'react';
import { Oxanium } from 'next/font/google';
import { heroWordmarkPresentation } from '@/lib/heroWordmark.mjs';
import styles from './HeroScanWordmark.module.css';

const oxanium = Oxanium({
  subsets: ['latin'],
  weight: ['600', '700'],
});

const layerClassNames: Record<string, string> = {
  base: styles.base,
  light: styles.light,
  texture: styles.texture,
};

type HeroScanWordmarkProps = { text?: string };

export default function HeroScanWordmark({ text = 'HKBA' }: HeroScanWordmarkProps) {
  const presentation = heroWordmarkPresentation(text);
  const style = { '--hero-scan-duration': `${presentation.cycleMs}ms` } as CSSProperties;

  return (
    <h1 className={`hero-title hero-wordmark ${styles.wordmark} ${oxanium.className}`}>
      <span className={`hero-wordmark__motion ${styles.motion}`} style={style}>
        {presentation.layers.map((layer) => (
          <span
            key={layer.kind}
            className={`${layer.className} ${layerClassNames[layer.kind]}`}
            aria-hidden={layer.ariaHidden || undefined}
          >
            {layer.text}
          </span>
        ))}
        <span className={`hero-wordmark__beam ${styles.beam}`} aria-hidden="true" />
      </span>
    </h1>
  );
}
