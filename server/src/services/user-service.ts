import {
  createUser as dbCreateUser,
  getUserByUsername as dbGetUserByUsername,
  getUserById as dbGetUserById,
  verifyUser as dbVerifyUser,
} from '../db/index.js';

export type { DbUser as User } from '../db/index.js';

export async function createUser(username: string, password: string) {
  const user = await dbCreateUser(username, password);
  return { id: user.id, username: user.username };
}

export async function getUserByUsername(username: string) {
  return dbGetUserByUsername(username);
}

export async function getUserById(id: string) {
  return dbGetUserById(id);
}

export async function verifyUser(username: string, password: string) {
  const user = await dbVerifyUser(username, password);
  if (!user) return null;
  return { id: user.id, username: user.username };
}
