const pad2 = (value) => String(value).padStart(2, '0');

export function createNewsSlug({
  date = new Date(),
  randomUUID = () => crypto.randomUUID(),
} = {}) {
  const datePart = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  const randomPart = randomUUID().replaceAll('-', '').slice(0, 6).toLowerCase();
  return `news-${datePart}-${randomPart}`;
}
