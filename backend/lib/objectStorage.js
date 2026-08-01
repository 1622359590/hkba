function normalizeEndpoint(value) {
  return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function createOssClient(settings) {
  // Loaded lazily so local-storage deployments do not initialize the SDK.
  const OSS = require('ali-oss');
  const options = {
    region: settings.region,
    bucket: settings.bucket,
    accessKeyId: settings.accessKeyId,
    accessKeySecret: settings.accessKeySecret,
    secure: true,
  };
  if (settings.endpoint) options.endpoint = normalizeEndpoint(settings.endpoint);
  return new OSS(options);
}

function buildOssPublicUrl(settings, key) {
  const cleanKey = String(key || '').replace(/^\/+/, '');
  const customDomain = String(settings.customDomain || '').trim().replace(/\/+$/, '');
  if (customDomain) return `${customDomain}/${cleanKey}`;
  const endpoint = normalizeEndpoint(settings.endpoint) || `${settings.region}.aliyuncs.com`;
  return `https://${settings.bucket}.${endpoint}/${cleanKey}`;
}

async function putOssObject(settings, object, clientFactory = createOssClient) {
  const client = clientFactory(settings);
  await client.put(object.key, object.content, {
    headers: {
      'Content-Type': object.mimeType,
      'x-oss-object-acl': 'public-read',
    },
  });
  return { url: buildOssPublicUrl(settings, object.key) };
}

async function deleteOssObject(settings, key, clientFactory = createOssClient) {
  const client = clientFactory(settings);
  await client.delete(key);
}

async function testOssConnection(settings, clientFactory = createOssClient) {
  const client = clientFactory(settings);
  await client.list({ 'max-keys': 1 });
  return true;
}

module.exports = {
  buildOssPublicUrl,
  createOssClient,
  deleteOssObject,
  putOssObject,
  testOssConnection,
};
