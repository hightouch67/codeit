import { getPool } from './connection.js';

export async function initDatabase(): Promise<void> {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS jobs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      prompt TEXT NOT NULL,
      repo_name VARCHAR(255) NOT NULL,
      branch VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'queued',
      message TEXT,
      error TEXT,
      commit_sha VARCHAR(255),
      operations_json LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_jobs_user_id (user_id),
      INDEX idx_jobs_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS apps (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      repo_name VARCHAR(255) NOT NULL,
      subdomain VARCHAR(255) UNIQUE,
      expo_port INT,
      expo_pid INT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_apps_user_id (user_id),
      UNIQUE KEY uq_user_repo (user_id, repo_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Add expo_port column if it doesn't exist (for existing deployments)
  await pool.execute(`
    ALTER TABLE apps ADD COLUMN IF NOT EXISTS expo_port INT
  `).catch(() => {
    // MySQL 5.7 doesn't support IF NOT EXISTS on ALTER — ignore if column already exists
  });

  console.log('[DB] Schema initialized');
}
