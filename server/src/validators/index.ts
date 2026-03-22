import { z } from 'zod';
import path from 'node:path';
import { ALLOWED_PATHS, BLOCKED_FILES, ALLOWED_EXTENSIONS } from '../config/index.js';

// ── Schema for incoming job requests ──

export const jobRequestSchema = z.object({
  userId: z.string().min(1).max(100).optional(), // Optional in body — enforced from JWT
  prompt: z.string().min(1).max(5000),
  repoName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional().default('my-app'),
  branch: z.string().max(100).optional(),
});

// ── Schema for AI response validation ──

const fileOperationSchema = z.object({
  type: z.enum(['create_file', 'update_file', 'delete_file']),
  path: z.string().min(1).max(500),
  content: z.string().optional(),
  diff: z.string().optional(),
});

export const aiResponseSchema = z.object({
  operations: z.array(fileOperationSchema).min(1).max(20),
  summary: z.string().min(1).max(2000),
  reasoning: z.string().optional(),
});

// ── Security validation on file paths ──

export function validateFilePath(filePath: string): { valid: boolean; reason?: string } {
  // Normalize
  const normalized = path.normalize(filePath).replace(/\\/g, '/');

  // Block path traversal
  if (normalized.includes('..') || normalized.startsWith('/')) {
    return { valid: false, reason: 'Path traversal detected' };
  }

  // Block specific files
  for (const blocked of BLOCKED_FILES) {
    if (normalized === blocked || normalized.startsWith(blocked)) {
      return { valid: false, reason: `File is blocked: ${blocked}` };
    }
  }

  // Check extension
  const ext = path.extname(normalized);
  if (ext && !ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
    return { valid: false, reason: `Extension not allowed: ${ext}` };
  }

  // Check if path is within allowed directories
  const inAllowed = ALLOWED_PATHS.some((allowed) => normalized.startsWith(allowed));
  // Also allow root-level config files like app.json, tsconfig.json
  const isRootConfig = !normalized.includes('/') && (ext === '.json' || ext === '.ts' || ext === '.js');

  if (!inAllowed && !isRootConfig) {
    return { valid: false, reason: `Path not in allowed directories: ${normalized}` };
  }

  return { valid: true };
}

/**
 * Validate that an operation has required fields.
 */
export function validateOperation(op: z.infer<typeof fileOperationSchema>): { valid: boolean; reason?: string } {
  const pathCheck = validateFilePath(op.path);
  if (!pathCheck.valid) return pathCheck;

  if ((op.type === 'create_file' || op.type === 'update_file') && !op.content) {
    return { valid: false, reason: `${op.type} requires content for ${op.path}` };
  }

  return { valid: true };
}
