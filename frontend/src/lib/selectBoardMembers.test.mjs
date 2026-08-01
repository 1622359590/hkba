import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBoardMembers } from './selectBoardMembers.mjs';

const people = [
  { id: 1, group: 'honorary_chairman' },
  { id: 2, group: 'honorary_chairman' },
  { id: 3, group: 'co_chairman' },
];

test('explicit member IDs select exact people in the stored order', () => {
  assert.deepEqual(selectBoardMembers(people, { selectedMemberIds: [3, 1], roles: ['honorary_chairman'], limit: 1 }).map((person) => person.id), [3, 1]);
});

test('invalid explicit IDs are ignored', () => {
  assert.deepEqual(selectBoardMembers(people, { selectedMemberIds: [99, 2] }).map((person) => person.id), [2]);
});

test('empty explicit selection falls back to role filtering and limit', () => {
  assert.deepEqual(selectBoardMembers(people, { selectedMemberIds: [], roles: ['honorary_chairman'], limit: 1 }).map((person) => person.id), [1]);
});

