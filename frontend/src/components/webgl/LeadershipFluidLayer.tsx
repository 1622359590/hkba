'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { leadershipRoleConfig, leadershipTierConfig } from '@/lib/leadershipCardTiers.mjs';

type Tier = 'prestige' | 'leadership' | 'professional';
type Pointer = { x: number; y: number };

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform float uDistortion;

  float wave(vec2 p, float t) {
    float a = sin((p.x * 5.2 + p.y * 2.1) + t * 1.3);
    float b = sin((p.y * 6.1 - p.x * 1.7) - t * 0.9);
    float c = sin(length(p - uPointer) * 13.0 - t * 1.6);
    return (a + b + c) / 3.0;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * uSpeed;
    float field = wave(uv + vec2(sin(t) * 0.05, cos(t) * 0.04), t);
    vec2 warped = uv + vec2(field, -field) * uDistortion * 0.12;
    float pointerLight = 1.0 - smoothstep(0.08, 0.72, distance(warped, uPointer));
    float ribbon = smoothstep(0.18, 0.92, field * 0.5 + 0.5);
    vec3 color = mix(uPrimary, uSecondary, clamp(ribbon + pointerLight * 0.28, 0.0, 1.0));
    float edge = 1.0 - smoothstep(0.18, 0.8, distance(uv, vec2(0.5)));
    float alpha = (ribbon * 0.24 + pointerLight * 0.36) * uIntensity * edge;
    gl_FragColor = vec4(color, alpha);
  }
`;

function FluidPlane({ tier, role, pointerRef }: { tier: Tier; role: string; pointerRef: MutableRefObject<Pointer> }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const config = leadershipTierConfig(tier);
  const roleConfig = leadershipRoleConfig(role);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uPrimary: { value: new THREE.Color(roleConfig.primary) },
    uSecondary: { value: new THREE.Color(roleConfig.secondary) },
    uIntensity: { value: config.intensity },
    uSpeed: { value: config.speed },
    uDistortion: { value: config.distortion },
  }), [config, roleConfig]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    material.uniforms.uTime.value = clock.getElapsedTime();
    material.uniforms.uPointer.value.set(pointerRef.current.x, pointerRef.current.y);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function LeadershipFluidLayer({ tier, role, pointerRef, active }: {
  tier: Tier;
  role: string;
  pointerRef: MutableRefObject<Pointer>;
  active: boolean;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setEnabled(!coarse.matches && !reduced.matches);
    sync();
    coarse.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    return () => {
      coarse.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
    };
  }, []);

  if (!active || !enabled) return null;

  return (
    <div className="leadership-fluid-layer" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        dpr={[1, 1.25]}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      >
        <FluidPlane tier={tier} role={role} pointerRef={pointerRef} />
      </Canvas>
    </div>
  );
}
