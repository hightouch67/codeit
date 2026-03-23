import { v4 as uuidv4 } from 'uuid';
import { getPool } from './connection.js';
import type { RowDataPacket } from 'mysql2';

export interface DbApp {
  id: string;
  user_id: string;
  repo_name: string;
  subdomain: string | null;
  expo_port: number | null;
  expo_pid: number | null;
  created_at: Date;
}

export async function createApp(userId: string, repoName: string, subdomain?: string, expoPort?: number): Promise<DbApp> {
  const pool = getPool();
  const id = uuidv4();
  await pool.execute(
    'INSERT INTO apps (id, user_id, repo_name, subdomain, expo_port) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE subdomain = COALESCE(VALUES(subdomain), subdomain), expo_port = COALESCE(VALUES(expo_port), expo_port)',
    [id, userId, repoName, subdomain ?? null, expoPort ?? null],
  );
  return { id, user_id: userId, repo_name: repoName, subdomain: subdomain ?? null, expo_port: expoPort ?? null, expo_pid: null, created_at: new Date() };
}

export async function updateAppPort(userId: string, repoName: string, expoPort: number, expoPid?: number): Promise<void> {
  const pool = getPool();
  await pool.execute(
    'UPDATE apps SET expo_port = ?, expo_pid = COALESCE(?, expo_pid) WHERE user_id = ? AND repo_name = ?',
    [expoPort, expoPid ?? null, userId, repoName],
  );
}

export async function clearAppPid(userId: string, repoName: string): Promise<void> {
  const pool = getPool();
  await pool.execute(
    'UPDATE apps SET expo_pid = NULL WHERE user_id = ? AND repo_name = ?',
    [userId, repoName],
  );
}

export async function getAppBySubdomainWithPort(subdomain: string): Promise<DbApp | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM apps WHERE subdomain = ?',
    [subdomain],
  );
  return (rows[0] as DbApp) ?? null;
}

export async function getAppByUserAndRepo(userId: string, repoName: string): Promise<DbApp | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM apps WHERE user_id = ? AND repo_name = ?',
    [userId, repoName],
  );
  return (rows[0] as DbApp) ?? null;
}

export async function getAppBySubdomain(subdomain: string): Promise<DbApp | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM apps WHERE subdomain = ?',
    [subdomain],
  );
  return (rows[0] as DbApp) ?? null;
}

export async function updateAppSubdomain(userId: string, repoName: string, subdomain: string): Promise<void> {
  const pool = getPool();
  await pool.execute(
    'UPDATE apps SET subdomain = ? WHERE user_id = ? AND repo_name = ?',
    [subdomain, userId, repoName],
  );
}

export async function getAppsByUserId(userId: string): Promise<DbApp[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM apps WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows as DbApp[];
}
