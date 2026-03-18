import simpleGit, { SimpleGit } from 'simple-git';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../config/index.js';

/**
 * Get the local path for a user's repo.
 */
export function getRepoPath(userId: string, repoName: string): string {
  // Sanitize to prevent path traversal
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeRepoName = repoName.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(env.GIT_REPOS_DIR, safeUserId, safeRepoName);
}

/**
 * Initialize or clone a repo for a user.
 * If the repo doesn't exist locally, copies from boilerplate.
 */
export async function ensureRepo(userId: string, repoName: string): Promise<string> {
  const repoPath = getRepoPath(userId, repoName);

  const exists = await fs.access(repoPath).then(() => true).catch(() => false);

  if (!exists) {
    console.log(`[Git] Initializing new repo at ${repoPath}`);
    await fs.mkdir(repoPath, { recursive: true });

    // Copy boilerplate
    const boilerplatePath = path.resolve(env.BOILERPLATE_DIR);
    await copyDir(boilerplatePath, repoPath);

    // Initialize git
    const git = simpleGit(repoPath);
    await git.init();
    await git.add('.');
    await git.commit('Initial commit from CodeIt boilerplate');

    // If GitHub token is configured, set up remote
    if (env.GITHUB_TOKEN && env.GITHUB_ORG) {
      const remoteUrl = `https://${env.GITHUB_TOKEN}@github.com/${env.GITHUB_ORG}/${safeRepoId(userId, repoName)}.git`;
      await git.addRemote('origin', remoteUrl).catch(() => {
        // Remote might already exist
      });
    }
  }

  return repoPath;
}

function safeRepoId(userId: string, repoName: string): string {
  return `${userId.replace(/[^a-zA-Z0-9_-]/g, '')}-${repoName.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Create a branch for this job.
 */
export async function createBranch(repoPath: string, branchName: string): Promise<void> {
  const git = simpleGit(repoPath);
  const branches = await git.branchLocal();

  if (branches.all.includes(branchName)) {
    await git.checkout(branchName);
  } else {
    await git.checkoutLocalBranch(branchName);
  }
  console.log(`[Git] On branch: ${branchName}`);
}

/**
 * Stage, commit, and optionally push changes.
 */
export async function commitAndPush(
  repoPath: string,
  message: string,
  push: boolean = false,
): Promise<string> {
  const git = simpleGit(repoPath);

  await git.add('.');
  const commitResult = await git.commit(message);
  const sha = commitResult.commit || 'unknown';
  console.log(`[Git] Committed: ${sha} — ${message}`);

  if (push && env.GITHUB_TOKEN) {
    try {
      const branch = (await git.branchLocal()).current;
      await git.push('origin', branch);
      console.log(`[Git] Pushed to origin/${branch}`);
    } catch (err) {
      console.error(`[Git] Push failed (non-fatal):`, err);
    }
  }

  return sha;
}

/**
 * List all tracked files in the repo (relative paths).
 */
export async function listFiles(repoPath: string): Promise<string[]> {
  const files: string[] = [];
  await walkDir(repoPath, repoPath, files);
  return files.filter(
    (f) => !f.startsWith('.git/') && !f.startsWith('node_modules/'),
  );
}

/**
 * Read a file from the repo.
 */
export async function readRepoFile(repoPath: string, filePath: string): Promise<string> {
  const fullPath = path.join(repoPath, filePath);
  // Security: ensure we don't escape the repo directory
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(repoPath))) {
    throw new Error('Path traversal attempt blocked');
  }
  return fs.readFile(fullPath, 'utf-8');
}

// ── Helpers ──

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function walkDir(dir: string, root: string, files: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath).replace(/\\/g, '/');

    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    if (entry.isDirectory()) {
      await walkDir(fullPath, root, files);
    } else {
      files.push(relativePath);
    }
  }
}
