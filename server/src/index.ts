import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config/index.js';
import { jobsRouter, healthRouter, authRouter, appRouter, internalRouter } from './controllers/index.js';
import { wsManager, requestLogger, rateLimit } from './middleware/index.js';
import { jobQueue } from './queue/index.js';
import { processJob } from './services/index.js';
import { initDatabase } from './db/index.js';
import { stopAllExpo } from './services/expo-process-manager.js';

const app = express();

app.use(cors({
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.use(rateLimit({ windowMs: 60_000, max: 100 }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const jobLimiter = rateLimit({ windowMs: 60_000, max: 10 });

app.use('/api/health', healthRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/jobs', jobLimiter, jobsRouter);
app.use('/api/app', appRouter);
app.use('/internal', internalRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = createServer(app);
wsManager.init(server);

jobQueue.setProcessor(processJob);
jobQueue.setOnUpdate((job) => {
  wsManager.broadcastJobUpdate(job);
});

function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP server closed');
  });
  try {
    stopAllExpo();
    console.log('[Server] All Expo processes stopped');
  } catch {}
  setTimeout(() => {
    console.log('[Server] Force exit');
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

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
