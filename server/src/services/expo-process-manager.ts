import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { env } from '../config/index.js';
import { ensureRepo } from '../git/git-service.js';

const isWindows = os.platform() === 'win32';

interface ExpoProcess {
  userId: string;
  port: number;
  proc: ChildProcess;
  startedAt: number;
}

const running: Record<string, ExpoProcess> = {};

function getExpoPort(userId: string): number {
  // Assign a static port per user (e.g. 9000 + hash)
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) % 1000;
  return 9000 + hash;
}

/**
 * Resolve the Expo CLI entry point.
 * Checks for node_modules/expo/bin/cli.js first, falls back to npx.
 */
function resolveExpoCli(appDir: string): { command: string; args: string[] } {
  // Check local expo CLI (with and without .js extension)
  for (const name of ['cli.js', 'cli']) {
    const local = path.join(appDir, 'node_modules', 'expo', 'bin', name);
    if (fs.existsSync(local)) {
      return { command: process.execPath, args: [local] };
    }
  }

  // Fall back to npx expo (works cross-platform)
  const npxBin = isWindows ? 'npx.cmd' : 'npx';
  return { command: npxBin, args: ['expo'] };
}

export async function startExpo(userId: string, repoRoot: string): Promise<{ port: number; alreadyRunning: boolean }> {
  const port = getExpoPort(userId);
  if (running[userId]) {
    return { port, alreadyRunning: true };
  }

  // Ensure repo and app directory exist
  const repoPath = await ensureRepo(userId, 'codeit-app');
  const appDir = repoPath;

  // Install dependencies if expo is not present
  const expoDir = path.join(appDir, 'node_modules', 'expo');
  if (!fs.existsSync(expoDir)) {
    console.log(`[ExpoProcess] Installing dependencies in ${appDir}...`);
    execSync('npm install', { cwd: appDir, stdio: 'inherit' });
  }

  const { command, args } = resolveExpoCli(appDir);
  const fullArgs = [...args, 'start', '--web', '--port', String(port), '--host', 'localhost'];
  console.log(`[ExpoProcess] Starting: ${command} ${fullArgs.join(' ')} (cwd: ${appDir})`);

  const proc = spawn(command, fullArgs, {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWindows,
    env: { ...process.env, PORT: String(port), BROWSER: 'none' },
    ...(isWindows ? { shell: false } : {}),
  });

  // Log stdout/stderr for debugging
  proc.stdout?.on('data', (data: Buffer) => {
    console.log(`[Expo:${userId}] ${data.toString().trim()}`);
  });
  proc.stderr?.on('data', (data: Buffer) => {
    console.error(`[Expo:${userId}] ${data.toString().trim()}`);
  });

  proc.on('error', (err) => {
    console.error(`[ExpoProcess] Failed to start for user ${userId}:`, err);
    delete running[userId];
  });
  proc.on('exit', (code, signal) => {
    console.log(`[ExpoProcess] Exited for user ${userId} code=${code} signal=${signal}`);
    delete running[userId];
  });

  running[userId] = { userId, port, proc, startedAt: Date.now() };
  proc.unref();
  return { port, alreadyRunning: false };
}

export function stopExpo(userId: string): boolean {
  const p = running[userId];
  if (!p) return false;

  console.log(`[ExpoProcess] Stopping for user ${userId} (pid: ${p.proc.pid})`);

  if (isWindows) {
    // On Windows, SIGTERM is unreliable; use taskkill for the process tree
    try {
      execSync(`taskkill /pid ${p.proc.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      p.proc.kill();
    }
  } else {
    // On Unix, kill the detached process group
    try {
      process.kill(-p.proc.pid!, 'SIGTERM');
    } catch {
      p.proc.kill('SIGTERM');
    }
  }
  delete running[userId];
  return true;
}

export function getExpoUrl(userId: string): string {
  const port = getExpoPort(userId);

  // In development, return direct localhost URL for testing
  if (env.NODE_ENV === 'development') {
    return `http://localhost:${port}`;
  }

  // In production, use the reverse proxy URL
  return `https://codeit.brickvue.com/u/${userId}`;
  // If your proxy is not set up, you can also return the direct port for testing:
  // return `http://localhost:${port}`;
}

/**
 * Stop all running Expo processes (used during graceful shutdown).
 */
export function stopAllExpo(): void {
  for (const userId of Object.keys(running)) {
    stopExpo(userId);
  }
}
