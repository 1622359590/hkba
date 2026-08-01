import type { CSSProperties } from 'react';
import { heroWordmarkPresentation } from '@/lib/heroWordmark.mjs';

type HeroScanWordmarkProps = { text?: string };

export default function HeroScanWordmark({ text = 'HKBA' }: HeroScanWordmarkProps) {
  const presentation = heroWordmarkPresentation(text);
  const style = { '--hero-scan-duration': `${presentation.cycleMs}ms` } as CSSProperties;

  return (
    <h1 className="hero-title hero-wordmark" style={style}>
      {presentation.layers.map((layer) => (
        <span
          key={layer.kind}
          className={layer.className}
          aria-hidden={layer.ariaHidden || undefined}
        >
          {layer.text}
        </span>
      ))}
      <span className="hero-wordmark__beam" aria-hidden="true" />
    </h1>
  );
}
