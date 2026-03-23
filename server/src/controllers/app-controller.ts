import { Router, Request, Response } from 'express';
import { startExpo, stopExpo, getExpoUrl } from '../services/expo-process-manager.js';
import { env } from '../config/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getSubdomainUrl, getUserSubdomain } from '../services/cloudflare-service.js';
import { getAppByUserAndRepo, createApp, updateAppSubdomain, getAppsByUserId } from '../db/index.js';

const router = Router();

router.post('/start', requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  try {
    const { port, alreadyRunning } = await startExpo(userId, env.GIT_REPOS_DIR);
    const url = await getExpoUrl(userId);
    res.json({ url, port, alreadyRunning });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/stop', requireAuth, (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const stopped = stopExpo(userId);
  res.json({ stopped });
});

router.get('/url', requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const url = await getExpoUrl(userId);
  res.json({ url });
});

router.get('/redirect', requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const url = await getExpoUrl(userId);
  res.redirect(url);
});

router.post('/subdomain', requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  try {
    const { subdomain } = req.body;
    if (!subdomain || typeof subdomain !== 'string') {
      res.status(400).json({ error: 'Subdomain is required' });
      return;
    }

    const sanitized = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (sanitized.length < 3 || sanitized.length > 63) {
      res.status(400).json({ error: 'Subdomain must be 3-63 characters (lowercase alphanumeric and hyphens)' });
      return;
    }

    let app = await getAppByUserAndRepo(userId, 'codeit-app');
    if (!app) {
      app = await createApp(userId, 'codeit-app', sanitized);
    } else {
      await updateAppSubdomain(userId, 'codeit-app', sanitized);
    }

    res.json({ subdomain: sanitized, url: getSubdomainUrl(sanitized) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/apps', requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  try {
    const apps = await getAppsByUserId(userId);
    res.json({ apps });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export { router as appRouter };
