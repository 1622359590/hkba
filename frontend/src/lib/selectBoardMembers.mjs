export function selectBoardMembers(people, settings = {}) {
  const selectedIds = Array.isArray(settings.selectedMemberIds)
    ? [...new Set(settings.selectedMemberIds.map(Number).filter(Number.isInteger))]
    : [];

  if (selectedIds.length) {
    const byId = new Map(people.map((person) => [Number(person.id), person]));
    return selectedIds.map((id) => byId.get(id)).filter(Boolean);
  }

  const roles = Array.isArray(settings.roles) ? settings.roles.map(String).filter(Boolean) : [];
  const filtered = roles.length ? people.filter((person) => roles.includes(person.group)) : people;
  const limit = Math.max(0, Number(settings.limit) || 0);
  return limit ? filtered.slice(0, limit) : filtered;
}

export function selectPeopleByRoles(people, settings = {}, groups = []) {
  const activeGroups = [...groups].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.code).localeCompare(String(b.code)));
  const activeCodes = activeGroups.map((group) => String(group.code));
  const activeSet = new Set(activeCodes);
  const requestedRoles = Array.isArray(settings.roles) ? [...new Set(settings.roles.map(String).filter((role) => activeSet.has(role)))] : [];
  const selectedRoles = requestedRoles.length ? requestedRoles : activeCodes;
  const selectedSet = new Set(selectedRoles);
  const requestedOrder = Array.isArray(settings.roleOrder) ? settings.roleOrder.map(String).filter((role) => selectedSet.has(role)) : [];
  const roleOrder = [...new Set([...requestedOrder, ...selectedRoles])];
  const roleIndex = new Map(roleOrder.map((role, index) => [role, index]));

  const selectedIds = Array.isArray(settings.selectedMemberIds)
    ? [...new Set(settings.selectedMemberIds.map(Number).filter(Number.isInteger))]
    : [];
  let result;
  if (selectedIds.length) {
    const byId = new Map(people.filter((person) => selectedSet.has(String(person.group))).map((person) => [Number(person.id), person]));
    result = selectedIds.map((id) => byId.get(id)).filter(Boolean);
  } else {
    result = people
      .filter((person) => selectedSet.has(String(person.group)))
      .sort((a, b) => {
        const roleDifference = (roleIndex.get(String(a.group)) ?? roleOrder.length) - (roleIndex.get(String(b.group)) ?? roleOrder.length);
        if (roleDifference) return roleDifference;
        return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || Number(a.id) - Number(b.id);
      });
  }
  const limit = Math.max(0, Number(settings.limit) || 0);
  return limit ? result.slice(0, limit) : result;
}

const ROLE_ORDER = [
  'honorary_chairman',
  'co_chairman',
  'chairman',
  'president',
  'vice_chairman',
  'secretary_general',
  'committee',
  'industry_expert',
  'ambassador',
  'advisor',
  'member',
];

export function groupPeopleByRole(people, preferredOrder = ROLE_ORDER) {
  const groups = new Map();
  for (const person of people) {
    const role = String(person.group || 'member');
    const entries = groups.get(role) || [];
    entries.push(person);
    groups.set(role, entries);
  }

  return [...groups.entries()]
    .map(([role, entries]) => ({ role, people: entries }))
    .sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.role);
      const bIndex = preferredOrder.indexOf(b.role);
      return (aIndex < 0 ? preferredOrder.length : aIndex) - (bIndex < 0 ? preferredOrder.length : bIndex);
    });
}
