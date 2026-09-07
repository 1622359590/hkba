import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPeopleByRole, selectBoardMembers, selectPeopleByRoles } from './selectBoardMembers.mjs';

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

test('members are grouped by identity while preserving selected order inside each group', () => {
  const selected = selectBoardMembers(people, { selectedMemberIds: [3, 2, 1] });
  assert.deepEqual(
    groupPeopleByRole(selected).map((group) => ({ role: group.role, ids: group.people.map((person) => person.id) })),
    [
      { role: 'honorary_chairman', ids: [2, 1] },
      { role: 'co_chairman', ids: [3] },
    ],
  );
});

test('member directory follows component identity order and stable member order', () => {
  const directoryPeople = [
    { id: 4, group: 'advisor', sortOrder: 1 },
    { id: 2, group: 'chairman', sortOrder: 20 },
    { id: 1, group: 'chairman', sortOrder: 10 },
    { id: 3, group: 'committee', sortOrder: 1 },
  ];
  const groups = [
    { code: 'advisor', sortOrder: 30 },
    { code: 'chairman', sortOrder: 10 },
    { code: 'committee', sortOrder: 20 },
  ];

  assert.deepEqual(
    selectPeopleByRoles(directoryPeople, { roles: ['advisor', 'chairman'], roleOrder: ['advisor', 'chairman'] }, groups).map((person) => person.id),
    [4, 1, 2]
  );
  assert.deepEqual(
    selectPeopleByRoles(directoryPeople, {}, groups).map((person) => person.id),
    [1, 2, 3, 4]
  );
});

test('member directory ignores identities absent from active group metadata', () => {
  const directoryPeople = [{ id: 1, group: 'chairman' }, { id: 2, group: 'retired' }];
  assert.deepEqual(selectPeopleByRoles(directoryPeople, {}, [{ code: 'chairman', sortOrder: 10 }]).map((person) => person.id), [1]);
});
