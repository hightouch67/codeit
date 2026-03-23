import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { env } from '../config/index.js';
import { ensureRepo } from '../git/git-service.js';
import { getAppByUserAndRepo, createApp, updateAppPort, clearAppPid } from '../db/index.js';
import { getSubdomainUrl, getUserSubdomain } from './cloudflare-service.js';
import { getUserById } from '../db/index.js';

const isWindows = os.platform() === 'win32';

interface ExpoProcess {
  userId: string;
  port: number;
  pid: number;
  proc: ChildProcess | null;
  startedAt: number;
}

const running: Record<string, ExpoProcess> = {};

function getExpoPort(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) >>> 0;
  }
  return 9000 + (hash % 10000);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function resolveExpoCli(appDir: string): { command: string; args: string[] } {
  for (const name of ['cli.js', 'cli']) {
    const local = path.join(appDir, 'node_modules', 'expo', 'bin', name);
    if (fs.existsSync(local)) {
      return { command: process.execPath, args: [local] };
    }
  }
  const npxBin = isWindows ? 'npx.cmd' : 'npx';
  return { command: npxBin, args: ['expo'] };
}

export async function startExpo(userId: string, repoRoot: string): Promise<{ port: number; alreadyRunning: boolean }> {
  if (running[userId]) {
    return { port: running[userId].port, alreadyRunning: true };
  }

  // Check DB — maybe the process survived a server restart
  const existing = await getAppByUserAndRepo(userId, 'codeit-app');
  if (existing?.expo_pid && existing.expo_port && isPidAlive(existing.expo_pid)) {
    console.log(`[ExpoProcess] Reattaching to existing process PID ${existing.expo_pid} port ${existing.expo_port} for user ${userId}`);
    running[userId] = { userId, port: existing.expo_port, pid: existing.expo_pid, proc: null, startedAt: Date.now() };
    return { port: existing.expo_port, alreadyRunning: true };
  }

  const port = getExpoPort(userId);
  const repoPath = await ensureRepo(userId, 'codeit-app');

  const expoDir = path.join(repoPath, 'node_modules', 'expo');
  if (!fs.existsSync(expoDir)) {
    console.log(`[ExpoProcess] Installing dependencies in ${repoPath}...`);
    execSync('npm install', { cwd: repoPath, stdio: 'inherit' });
  }

  const { command, args } = resolveExpoCli(repoPath);
  const fullArgs = [...args, 'start', '--web', '--port', String(port), '--host', 'localhost'];
  console.log(`[ExpoProcess] Starting: ${command} ${fullArgs.join(' ')} (cwd: ${repoPath})`);

  const proc = spawn(command, fullArgs, {
    cwd: repoPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWindows,
    env: { ...process.env, PORT: String(port), BROWSER: 'none' },
  });

  proc.stdout?.on('data', (data: Buffer) => {
    console.log(`[Expo:${userId}] ${data.toString().trim()}`);
  });
  proc.stderr?.on('data', (data: Buffer) => {
    console.error(`[Expo:${userId}] ${data.toString().trim()}`);
  });

  const pid = proc.pid!;

  proc.on('error', (err) => {
    console.error(`[ExpoProcess] Failed to start for user ${userId}:`, err);
    delete running[userId];
  });
  proc.on('exit', (code, signal) => {
    console.log(`[ExpoProcess] Exited for user ${userId} (pid ${pid}) code=${code} signal=${signal}`);
    delete running[userId];
    clearAppPid(userId, 'codeit-app').catch(() => {});
  });

  running[userId] = { userId, port, pid, proc, startedAt: Date.now() };
  proc.unref();

  console.log(`[ExpoProcess] Started for user ${userId} on port ${port} (PID ${pid})`);

  await ensureAppRecord(userId, 'codeit-app', port, pid);

  return { port, alreadyRunning: false };
}

export function stopExpo(userId: string): boolean {
  const p = running[userId];
  if (!p) return false;

  console.log(`[ExpoProcess] Stopping for user ${userId} (pid: ${p.pid})`);

  if (p.proc) {
    if (isWindows) {
      try {
        execSync(`taskkill /pid ${p.proc.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        p.proc.kill();
      }
    } else {
      try {
        process.kill(-p.proc.pid!, 'SIGTERM');
      } catch {
        p.proc.kill('SIGTERM');
      }
    }
  } else if (p.pid) {
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

export function stopAllExpo(): void {
  for (const userId of Object.keys(running)) {
    stopExpo(userId);
  }
}
