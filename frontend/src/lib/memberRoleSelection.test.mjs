import test from 'node:test';
import assert from 'node:assert/strict';
import { moveMemberRole, toggleMemberRole } from './memberRoleSelection.mjs';

const all = ['honorary_chairman', 'chairman', 'advisor'];

test('first toggle expands implicit all-selection and removes the requested identity', () => {
  assert.deepEqual(toggleMemberRole(all, [], [], 'advisor'), {
    selected: ['honorary_chairman', 'chairman'],
    order: ['honorary_chairman', 'chairman'],
    blocked: false,
  });
});

test('toggles identities while preserving explicit selected order', () => {
  assert.deepEqual(toggleMemberRole(all, ['chairman'], ['chairman'], 'advisor'), {
    selected: ['chairman', 'advisor'], order: ['chairman', 'advisor'], blocked: false,
  });
  assert.deepEqual(toggleMemberRole(all, ['chairman', 'advisor'], ['advisor', 'chairman'], 'chairman'), {
    selected: ['advisor'], order: ['advisor'], blocked: false,
  });
});

test('prevents removing the final selected identity', () => {
  assert.deepEqual(toggleMemberRole(all, ['chairman'], ['chairman'], 'chairman'), {
    selected: ['chairman'], order: ['chairman'], blocked: true,
  });
});

test('moves selected identities without mutating inputs', () => {
  const order = ['honorary_chairman', 'chairman', 'advisor'];
  assert.deepEqual(moveMemberRole(all, [], order, 'chairman', -1), ['chairman', 'honorary_chairman', 'advisor']);
  assert.deepEqual(order, ['honorary_chairman', 'chairman', 'advisor']);
});
