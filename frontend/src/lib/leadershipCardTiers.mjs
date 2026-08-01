const ROLE_TIERS = Object.freeze({
  honorary_chairman: 'prestige',
  co_chairman: 'leadership',
  chairman: 'leadership',
  vice_chairman: 'leadership',
  industry_expert: 'professional',
  advisor: 'professional',
  ambassador: 'professional',
  secretary_general: 'professional',
  committee: 'professional',
});

const TIER_CONFIG = Object.freeze({
  prestige: Object.freeze({
    primary: '#d7e4f5',
    secondary: '#d7b96f',
    intensity: 0.34,
    restingIntensity: 0.24,
    speed: 0.18,
    distortion: 0.32,
  }),
  leadership: Object.freeze({
    primary: '#60a5fa',
    secondary: '#67e8f9',
    intensity: 0.3,
    restingIntensity: 0.22,
    speed: 0.14,
    distortion: 0.29,
  }),
  professional: Object.freeze({
    primary: '#7189aa',
    secondary: '#7dd3fc',
    intensity: 0.27,
    restingIntensity: 0.2,
    speed: 0.12,
    distortion: 0.27,
  }),
});

const ROLE_CONFIG = Object.freeze({
  honorary_chairman: Object.freeze({ primary: '#d7e4f5', secondary: '#d7b96f', restingIntensity: 0.24, motif: 'prism' }),
  co_chairman: Object.freeze({ primary: '#c6d5e7', secondary: '#89aee3', restingIntensity: 0.23, motif: 'twin-line' }),
  chairman: Object.freeze({ primary: '#8fb8ff', secondary: '#587fd6', restingIntensity: 0.22, motif: 'authority-line' }),
  vice_chairman: Object.freeze({ primary: '#8bdcec', secondary: '#4f9fc1', restingIntensity: 0.22, motif: 'edge-line' }),
  industry_expert: Object.freeze({ primary: '#b5c4d2', secondary: '#76b8c8', restingIntensity: 0.21, motif: 'grid' }),
  advisor: Object.freeze({ primary: '#b4a9d6', secondary: '#736d9f', restingIntensity: 0.21, motif: 'orbit' }),
  ambassador: Object.freeze({ primary: '#82c8cf', secondary: '#3f8e9e', restingIntensity: 0.21, motif: 'globe' }),
  secretary_general: Object.freeze({ primary: '#9eb9df', secondary: '#587eb4', restingIntensity: 0.21, motif: 'double-rule' }),
  committee: Object.freeze({ primary: '#b6c5d4', secondary: '#6985a4', restingIntensity: 0.2, motif: 'wave' }),
});

export function resolveLeadershipCardTier(role) {
  return typeof role === 'string' && Object.hasOwn(ROLE_TIERS, role)
    ? ROLE_TIERS[role]
    : 'professional';
}

export function leadershipTierConfig(tier) {
  return Object.hasOwn(TIER_CONFIG, tier)
    ? TIER_CONFIG[tier]
    : TIER_CONFIG.professional;
}

export function leadershipRoleConfig(role) {
  return typeof role === 'string' && Object.hasOwn(ROLE_CONFIG, role)
    ? ROLE_CONFIG[role]
    : ROLE_CONFIG.committee;
}
