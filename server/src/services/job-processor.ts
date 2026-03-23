import type { Job } from '../types/index.js';
import { jobQueue } from '../queue/index.js';
import { executeAI } from '../ai/index.js';
import { ensureRepo, createBranch, commitAndPush, listFiles, readRepoFile } from '../git/index.js';
import { applyOperations } from './patch-service.js';
import { validateRepo } from './container-service.js';
import { wsManager } from '../middleware/index.js';

/**
 * Processes a single job through the full pipeline:
 * 1. Ensure repo exists
 * 2. Create branch
 * 3. Gather file context
 * 4. Call AI
 * 5. Apply patches
 * 6. Validate
 * 7. Commit & push
 */
export async function processJob(job: Job): Promise<void> {
  console.log(`[Worker] Processing job ${job.id}: "${job.prompt}"`);

  const log = (msg: string) => {
    wsManager.sendToUser(job.userId, { type: 'log', payload: msg });
  };

  try {
    // Step 1: Ensure repo
    jobQueue.updateStatus(job.id, 'processing', { message: 'Setting up repository...' });
    log('Setting up repository...');
    const repoPath = await ensureRepo(job.userId, job.repoName);

    // Step 2: Create branch
    log('Creating branch...');
    await createBranch(repoPath, job.branch);

    // Step 3: Gather context
    jobQueue.updateStatus(job.id, 'ai_calling', { message: 'Analyzing project and calling AI...' });
    log('Analyzing project files...');
    const files = await listFiles(repoPath);

    // Read relevant files for context (limit to avoid token overflow)
    const relevantFiles = selectRelevantFiles(files, job.prompt);
    const fileContents: Record<string, string> = {};

    for (const file of relevantFiles) {
      try {
        const content = await readRepoFile(repoPath, file);
        // Skip very large files (>10KB) to avoid token overflow
        if (content.length <= 10_000) {
          fileContents[file] = content;
        }
      } catch {
        // Skip unreadable files
      }
    }

    log(`Sending ${Object.keys(fileContents).length} files as context to AI...`);

    // Step 4: Call AI
    const aiResult = await executeAI({
      userPrompt: job.prompt,
      existingFiles: files,
      fileContents,
    });

    jobQueue.updateStatus(job.id, 'validating', {
      message: `AI returned ${aiResult.operations.length} operations. Validating...`,
      operations: aiResult.operations,
    });
    log(`AI generated ${aiResult.operations.length} file changes: ${aiResult.summary}`);

    // Step 5: Apply patches
    jobQueue.updateStatus(job.id, 'applying', { message: 'Applying changes...' });
    log('Applying changes to files...');
    const applyResult = await applyOperations(repoPath, aiResult.operations);

    if (applyResult.errors.length > 0) {
      console.warn(`[Worker] Patch errors:`, applyResult.errors);
      log(`Warning: ${applyResult.errors.length} operation(s) had issues`);
    }

    if (applyResult.applied.length === 0) {
      throw new Error('No operations could be applied: ' + applyResult.errors.join('; '));
    }

    log(`Applied ${applyResult.applied.length} changes successfully`);

    // Step 6: Validate (TypeScript check)
    log('Validating TypeScript...');
    const validation = await validateRepo(repoPath);
    if (!validation.success) {
      console.warn(`[Worker] Validation warnings:`, validation.stderr);
      log('TypeScript check found warnings (non-blocking)');
    } else {
      log('TypeScript validation passed');
    }

    // Step 7: Commit & push
    jobQueue.updateStatus(job.id, 'committing', { message: 'Committing changes...' });
    log('Committing changes...');
    const commitMessage = `ai: ${aiResult.summary}\n\nPrompt: ${job.prompt.substring(0, 200)}`;
    const sha = await commitAndPush(repoPath, commitMessage, true);

    // Done — report partial failures clearly
    const patchWarning = applyResult.errors.length > 0
      ? ` (${applyResult.errors.length} file(s) skipped: ${applyResult.errors.join('; ')})`
      : '';

    jobQueue.updateStatus(job.id, 'completed', {
      commitSha: sha,
      message: aiResult.summary + patchWarning,
    });

    if (applyResult.errors.length > 0) {
      console.warn(`[Worker] Job ${job.id} completed with patch errors:`, applyResult.errors);
    } else {
      console.log(`[Worker] Job ${job.id} completed successfully. Commit: ${sha}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Job ${job.id} failed: ${errorMsg}`);
    log(`Job failed: ${errorMsg}`);
    jobQueue.updateStatus(job.id, 'failed', { error: errorMsg });
  }
}

/**
 * Select the most relevant files for AI context based on the prompt.
 * Prioritizes screens, components, config files, and files matching prompt keywords.
 */
function selectRelevantFiles(files: string[], prompt: string): string[] {
  const MAX_FILES = 20;
  const promptLower = prompt.toLowerCase();
  // Extract meaningful words (4+ chars)
  const keywords = promptLower.split(/\s+/).filter((w) => w.length >= 4);

  const scored = files
    .filter((f) => {
      const ext = f.split('.').pop()?.toLowerCase();
      return ['ts', 'tsx', 'json', 'js', 'jsx'].includes(ext ?? '');
    })
    .map((f) => {
      let score = 0;
      const fLower = f.toLowerCase();
      const fileName = fLower.split('/').pop() ?? '';

      // Keyword matching (strongest signal)
      for (const word of keywords) {
        if (fLower.includes(word)) score += 5;
        if (fileName.includes(word)) score += 3; // bonus for filename match
      }

      // Boost key structural files
      if (fLower.includes('screen')) score += 3;
      if (fLower.includes('component')) score += 3;
      if (fLower.includes('navigation') || fLower.includes('_layout')) score += 3;
      if (fLower.includes('hook')) score += 2;
      if (fLower.includes('service')) score += 2;
      if (fLower.includes('context')) score += 2;
      if (fLower.includes('theme')) score += 1;
      if (fLower.includes('utils') || fLower.includes('helpers')) score += 1;
      if (fileName === 'index.ts' || fileName === 'index.tsx') score += 1;

      // Config files are always useful
      if (fileName === 'app.json' || fileName === 'tsconfig.json') score += 2;
      if (fileName === 'package.json') score += 1;

      return { file: f, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_FILES).map((s) => s.file);
}
