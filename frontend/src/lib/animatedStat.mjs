export function parseAnimatedStat(value) {
  const normalized = String(value ?? '').trim();
  const match = normalized.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return { target: 0, suffix: normalized, decimals: 0 };

  const numeric = match[1];
  return {
    target: Number(numeric),
    suffix: match[2],
    decimals: numeric.includes('.') ? numeric.split('.')[1].length : 0,
  };
}
