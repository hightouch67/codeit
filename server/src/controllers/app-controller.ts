import { Router, Request, Response } from 'express';
import { startExpo, stopExpo, getExpoUrl } from '../services/expo-process-manager.js';
import { env } from '../config/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/app/start
router.post('/start', requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  try {
    const { port, alreadyRunning } = await startExpo(userId, env.GIT_REPOS_DIR);
    res.json({ url: getExpoUrl(userId), port, alreadyRunning });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/app/stop
router.post('/stop', requireAuth, (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const stopped = stopExpo(userId);
  res.json({ stopped });
});

// GET /api/app/url
router.get('/url', requireAuth, (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  res.json({ url: getExpoUrl(userId) });
});

// GET /api/app/redirect
router.get('/redirect', requireAuth, (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const url = getExpoUrl(userId);
  res.redirect(url);
});

export { router as appRouter };
