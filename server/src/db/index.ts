export { getPool, closePool } from './connection.js';
export { initDatabase } from './schema.js';
export { createUser, getUserByUsername, getUserById, verifyUser } from './user-queries.js';
export type { DbUser } from './user-queries.js';
export { insertJob, updateJobStatus, getJobById, getJobsByUserId } from './job-queries.js';
export type { DbJob } from './job-queries.js';
export { createApp, getAppByUserAndRepo, getAppBySubdomain, getAppBySubdomainWithPort, updateAppSubdomain, updateAppPort, clearAppPid, getAppsByUserId } from './app-queries.js';
export type { DbApp } from './app-queries.js';
