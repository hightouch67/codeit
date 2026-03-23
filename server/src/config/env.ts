import 'dotenv/config';
import path from 'node:path';
import os from 'node:os';

export const env = {
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  // Auth
  JWT_SECRET: process.env.JWT_SECRET ?? 'changeme-in-production',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',

  // AI provider
  AI_BASE_URL: process.env.AI_BASE_URL ?? 'http://localhost:11434',
  AI_MODEL: process.env.AI_MODEL ?? 'qwen3.5',
  AI_API_KEY: process.env.AI_API_KEY ?? '',

  // Git
  GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '',
  GITHUB_ORG: process.env.GITHUB_ORG ?? '',
  GIT_REPOS_DIR: process.env.GIT_REPOS_DIR ?? path.join(os.tmpdir(), 'codeit-repos'),

  // Boilerplate path
  BOILERPLATE_DIR: process.env.BOILERPLATE_DIR ?? '../boilerplate',

  // Docker
  DOCKER_ENABLED: process.env.DOCKER_ENABLED === 'true',
  DOCKER_IMAGE: process.env.DOCKER_IMAGE ?? 'codeit-workspace:latest',
  DOCKER_MEMORY_LIMIT: process.env.DOCKER_MEMORY_LIMIT ?? '512m',
  DOCKER_CPU_LIMIT: process.env.DOCKER_CPU_LIMIT ?? '0.5',

  // Job
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES ?? '2', 10),

  // MySQL Database
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT ?? '3306', 10),
  DB_USER: process.env.DB_USER ?? 'codeit',
  DB_PASSWORD: process.env.DB_PASSWORD ?? '',
  DB_NAME: process.env.DB_NAME ?? 'codeit',

  // App domain for per-user subdomain URLs
  CODEIT_DOMAIN: process.env.CODEIT_DOMAIN ?? 'codeit.example.com',
} as const;
