import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leadershipRoleConfig,
  leadershipTierConfig,
  resolveLeadershipCardTier,
} from './leadershipCardTiers.mjs';

test('leadership roles resolve into three deliberate tiers', () => {
  assert.equal(resolveLeadershipCardTier('honorary_chairman'), 'prestige');
  for (const role of ['co_chairman', 'chairman', 'vice_chairman']) {
    assert.equal(resolveLeadershipCardTier(role), 'leadership');
  }
  for (const role of ['industry_expert', 'advisor', 'ambassador', 'secretary_general', 'committee']) {
    assert.equal(resolveLeadershipCardTier(role), 'professional');
  }
});

test('unknown and malformed roles use the quiet professional fallback', () => {
  assert.equal(resolveLeadershipCardTier('future_role'), 'professional');
  assert.equal(resolveLeadershipCardTier(undefined), 'professional');
  assert.equal(resolveLeadershipCardTier(null), 'professional');
});

test('every tier keeps a premium resting effect while ceremonial strength descends', () => {
  const prestige = leadershipTierConfig('prestige');
  const leadership = leadershipTierConfig('leadership');
  const professional = leadershipTierConfig('professional');
  assert.ok(prestige.intensity > leadership.intensity);
  assert.ok(leadership.intensity > professional.intensity);
  assert.ok(professional.intensity >= prestige.intensity * 0.75);
  assert.ok(professional.restingIntensity >= 0.18);
  assert.ok(leadership.restingIntensity >= 0.2);
  assert.ok(prestige.restingIntensity >= 0.22);
  assert.equal(leadershipTierConfig('unknown'), professional);
});

test('role profiles distinguish ceremony without changing card quality', () => {
  const honorary = leadershipRoleConfig('honorary_chairman');
  const expert = leadershipRoleConfig('industry_expert');
  const advisor = leadershipRoleConfig('advisor');
  const ambassador = leadershipRoleConfig('ambassador');
  const secretary = leadershipRoleConfig('secretary_general');
  const committee = leadershipRoleConfig('committee');

  assert.equal(honorary.motif, 'prism');
  assert.equal(expert.motif, 'grid');
  assert.equal(advisor.motif, 'orbit');
  assert.equal(ambassador.motif, 'globe');
  assert.equal(secretary.motif, 'double-rule');
  assert.equal(committee.motif, 'wave');
  for (const profile of [honorary, expert, advisor, ambassador, secretary, committee]) {
    assert.match(profile.primary, /^#[0-9a-f]{6}$/i);
    assert.match(profile.secondary, /^#[0-9a-f]{6}$/i);
    assert.ok(profile.restingIntensity >= 0.18);
  }
});

test('unknown roles receive the same premium neutral treatment as committee members', () => {
  assert.deepEqual(leadershipRoleConfig('future_role'), leadershipRoleConfig('committee'));
  assert.deepEqual(leadershipRoleConfig(null), leadershipRoleConfig('committee'));
});
