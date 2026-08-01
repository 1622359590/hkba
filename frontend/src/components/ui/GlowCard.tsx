'use client';

import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

type GlowStyle = CSSProperties & {
  '--glow-x': string;
  '--glow-y': string;
  '--glow-color': string;
  '--glow-opacity': number;
};

export default function GlowCard({ children, className = '', glowColor = 'rgba(217,182,86,0.15)' }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const style: GlowStyle = {
    '--glow-x': `${position.x}px`,
    '--glow-y': `${position.y}px`,
    '--glow-color': glowColor,
    '--glow-opacity': isHovered ? 1 : 0,
  };

  return (
    <div
      ref={cardRef}
      className={`glow-card ${className}`.trim()}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style}
    >
      <div className="glow-card__effect" aria-hidden="true" />
      {children}
    </div>
  );
}
