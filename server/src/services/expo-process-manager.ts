import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ensureRepo } from '../git/git-service.js';

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

export async function startExpo(userId: string, repoRoot: string): Promise<{ port: number; alreadyRunning: boolean }> {
  const port = getExpoPort(userId);
  if (running[userId]) {
    // Already running
    return { port, alreadyRunning: true };
  }
  // Ensure repo and app directory exist
  const repoPath = await ensureRepo(userId, 'codeit-app');
  const appDir = repoPath;
  // Ensure node_modules/expo/bin/cli.js exists
  const expoCli = path.join(appDir, 'node_modules', 'expo', 'bin', 'cli');
  if (!fs.existsSync(expoCli)) {
    // Run npm install if missing
    execSync('npm install', { cwd: appDir, stdio: 'inherit' });
  }
  const nodePath = '/usr/bin/node';
  const proc = spawn(nodePath, [expoCli, 'start', '--web', '--port', String(port), '--host', 'localhost'], {
    cwd: appDir,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, PORT: String(port) },
  });
  // Add error and exit listeners for diagnostics
  proc.on('error', (err) => {
    console.error(`[ExpoProcess] Failed to start for user ${userId}:`, err);
  });
  proc.on('exit', (code, signal) => {
    console.error(`[ExpoProcess] Exited for user ${userId} with code ${code}, signal ${signal}`);
  });
  running[userId] = { userId, port, proc, startedAt: Date.now() };
  proc.unref();
  return { port, alreadyRunning: false };
}

export function stopExpo(userId: string): boolean {
  const p = running[userId];
  if (!p) return false;
  p.proc.kill('SIGTERM');
  delete running[userId];
  return true;
}

export function getExpoUrl(userId: string): string {
  // Use a public URL for web redirection that matches the proxy config
  // e.g. codeit.brickvue.com/u/<userId> proxies to localhost:<port>
  const port = getExpoPort(userId);
  return `https://codeit.brickvue.com/u/${userId}`;
  // If your proxy is not set up, you can also return the direct port for testing:
  // return `http://localhost:${port}`;
}
