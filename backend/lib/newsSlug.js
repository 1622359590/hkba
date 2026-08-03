const crypto = require('crypto');

const pad2 = (value) => String(value).padStart(2, '0');

function createNewsSlugCandidate({
  date = new Date(),
  randomUUID = () => crypto.randomUUID(),
} = {}) {
  const datePart = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  const randomPart = randomUUID().replaceAll('-', '').slice(0, 6).toLowerCase();
  return `news-${datePart}-${randomPart}`;
}

function generateUniqueNewsSlug({
  isTaken,
  date = new Date(),
  randomUUID = () => crypto.randomUUID(),
  maxAttempts = 10,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = createNewsSlugCandidate({ date, randomUUID });
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error('Unable to generate a unique news slug');
}

module.exports = { createNewsSlugCandidate, generateUniqueNewsSlug };
