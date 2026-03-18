/**
 * File-access whitelist: only these directories are allowed for AI operations.
 * Paths are relative to the repo root.
 */
export const ALLOWED_PATHS = [
  'components/',
  'screens/',
  'hooks/',
  'services/',
  'navigation/',
  'theme/',
  'utils/',
  'app/',
  'assets/',
  'lib/',
  'src/',
] as const;

/**
 * Files that the AI is NEVER allowed to modify.
 */
export const BLOCKED_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'eas.json',
  'package-lock.json',
  'yarn.lock',
  'node_modules/',
] as const;

/**
 * File extensions allowed for AI operations.
 */
export const ALLOWED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
  '.md',
] as const;
