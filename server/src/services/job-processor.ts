import type { Job } from '../types/index.js';
import { jobQueue } from '../queue/index.js';
import { executeAI } from '../ai/index.js';
import { ensureRepo, createBranch, commitAndPush, listFiles, readRepoFile } from '../git/index.js';
import { applyOperations } from './patch-service.js';
import { validateRepo } from './container-service.js';

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

  try {
    // Step 1: Ensure repo
    jobQueue.updateStatus(job.id, 'processing', { message: 'Setting up repository...' });
    const repoPath = await ensureRepo(job.userId, job.repoName);

    // Step 2: Create branch
    await createBranch(repoPath, job.branch);

    // Step 3: Gather context
    jobQueue.updateStatus(job.id, 'ai_calling', { message: 'Analyzing project and calling AI...' });
    const files = await listFiles(repoPath);

    // Read relevant files for context (limit to avoid token overflow)
    const relevantFiles = selectRelevantFiles(files, job.prompt);
    const fileContents: Record<string, string> = {};

    for (const file of relevantFiles) {
      try {
        fileContents[file] = await readRepoFile(repoPath, file);
      } catch {
        // Skip unreadable files
      }
    }

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

    // Step 5: Apply patches
    jobQueue.updateStatus(job.id, 'applying', { message: 'Applying changes...' });
    const applyResult = await applyOperations(repoPath, aiResult.operations);

    if (applyResult.errors.length > 0) {
      console.warn(`[Worker] Patch errors:`, applyResult.errors);
    }

    if (applyResult.applied.length === 0) {
      throw new Error('No operations could be applied: ' + applyResult.errors.join('; '));
    }

    // Step 6: Validate (TypeScript check)
    const validation = await validateRepo(repoPath);
    if (!validation.success) {
      console.warn(`[Worker] Validation warnings:`, validation.stderr);
      // We don't fail on validation errors — log them but continue
    }

    // Step 7: Commit & push
    jobQueue.updateStatus(job.id, 'committing', { message: 'Committing changes...' });
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
    jobQueue.updateStatus(job.id, 'failed', { error: errorMsg });
  }
}

/**
 * Select the most relevant files for AI context based on the prompt.
 * Prioritizes screens, components, and recently modified files.
 */
function selectRelevantFiles(files: string[], prompt: string): string[] {
  const MAX_FILES = 15;
  const promptLower = prompt.toLowerCase();

  // Priority files
  const scored = files
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.json'))
    .map((f) => {
      let score = 0;
      const fLower = f.toLowerCase();

      // Boost files that seem related to the prompt
      const words = promptLower.split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && fLower.includes(word)) score += 3;
      }

      // Boost key structural files
      if (fLower.includes('screen')) score += 2;
      if (fLower.includes('component')) score += 2;
      if (fLower.includes('navigation') || fLower.includes('_layout')) score += 2;
      if (fLower.includes('hook')) score += 1;
      if (fLower.includes('service')) score += 1;
      if (fLower.includes('theme')) score += 1;
      if (fLower.includes('index')) score += 1;

      return { file: f, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_FILES).map((s) => s.file);
}
