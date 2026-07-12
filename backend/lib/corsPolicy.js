function isOriginAllowed({ origin, allowedOrigins, host, forwardedHost, proxyHost, fetchSite }) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (fetchSite === 'same-origin') return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = (proxyHost || forwardedHost || host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

module.exports = { isOriginAllowed };
