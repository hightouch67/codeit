import { v4 as uuidv4 } from 'uuid';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export interface User {
  id: string;
  username: string;
  password: string; // format: salt:hash
}

const users: User[] = [];

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = scryptSync(plain, salt, 64);
  return timingSafeEqual(Buffer.from(hash, 'hex'), derived);
}

export function createUser(username: string, password: string): User {
  const user: User = { id: uuidv4(), username, password: hashPassword(password) };
  users.push(user);
  return user;
}

export function verifyUser(username: string, password: string): User | null {
  const user = users.find((u) => u.username === username);
  if (!user) return null;
  return verifyPassword(password, user.password) ? user : null;
}

export function getUserByUsername(username: string): User | undefined {
  return users.find((u) => u.username === username);
}

export { users };
