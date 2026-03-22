import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config/index.js';
import { jobsRouter, healthRouter, authRouter, appRouter } from './controllers/index.js';
import { wsManager, requestLogger, rateLimit } from './middleware/index.js';
import { jobQueue } from './queue/index.js';
import { processJob } from './services/index.js';
import { stopAllExpo } from './services/expo-process-manager.js';

const app = express();

// ── Middleware ──
app.use(cors({
  origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// Global rate limit: 100 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// ── Routes ──
app.use('/api/health', healthRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/auth', authRouter);
app.use('/api/app', appRouter);

// ── HTTP + WS Server ──
const server = createServer(app);
wsManager.init(server);

// ── Job queue wiring ──
jobQueue.setProcessor(processJob);
jobQueue.setOnUpdate((job) => {
  wsManager.broadcastJobUpdate(job);
});

// ── Graceful shutdown ──
function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('[Server] HTTP server closed');
  });

  // Clean up all Expo processes
  try {
    stopAllExpo();
    console.log('[Server] All Expo processes stopped');
  } catch {}

  // Give connections time to drain, then force exit
  setTimeout(() => {
    console.log('[Server] Force exit');
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Start ──
server.listen(env.PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║         CodeIt Server v1.0.0        ║
╠══════════════════════════════════════╣
║  REST API:  http://localhost:${env.PORT}   ║
║  WebSocket: ws://localhost:${env.PORT}/ws  ║
║  Mode:      ${env.NODE_ENV.padEnd(23)}║
║  AI Model:  ${env.AI_MODEL.padEnd(23)}║
║  Docker:    ${String(env.DOCKER_ENABLED).padEnd(23)}║
╚══════════════════════════════════════╝
  `);
});

export default app;
