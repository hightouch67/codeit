import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { getPool } from './connection.js';
import type { RowDataPacket } from 'mysql2';

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
}

const SALT_ROUNDS = 10;

export async function createUser(username: string, password: string): Promise<DbUser> {
  const pool = getPool();
  const id = uuidv4();
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  await pool.execute(
    'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
    [id, username, password_hash],
  );

  return { id, username, password_hash, created_at: new Date() };
}

export async function getUserByUsername(username: string): Promise<DbUser | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE username = ?',
    [username],
  );
  return (rows[0] as DbUser) ?? null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE id = ?',
    [id],
  );
  return (rows[0] as DbUser) ?? null;
}

export async function verifyUser(username: string, password: string): Promise<DbUser | null> {
  const user = await getUserByUsername(username);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password_hash);
  return match ? user : null;
}
