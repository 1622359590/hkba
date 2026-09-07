export function moveTeamGroup(codes, code, direction) {
  const next = [...codes];
  const index = next.indexOf(code);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
