import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { env } from './config/index.js';
import { jobsRouter, healthRouter, authRouter, appRouter, internalRouter } from './controllers/index.js';
import { wsManager } from './middleware/index.js';
import { jobQueue } from './queue/index.js';
import { processJob } from './services/index.js';
import { initDatabase } from './db/index.js';

const app = express();

// ── Middleware ──
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? [`https://${env.CODEIT_DOMAIN}`, /\.codeit\.brickvue\.com$/]
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const jobLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many job requests, please slow down' },
});

// ── Routes ──
app.use('/api/health', healthRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/jobs', jobLimiter, jobsRouter);
app.use('/api/app', appRouter);
// Internal only — Nginx must not expose /internal to the public
app.use('/internal', internalRouter);

// ── 404 handler ──
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ──
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── HTTP + WS Server ──
const server = createServer(app);
wsManager.init(server);

// ── Job queue wiring ──
jobQueue.setProcessor(processJob);
jobQueue.setOnUpdate((job) => {
  wsManager.broadcastJobUpdate(job);
});

// ── Start ──
async function start() {
  try {
    await initDatabase();
    console.log('[DB] Connected to MySQL');
  } catch (err) {
    console.error('[DB] Failed to initialize database:', err);
    process.exit(1);
  }

  server.listen(env.PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║         CodeIt Server v1.1.0        ║
╠══════════════════════════════════════╣
║  REST API:  http://localhost:${env.PORT}   ║
║  WebSocket: ws://localhost:${env.PORT}/ws  ║
║  Mode:      ${env.NODE_ENV.padEnd(23)}║
║  AI Model:  ${env.AI_MODEL.padEnd(23)}║
║  Docker:    ${String(env.DOCKER_ENABLED).padEnd(23)}║
║  Database:  ${`${env.DB_HOST}:${env.DB_PORT}`.padEnd(23)}║
╚══════════════════════════════════════╝
    `);
  });
}

start();

export default app;
