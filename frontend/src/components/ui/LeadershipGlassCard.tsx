'use client';

import dynamic from 'next/dynamic';
import { useRef, type CSSProperties, type Dispatch, type PointerEvent, type ReactNode, type SetStateAction } from 'react';
import { leadershipRoleConfig, resolveLeadershipCardTier } from '@/lib/leadershipCardTiers.mjs';

const LeadershipFluidLayer = dynamic(() => import('@/components/webgl/LeadershipFluidLayer'), { ssr: false });

export default function LeadershipGlassCard({ personId, role, activePersonId, setActivePersonId, children }: {
  personId: number;
  role: string;
  activePersonId: number | null;
  setActivePersonId: Dispatch<SetStateAction<number | null>>;
  children: ReactNode;
}) {
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const tier = resolveLeadershipCardTier(role);
  const roleConfig = leadershipRoleConfig(role);
  const active = activePersonId === personId;

  const move = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current.x = (event.clientX - rect.left) / rect.width;
    pointerRef.current.y = 1 - ((event.clientY - rect.top) / rect.height);
  };

  return (
    <article
      className={`hk-person hk-person--board hk-person--${tier}`}
      onPointerEnter={() => setActivePersonId(personId)}
      onPointerMove={move}
      onPointerLeave={() => setActivePersonId((current) => current === personId ? null : current)}
      onFocus={() => setActivePersonId(personId)}
      onBlur={() => setActivePersonId((current) => current === personId ? null : current)}
      tabIndex={0}
      data-leadership-tier={tier}
      data-leadership-role={role}
      data-leadership-motif={roleConfig.motif}
      style={{
        '--role-primary': roleConfig.primary,
        '--role-secondary': roleConfig.secondary,
        '--resting-intensity': roleConfig.restingIntensity,
      } as CSSProperties}
    >
      <span className="hk-person__glass-light" aria-hidden="true" />
      <LeadershipFluidLayer tier={tier} role={role} pointerRef={pointerRef} active={active} />
      <div className="hk-person__content">{children}</div>
    </article>
  );
}
