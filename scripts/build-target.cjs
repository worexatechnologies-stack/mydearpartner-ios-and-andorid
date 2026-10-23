const PRODUCTION_ORIGIN = 'https://mydearpartner.in';

function resolveBuildTarget(environment = process.env) {
  const mode = environment.MDP_ENVIRONMENT || 'production';
  const stagingOrigin = environment.MDP_STAGING_ORIGIN?.trim();
  if (!['production', 'staging'].includes(mode)) {
    throw new Error('MDP_ENVIRONMENT must be production or staging.');
  }
  if (mode === 'production' && stagingOrigin) {
    throw new Error('Remove MDP_STAGING_ORIGIN for a production build.');
  }
  let origin = PRODUCTION_ORIGIN;
  if (mode === 'staging') {
    let url;
    try { url = new URL(stagingOrigin); } catch { /* Fail with a value-free error below. */ }
    if (!url || url.protocol !== 'https:' || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash || url.port ||
        /^(?:www\.)?mydearpartner\.in\.?$/i.test(url.hostname) ||
        /(^|\.)(?:localhost|example\.(?:com|org|net|test)|invalid)$/i.test(url.hostname) ||
        /^(?:127\.|0\.|\[?::1\]?$)/.test(url.hostname)) {
      throw new Error('MDP_STAGING_ORIGIN must be a dedicated HTTPS origin without credentials, paths, ports or query parameters.');
    }
    origin = url.origin;
  }
  return {
    BUILD_ENVIRONMENT: mode,
    API_ORIGIN: origin,
    API_BASE_URL: `${origin}/api/v1`,
    WS_BASE_URL: `${origin.replace('https:', 'wss:')}/ws/`,
    MEDIA_BASE_URL: `${origin}/media`,
  };
}

module.exports = { resolveBuildTarget };

if (require.main === module) {
  try { console.log(JSON.stringify(resolveBuildTarget(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
