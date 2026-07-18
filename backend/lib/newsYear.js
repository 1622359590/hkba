// News display-year rules (spec: main design §8, data-api §6).
//
// Year filtering prefers the editor-set displayYear; when unset it falls back
// to the calendar year of publishedAt. `latest` year mode means the maximum
// year present in published news, not the server's current year.

// A valid display year override is a four-digit integer.
function isValidDisplayYear(year) {
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

// Resolves the year a news item should be filed under.
// Accepts { display_year, published_at } rows. Returns null when neither a
// valid display year nor a parseable published date exists.
function displayYearOf(news) {
  if (news && isValidDisplayYear(news.display_year)) {
    return news.display_year;
  }
  const raw = news && news.published_at;
  if (!raw) return null;
  const time = Date.parse(String(raw).replace(' ', 'T'));
  if (Number.isNaN(time)) return null;
  return new Date(time).getUTCFullYear();
}

// Given display years of published items, resolves the `latest` year mode to
// the maximum year actually present in the data (never the server clock).
function latestYearOf(years) {
  const valid = years.filter((year) => isValidDisplayYear(year));
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

module.exports = { isValidDisplayYear, displayYearOf, latestYearOf };
