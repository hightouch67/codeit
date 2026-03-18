import fs from 'node:fs/promises';
import path from 'node:path';
import { applyPatch } from 'diff';
import type { FileOperation } from '../types/index.js';
import { validateFilePath } from '../validators/index.js';

interface ApplyResult {
  success: boolean;
  applied: string[];
  errors: string[];
}

/**
 * Apply a list of file operations to a repository directory.
 */
export async function applyOperations(
  repoPath: string,
  operations: FileOperation[],
): Promise<ApplyResult> {
  const applied: string[] = [];
  const errors: string[] = [];

  for (const op of operations) {
    // Double-check path safety
    const check = validateFilePath(op.path);
    if (!check.valid) {
      errors.push(`Blocked: ${op.path} — ${check.reason}`);
      continue;
    }

    const fullPath = path.join(repoPath, op.path);
    // Ensure we don't escape the repo
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(repoPath))) {
      errors.push(`Path traversal blocked: ${op.path}`);
      continue;
    }

    try {
      switch (op.type) {
        case 'create_file': {
          if (!op.content) {
            errors.push(`create_file missing content: ${op.path}`);
            break;
          }
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, op.content, 'utf-8');
          applied.push(`Created: ${op.path}`);
          break;
        }

        case 'update_file': {
          const exists = await fs.access(fullPath).then(() => true).catch(() => false);
          if (!exists) {
            // If file doesn't exist and we have content, create it
            if (op.content) {
              await fs.mkdir(path.dirname(fullPath), { recursive: true });
              await fs.writeFile(fullPath, op.content, 'utf-8');
              applied.push(`Created (update fallback): ${op.path}`);
            } else {
              errors.push(`update_file target not found: ${op.path}`);
            }
            break;
          }

          if (op.diff) {
            // Apply unified diff
            const original = await fs.readFile(fullPath, 'utf-8');
            const patched = applyPatch(original, op.diff);

            if (patched === false) {
              // Diff failed to apply — fall back to content if available
              if (op.content) {
                await fs.writeFile(fullPath, op.content, 'utf-8');
                applied.push(`Updated (content fallback): ${op.path}`);
              } else {
                errors.push(`Diff failed to apply: ${op.path}`);
              }
            } else {
              await fs.writeFile(fullPath, patched, 'utf-8');
              applied.push(`Updated (diff): ${op.path}`);
            }
          } else if (op.content) {
            await fs.writeFile(fullPath, op.content, 'utf-8');
            applied.push(`Updated (content): ${op.path}`);
          } else {
            errors.push(`update_file has no diff or content: ${op.path}`);
          }
          break;
        }

        case 'delete_file': {
          const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
          if (fileExists) {
            await fs.unlink(fullPath);
            applied.push(`Deleted: ${op.path}`);
          } else {
            errors.push(`delete_file target not found: ${op.path}`);
          }
          break;
        }

        default:
          errors.push(`Unknown operation type: ${(op as FileOperation).type}`);
      }
    } catch (err) {
      errors.push(`Error on ${op.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    success: errors.length === 0,
    applied,
    errors,
  };
}
