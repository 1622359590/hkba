'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const ParticleBackground = dynamic(() => import('./ParticleBackground'), { ssr: false });

export default function PublicEffects() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;
  return <ParticleBackground />;
}
