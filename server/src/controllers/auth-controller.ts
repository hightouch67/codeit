import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { createUser, verifyUser, getUserByUsername } from '../services/user-service.js';

const router = Router();

function signToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req: Request, res: Response) => {
  try {
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

    const existing = await getUserByUsername(username);
    if (existing) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const user = await createUser(username, password);
    const token = signToken(user.id, user.username);
    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Missing username or password' });
      return;
    }
    const user = await verifyUser(username, password);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = signToken(user.id, user.username);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export { router as authRouter };
