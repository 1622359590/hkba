function explicitSelected(allCodes, selected) {
  const allowed = new Set(allCodes);
  const filtered = Array.isArray(selected) ? [...new Set(selected.map(String).filter((code) => allowed.has(code)))] : [];
  return filtered.length ? filtered : [...allCodes];
}

function selectedOrder(selected, order) {
  const selectedSet = new Set(selected);
  const preferred = Array.isArray(order) ? order.map(String).filter((code) => selectedSet.has(code)) : [];
  return [...new Set([...preferred, ...selected])];
}

export function toggleMemberRole(allCodes, selected, order, code) {
  const current = explicitSelected(allCodes, selected);
  const exists = current.includes(code);
  if (exists && current.length === 1) return { selected: current, order: selectedOrder(current, order), blocked: true };
  const next = exists ? current.filter((entry) => entry !== code) : [...current, code];
  return { selected: next, order: selectedOrder(next, order), blocked: false };
}

export function moveMemberRole(allCodes, selected, order, code, direction) {
  const current = selectedOrder(explicitSelected(allCodes, selected), order);
  const index = current.indexOf(code);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= current.length) return current;
  const next = [...current];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
