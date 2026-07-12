function isOriginAllowed({ origin, allowedOrigins, host, forwardedHost }) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = (forwardedHost || host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

module.exports = { isOriginAllowed };
