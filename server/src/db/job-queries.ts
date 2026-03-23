import { getPool } from './connection.js';
import type { RowDataPacket } from 'mysql2';

export interface DbJob {
  id: string;
  user_id: string;
  prompt: string;
  repo_name: string;
  branch: string;
  status: string;
  message: string | null;
  error: string | null;
  commit_sha: string | null;
  operations_json: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function insertJob(job: {
  id: string;
  userId: string;
  prompt: string;
  repoName: string;
  branch: string;
}): Promise<void> {
  const pool = getPool();
  await pool.execute(
    'INSERT INTO jobs (id, user_id, prompt, repo_name, branch, status) VALUES (?, ?, ?, ?, ?, ?)',
    [job.id, job.userId, job.prompt, job.repoName, job.branch, 'queued'],
  );
}

export async function updateJobStatus(
  id: string,
  status: string,
  fields: { message?: string; error?: string; commitSha?: string; operationsJson?: string },
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `UPDATE jobs SET status = ?, message = COALESCE(?, message), error = COALESCE(?, error),
     commit_sha = COALESCE(?, commit_sha), operations_json = COALESCE(?, operations_json)
     WHERE id = ?`,
    [status, fields.message ?? null, fields.error ?? null, fields.commitSha ?? null, fields.operationsJson ?? null, id],
  );
}

export async function getJobById(id: string): Promise<DbJob | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM jobs WHERE id = ?',
    [id],
  );
  return (rows[0] as DbJob) ?? null;
}

export async function getJobsByUserId(userId: string, limit = 50): Promise<DbJob[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit],
  );
  return rows as DbJob[];
}
