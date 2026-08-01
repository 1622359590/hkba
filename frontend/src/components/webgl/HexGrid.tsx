'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Point3 = [number, number, number];

function createHexOutline() {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index + Math.PI / 6;
    return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
  });
  return new THREE.BufferGeometry().setFromPoints(points);
}

function HexOutline({ geometry, position, scale, phase }: {
  geometry: THREE.BufferGeometry;
  position: Point3;
  scale: number;
  phase: number;
}) {
  const line = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: phase % 4 === 0 ? '#6366F1' : '#67E8F9',
      transparent: true,
      opacity: 0.08,
    });
    const object = new THREE.LineLoop(geometry, material);
    object.position.set(...position);
    object.scale.setScalar(scale);
    return object;
  }, [geometry, phase, position, scale]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.getElapsedTime() * 0.32 + phase) + 1) / 2;
    line.material.opacity = 0.035 + pulse * 0.065;
  });

  useEffect(() => () => line.material.dispose(), [line]);
  return <primitive object={line} />;
}

function ConnectionLine({ start, end, phase }: { start: Point3; end: Point3; phase: number }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ]);
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: '#67E8F9', transparent: true, opacity: 0.04 }),
    );
  }, [end, start]);

  useFrame(({ clock }) => {
    line.material.opacity = 0.025 + ((Math.sin(clock.getElapsedTime() * 0.25 + phase) + 1) / 2) * 0.035;
  });

  useEffect(() => () => {
    line.geometry.dispose();
    line.material.dispose();
  }, [line]);
  return <primitive object={line} />;
}

function NetworkNodes({ positions }: { positions: Point3[] }) {
  const points = useRef<THREE.Points>(null!);
  const data = useMemo(() => new Float32Array(positions.flat()), [positions]);

  useFrame(({ clock }) => {
    const material = points.current.material as THREE.PointsMaterial;
    material.opacity = 0.22 + ((Math.sin(clock.getElapsedTime() * 0.45) + 1) / 2) * 0.16;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#6366F1" size={0.045} transparent opacity={0.28} sizeAttenuation />
    </points>
  );
}

function Scene({ compact }: { compact: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const geometry = useMemo(() => createHexOutline(), []);
  const cells = useMemo(() => {
    const rows = compact ? 4 : 5;
    const columns = compact ? 4 : 6;
    const spacing = compact ? 1.45 : 1.55;
    const result: { position: Point3; scale: number; phase: number }[] = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if ((row * 2 + column) % 5 === 0) continue;
        const x = column * spacing + (row % 2 ? spacing / 2 : 0) - (compact ? 0.3 : 1.2);
        const y = row * spacing * 0.86 - rows * spacing * 0.42;
        result.push({
          position: [x, y, -1.5],
          scale: 0.46,
          phase: row * 0.7 + column * 0.45,
        });
      }
    }
    return result;
  }, [compact]);
  const connections = useMemo(() => cells.flatMap((cell, index) => {
    if (index % 3 !== 0 || !cells[index + 1]) return [];
    return [{ start: cell.position, end: cells[index + 1].position, phase: index * 0.2 }];
  }), [cells]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    group.current.position.x = Math.sin(elapsed * 0.08) * 0.08;
    group.current.position.y = Math.cos(elapsed * 0.07) * 0.05;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group ref={group}>
      {cells.map((cell, index) => (
        <HexOutline
          key={`${cell.position.join('-')}-${index}`}
          geometry={geometry}
          position={cell.position}
          scale={cell.scale}
          phase={cell.phase}
        />
      ))}
      {connections.map((connection, index) => (
        <ConnectionLine key={`connection-${index}`} {...connection} />
      ))}
      <NetworkNodes positions={cells.filter((_, index) => index % 2 === 0).map(cell => cell.position)} />
    </group>
  );
}

export default function HexGridScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [compact, setCompact] = useState(false);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setCompact(media.matches);
      setDisabled(motion.matches);
    };
    sync();
    media.addEventListener('change', sync);
    motion.addEventListener('change', sync);
    return () => {
      media.removeEventListener('change', sync);
      motion.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (disabled) return null;

  return (
    <div ref={hostRef} className="hex-grid-scene" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 9], fov: 48 }}
        dpr={compact ? 1 : [1, 1.5]}
        frameloop={isVisible ? 'always' : 'never'}
        gl={{ antialias: !compact, alpha: true, powerPreference: 'high-performance' }}
      >
        <Scene compact={compact} />
      </Canvas>
    </div>
  );
}
