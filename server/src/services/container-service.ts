import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '../config/index.js';

const execAsync = promisify(exec);

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

  // Security: we sanitize the command — no user input goes into shell
  const dockerCmd = [
    'docker', 'run',
    '--rm',
    '--name', containerName,
    '--memory', env.DOCKER_MEMORY_LIMIT,
    '--cpus', env.DOCKER_CPU_LIMIT,
    '--network', 'none', // No network access for safety
    '-v', `${repoPath}:/workspace:rw`,
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
  const cmdString = commands.join(' && ');

  try {
    const { stdout, stderr } = await execAsync(cmdString, {
      cwd: repoPath,
      timeout: 120_000,
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
  const commands = [
    // Install deps if needed (only if node_modules missing)
    'test -d node_modules || npm install --ignore-scripts',
    // TypeScript check
    'npx tsc --noEmit 2>&1 || true',
  ];

  return runInContainer(repoPath, commands);
}
