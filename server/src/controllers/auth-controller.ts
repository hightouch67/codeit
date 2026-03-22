import { Router, Request, Response } from 'express';
import { createUser, verifyUser, getUserByUsername } from '../services/user-service.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { rateLimit } from '../middleware/rate-limit.js';

const router = Router();

// Stricter rate limit on auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

function signToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
router.post('/register', authLimiter, (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Missing username or password' });
    return;
  }
  if (typeof username !== 'string' || username.length < 3 || username.length > 30) {
    res.status(400).json({ error: 'Username must be 3-30 characters' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  if (getUserByUsername(username)) {
    res.status(409).json({ error: 'User exists' });
    return;
  }
  const user = createUser(username, password);
  const token = signToken(user.id, user.username);
  res.status(201).json({ token, user: { id: user.id, username: user.username } });
});

// POST /api/auth/login
router.post('/login', authLimiter, (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Missing username or password' });
    return;
  }
  const user = verifyUser(username, password);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signToken(user.id, user.username);
  res.json({ token, user: { id: user.id, username: user.username } });
});

export { router as authRouter };
