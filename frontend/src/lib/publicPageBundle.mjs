export async function loadPublicPageBundle(path, loaders) {
  const page = await loaders.fetchPage(path);
  if (!page) return null;

  const [news, association] = await Promise.all([
    loaders.fetchNews(),
    loaders.fetchAssociation(),
  ]);

  return { page, news, association };
}
