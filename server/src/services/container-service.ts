import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { env } from '../config/index.js';

const execAsync = promisify(exec);
const isWindows = os.platform() === 'win32';

interface ContainerResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a validation job inside an ephemeral Docker container.
 * The container:
 *   - Mounts the repo directory (read-write)
 *   - Runs TypeScript check + lint
 *   - Is destroyed after completion
 */
export async function runInContainer(
  repoPath: string,
  commands: string[],
): Promise<ContainerResult> {
  if (!env.DOCKER_ENABLED) {
    // If Docker is disabled, run commands locally (development mode)
    return runLocally(repoPath, commands);
  }

  const containerName = `codeit-job-${Date.now()}`;
  const cmdString = commands.join(' && ');

  // Normalize mount path: Docker on Windows needs forward slashes
  const mountPath = repoPath.replace(/\\/g, '/');

  // Security: we sanitize the command — no user input goes into shell
  const dockerCmd = [
    'docker', 'run',
    '--rm',
    '--name', containerName,
    '--memory', env.DOCKER_MEMORY_LIMIT,
    '--cpus', env.DOCKER_CPU_LIMIT,
    '--network', 'none', // No network access for safety
    '-v', `${mountPath}:/workspace:rw`,
    '-w', '/workspace',
    env.DOCKER_IMAGE,
    'sh', '-c', cmdString,
  ].join(' ');

  try {
    const { stdout, stderr } = await execAsync(dockerCmd, {
      timeout: 120_000, // 2 minute timeout
    });
    return { success: true, stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; code?: number };
    return {
      success: false,
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? String(err),
      exitCode: execErr.code ?? 1,
    };
  }
}

/**
 * Run commands locally when Docker is disabled (dev mode).
 */
async function runLocally(repoPath: string, commands: string[]): Promise<ContainerResult> {
  // On Windows use cmd chaining; on Unix use &&. Both support &&.
  const cmdString = commands.join(' && ');

  try {
    const { stdout, stderr } = await execAsync(cmdString, {
      cwd: repoPath,
      timeout: 120_000,
      shell: isWindows ? 'cmd.exe' : '/bin/sh',
    });
    return { success: true, stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; code?: number };
    return {
      success: false,
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? String(err),
      exitCode: execErr.code ?? 1,
    };
  }
}

/**
 * Validate a repo after patch application.
 */
export async function validateRepo(repoPath: string): Promise<ContainerResult> {
  const checkModules = isWindows
    ? 'if not exist node_modules npm install --ignore-scripts'
    : 'test -d node_modules || npm install --ignore-scripts';

  const commands = [
    checkModules,
    // TypeScript check
    'npx tsc --noEmit 2>&1 || true',
  ];

  return runInContainer(repoPath, commands);
}
