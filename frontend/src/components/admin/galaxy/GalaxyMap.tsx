'use client';
// Galaxy control center — simplified static first level (ui-interaction-system
// §4; approved simplification D6: no dynamic expansion / zoom / pan this
// phase). Center brand core plus four static first-level nodes with the six
// state badges of §4.2. Nodes are plain links: keyboard-tab reachable, Enter
// opens, and every state carries an icon or text — never color alone.

import Link from 'next/link';

export type GalaxyBadge =
  | { kind: 'ok'; label: string }
  | { kind: 'draft'; count: number }
  | { kind: 'pending'; count: number }
  | { kind: 'missing-en'; count: number }
  | { kind: 'failed'; reason: string }
  | { kind: 'locked'; label?: string };

export type GalaxyNode = {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  icon: string;
  badges: GalaxyBadge[];
  locked?: boolean;
  failed?: boolean;
};

const POSITIONS = [
  { left: '18%', top: '24%' },
  { left: '82%', top: '24%' },
  { left: '18%', top: '76%' },
  { left: '82%', top: '76%' },
];

function Badge({ badge }: { badge: GalaxyBadge }) {
  switch (badge.kind) {
    case 'ok':
      return <span className="hk-badge hk-badge--ok">正常</span>;
    case 'draft':
      return <span className="hk-badge hk-badge--draft">{badge.count} 草稿</span>;
    case 'pending':
      return (
        <span className="hk-badge hk-badge--pending">
          <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
          </svg>
          {badge.count} 待發佈
        </span>
      );
    case 'missing-en':
      return (
        <span className="hk-badge hk-badge--missing-en">
          <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
          {badge.count} EN
        </span>
      );
    case 'failed':
      return (
        <span className="hk-badge hk-badge--failed" title={badge.reason}>
          <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v5m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          失敗
        </span>
      );
    case 'locked':
      return (
        <span className="hk-badge hk-badge--locked">
          <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v2h8z" />
          </svg>
          {badge.label || '無權限'}
        </span>
      );
  }
}

export default function GalaxyMap({ nodes, onRetry }: { nodes: GalaxyNode[]; onRetry?: () => void }) {
  return (
    <div className="hk-galaxy" role="navigation" aria-label="星系控制中心">
      <svg className="hk-galaxy__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {POSITIONS.slice(0, nodes.length).map((pos, index) => (
          <line key={index} x1="50" y1="50" x2={parseFloat(pos.left)} y2={parseFloat(pos.top)} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <Link href="/admin" className="hk-galaxy__node" style={{ left: '50%', top: '50%' }} aria-label="HKBA 核心">
        <span className="hk-galaxy__core">H</span>
        <span className="hk-galaxy__label">HKBA</span>
      </Link>

      {nodes.map((node, index) => {
        const pos = POSITIONS[index % POSITIONS.length];
        const failed = node.badges.some((badge) => badge.kind === 'failed');
        const locked = node.badges.some((badge) => badge.kind === 'locked');
        return (
          <Link
            key={node.id}
            href={node.href}
            className={`hk-galaxy__node${locked ? ' hk-galaxy__node--locked' : ''}${failed ? ' hk-galaxy__node--failed' : ''}`}
            style={pos}
            aria-label={`${node.label}：${node.subtitle}`}
          >
            <span className="hk-galaxy__orb">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={node.icon} />
              </svg>
            </span>
            <span className="hk-galaxy__label">{node.label}</span>
            <span className="hk-galaxy__subtitle">{node.subtitle}</span>
            <span className="hk-galaxy__badges">
              {node.badges.map((badge, badgeIndex) => (
                <Badge key={badgeIndex} badge={badge} />
              ))}
            </span>
            {failed && onRetry ? (
              <span
                role="button"
                tabIndex={0}
                className="hk-save-status__retry"
                onClick={(event) => {
                  event.preventDefault();
                  onRetry();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onRetry();
                  }
                }}
              >
                重試載入
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
