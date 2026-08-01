'use client';

import { useEffect, useState } from 'react';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { Engine } from '@tsparticles/engine';

async function registerParticlePlugins(engine: Engine) {
  await loadSlim(engine);
}

export default function ParticleBackground() {
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [particleCount, setParticleCount] = useState(40);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 768px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setParticleCount(mobile.matches ? 24 : 40);
      setMotionEnabled(!reducedMotion.matches);
    };
    sync();
    mobile.addEventListener('change', sync);
    reducedMotion.addEventListener('change', sync);
    return () => {
      mobile.removeEventListener('change', sync);
      reducedMotion.removeEventListener('change', sync);
    };
  }, []);

  if (!motionEnabled) return null;

  return (
    <ParticlesProvider init={registerParticlePlugins}>
      <Particles
        id="hkba-particles"
        options={{
          fullScreen: { enable: false },
          fpsLimit: 60,
          pauseOnBlur: true,
          pauseOnOutsideViewport: true,
          particles: {
            number: { value: particleCount, density: { enable: true, width: 1000, height: 1000 } },
            color: { value: ['#6366F1', '#67E8F9'] },
            opacity: { value: { min: 0.1, max: 0.4 }, animation: { enable: true, speed: 0.5, minimumValue: 0.1 } },
            size: { value: { min: 1, max: 3 }, animation: { enable: true, speed: 1, minimumValue: 0.5 } },
            move: { enable: true, speed: 0.3, direction: 'none', outModes: { default: 'out' } },
            links: { enable: true, distance: 150, color: '#6366F1', opacity: 0.06, width: 1 },
          },
          detectRetina: true,
        }}
        className="particle-background"
      />
    </ParticlesProvider>
  );
}
