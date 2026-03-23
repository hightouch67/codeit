const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');

const app = express();
app.use(morgan('dev'));

const CODEIT_DOMAIN = process.env.CODEIT_DOMAIN || 'codeit.brickvue.com';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

// Cache port lookups briefly to avoid hammering the API on every request
const portCache = new Map(); // subdomain -> { port, expiresAt }
const CACHE_TTL_MS = 30_000;

async function getPortForSubdomain(subdomain) {
  const cached = portCache.get(subdomain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.port;
  }

  try {
    const res = await fetch(`${SERVER_URL}/internal/app-port/${encodeURIComponent(subdomain)}`);
    if (!res.ok) return null;
    const { port } = await res.json();
    portCache.set(subdomain, { port, expiresAt: Date.now() + CACHE_TTL_MS });
    return port;
  } catch (err) {
    console.error(`[Proxy] Failed to fetch port for ${subdomain}:`, err.message);
    return null;
  }
}

// Subdomain-based routing: {username}.codeit.brickvue.com
app.use(async (req, res, next) => {
  const host = (req.headers.host || '').split(':')[0];
  const domainSuffix = `.${CODEIT_DOMAIN}`;

  if (!host.endsWith(domainSuffix)) return next();

  const subdomain = host.slice(0, -domainSuffix.length);
  if (!subdomain || subdomain === 'www' || subdomain === 'api') return next();

  const port = await getPortForSubdomain(subdomain);

  if (!port) {
    res.status(502).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>App not running</h2>
        <p>The app for <strong>${subdomain}</strong> is not started yet.</p>
        <p>Go to <a href="https://${CODEIT_DOMAIN}">codeit.brickvue.com</a> and click "Launch My App".</p>
      </body></html>
    `);
    return;
  }

  const proxy = createProxyMiddleware({
    target: `http://localhost:${port}`,
    changeOrigin: true,
    ws: true,
    logLevel: 'warn',
    onError: (err, req, res) => {
      console.error(`[Proxy] Error for ${subdomain} (port ${port}):`, err.message);
      portCache.delete(subdomain); // Clear cache so next request retries
      res.status(502).send('App is starting up, please try again in a moment.');
    },
  });

  return proxy(req, res, next);
});

// Path-based fallback: /u/:userId (legacy support)
app.use('/u/:userId', async (req, res, next) => {
  const { userId } = req.params;
  // Try to find port by userId prefix match in cache
  // Fall back: redirect to main app
  res.redirect(`https://${CODEIT_DOMAIN}`);
});

// Everything else → main app
app.use((req, res) => {
  res.redirect(`https://${CODEIT_DOMAIN}`);
});

const PORT = process.env.PROXY_PORT || 8081;
app.listen(PORT, () => {
  console.log(`[Proxy] Listening on port ${PORT}`);
  console.log(`[Proxy] Domain: ${CODEIT_DOMAIN}`);
  console.log(`[Proxy] Server: ${SERVER_URL}`);
});
