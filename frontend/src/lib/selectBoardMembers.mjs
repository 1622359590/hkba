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

