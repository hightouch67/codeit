// Express reverse proxy for per-user Expo web apps
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');

const app = express();
app.use(morgan('dev'));

// Port mapping logic (must match backend)
function getExpoPort(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) % 1000;
  return 9000 + hash;
}

// Proxy /u/:userId/* to the correct Expo app port
app.use('/u/:userId', (req, res, next) => {
  const { userId } = req.params;
  const port = getExpoPort(userId);
  // Remove /u/:userId from the path for the proxied request
  const proxy = createProxyMiddleware({
    target: `http://localhost:${port}`,
    changeOrigin: true,
    pathRewrite: {
      [`^/u/${userId}`]: '',
    },
    ws: true,
    onError: (err, req, res) => {
      res.status(502).send('Expo app not running for this user.');
    },
  });
  return proxy(req, res, next);
});

// Fallback: redirect all other requests to the main app (running on 8082)
app.use((req, res) => {
  res.redirect('http://localhost:8082');
});

const PORT = process.env.PROXY_PORT || 8081;
app.listen(PORT, () => {
  console.log(`User proxy listening on port ${PORT}`);
});
