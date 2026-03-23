import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ensureRepo } from '../git/git-service.js';
import { env } from '../config/index.js';
import { getAppByUserAndRepo, createApp, updateAppPort, clearAppPid } from '../db/index.js';
import { getSubdomainUrl, getUserSubdomain } from './cloudflare-service.js';
import { getUserById } from '../db/index.js';

interface ExpoProcess {
  userId: string;
  port: number;
  pid: number;
  proc: ChildProcess;
  startedAt: number;
}

// In-memory map for processes started in THIS server session
const running: Record<string, ExpoProcess> = {};

function getExpoPort(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) >>> 0;
  }
  return 9000 + (hash % 10000);
}

/** Check if a process with a given PID is still alive */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = check only
    return true;
  } catch {
    return false;
  }
}

export async function startExpo(userId: string, repoRoot: string): Promise<{ port: number; alreadyRunning: boolean }> {
  // Already tracked in this session
  if (running[userId]) {
    return { port: running[userId].port, alreadyRunning: true };
  }

  // Check DB — maybe the process survived a server restart
  const existing = await getAppByUserAndRepo(userId, 'codeit-app');
  if (existing?.expo_pid && existing.expo_port && isPidAlive(existing.expo_pid)) {
    console.log(`[ExpoProcess] Reattaching to existing process PID ${existing.expo_pid} port ${existing.expo_port} for user ${userId}`);
    // Re-register in memory (no proc handle needed — we just know it's alive)
    running[userId] = { userId, port: existing.expo_port, pid: existing.expo_pid, proc: null as any, startedAt: Date.now() };
    return { port: existing.expo_port, alreadyRunning: true };
  }

  const port = getExpoPort(userId);
  const repoPath = await ensureRepo(userId, 'codeit-app');

  const expoCli = path.join(repoPath, 'node_modules', 'expo', 'bin', 'cli');
  if (!fs.existsSync(expoCli)) {
    console.log(`[ExpoProcess] Running npm install for user ${userId}...`);
    execSync('npm install', { cwd: repoPath, stdio: 'inherit' });
  }

  const nodePath = '/usr/bin/node';
  const proc = spawn(nodePath, [expoCli, 'start', '--web', '--port', String(port), '--host', 'localhost'], {
    cwd: repoPath,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, PORT: String(port) },
  });

  const pid = proc.pid!;

  proc.on('error', (err) => {
    console.error(`[ExpoProcess] Failed to start for user ${userId}:`, err);
  });
  proc.on('exit', (code, signal) => {
    console.log(`[ExpoProcess] Exited for user ${userId} (pid ${pid}) code=${code} signal=${signal}`);
    delete running[userId];
    clearAppPid(userId, 'codeit-app').catch(() => {});
  });

  running[userId] = { userId, port, pid, proc, startedAt: Date.now() };
  proc.unref();

  console.log(`[ExpoProcess] Started for user ${userId} on port ${port} (PID ${pid})`);

  // Persist port + pid so we can reattach after server restarts
  await ensureAppRecord(userId, 'codeit-app', port, pid);

  return { port, alreadyRunning: false };
}

export function stopExpo(userId: string): boolean {
  const p = running[userId];
  if (!p) return false;
  if (p.proc) p.proc.kill('SIGTERM');
  else if (p.pid) {
    try { process.kill(p.pid, 'SIGTERM'); } catch {}
  }
  delete running[userId];
  clearAppPid(userId, 'codeit-app').catch(() => {});
  return true;
}

export async function getExpoUrl(userId: string): Promise<string> {
  const app = await getAppByUserAndRepo(userId, 'codeit-app');
  if (app?.subdomain) {
    return getSubdomainUrl(app.subdomain);
  }
  const user = await getUserById(userId);
  if (user?.username) {
    return getSubdomainUrl(getUserSubdomain(user.username));
  }
  return `https://${env.CODEIT_DOMAIN}/u/${userId}`;
}

async function ensureAppRecord(userId: string, repoName: string, port: number, pid: number): Promise<void> {
  const user = await getUserById(userId);
  const subdomain = user?.username ? getUserSubdomain(user.username) : userId;

  const existing = await getAppByUserAndRepo(userId, repoName);
  if (!existing) {
    await createApp(userId, repoName, subdomain, port);
  }
  await updateAppPort(userId, repoName, port, pid);
  console.log(`[ExpoProcess] DB record updated: subdomain=${subdomain} port=${port} pid=${pid}`);
}
