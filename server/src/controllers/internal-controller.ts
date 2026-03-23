import { Router, Request, Response } from 'express';
import { getAppBySubdomainWithPort } from '../db/index.js';

const router = Router();

/**
 * GET /internal/app-port/:subdomain
 * Used by the user-proxy to look up the Expo port for a given subdomain.
 * Only accessible from localhost — Nginx must NOT expose this route externally.
 */
router.get('/app-port/:subdomain', async (req: Request, res: Response) => {
  const { subdomain } = req.params;
  try {
    const app = await getAppBySubdomainWithPort(subdomain);
    if (!app || !app.expo_port) {
      res.status(404).json({ error: 'App not found or not started' });
      return;
    }
    res.json({ subdomain, port: app.expo_port });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export { router as internalRouter };
