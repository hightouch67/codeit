import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  username: string;
  password: string; // In production, hash this!
}

const users: User[] = [];

export function createUser(username: string, password: string): User {
  const user: User = { id: uuidv4(), username, password };
  users.push(user);
  return user;
}

export function verifyUser(username: string, password: string): User | null {
  return users.find((u) => u.username === username && u.password === password) || null;
}

export function getUserByUsername(username: string): User | undefined {
  return users.find((u) => u.username === username);
}

export { users };
