import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config/index.js';
import { jobsRouter, healthRouter, authRouter, appRouter } from './controllers/index.js';
import { wsManager } from './middleware/index.js';
import { jobQueue } from './queue/index.js';
import { processJob } from './services/index.js';

const app = express();

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
