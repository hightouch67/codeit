import { Router, Request, Response } from 'express';
import { env } from '../config/index.js';
import { jobQueue } from '../queue/index.js';
import { wsManager } from '../middleware/index.js';

const startedAt = Date.now();
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    queue: jobQueue.stats(),
    wsClients: wsManager.clientCount,
    ai: {
      model: env.AI_MODEL,
      baseUrl: env.AI_BASE_URL,
    },
  });
});

export { router as healthRouter };
