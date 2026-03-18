import { Router, Request, Response } from 'express';
import { startExpo, stopExpo, getExpoUrl } from '../services/expo-process-manager.js';
import { env } from '../config/index.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const router = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/app/start
router.post('/start', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const { port, alreadyRunning } = await startExpo(userId, env.GIT_REPOS_DIR);
    res.json({ url: getExpoUrl(userId), port, alreadyRunning });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/app/stop
router.post('/stop', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const stopped = stopExpo(userId);
  res.json({ stopped });
});

// GET /api/app/url
router.get('/url', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  res.json({ url: getExpoUrl(userId) });
});
// GET /api/app/redirect
router.get('/redirect', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const url = getExpoUrl(userId);
  // 302 redirect to user's Expo app
  res.redirect(url);
});

export { router as appRouter };
