'use client';

import { useState } from 'react';

export default function NewsArtwork({ image, className = '' }: { image?: { src: string; alt: string }; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`news-artwork ${className}`}>
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={image.alt} onError={() => setFailed(true)} />
      ) : (
        <svg viewBox="0 0 420 240" aria-hidden="true">
          <path d="M48 185 128 78 213 118 302 52 374 142 282 192 213 118 146 188 128 78" />
          <circle cx="48" cy="185" r="5" /><circle cx="128" cy="78" r="6" />
          <circle className="is-hot" cx="213" cy="118" r="8" /><circle cx="302" cy="52" r="6" />
          <circle cx="374" cy="142" r="5" /><circle cx="282" cy="192" r="5" /><circle cx="146" cy="188" r="5" />
        </svg>
      )}
    </div>
  );
}
