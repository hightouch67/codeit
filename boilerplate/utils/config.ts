import Constants from 'expo-constants';

// In production, the boilerplate always talks to the CodeIt API server.
// In development (running locally), fall back to localhost.
const DEFAULT_API = 'https://api.codeit.brickvue.com';
const DEFAULT_WS = 'wss://api.codeit.brickvue.com/ws';

const ENV = {
  API_URL: Constants.expoConfig?.extra?.apiUrl ?? DEFAULT_API,
  WS_URL: Constants.expoConfig?.extra?.wsUrl ?? DEFAULT_WS,
};

export const config = {
  apiUrl: ENV.API_URL,
  wsUrl: ENV.WS_URL,
} as const;

/** Read a query param from the current web URL (no-op on native) */
export function getUrlParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

/** Persist a value in sessionStorage (web) or fall back to a module-level variable */
const memStore: Record<string, string> = {};

export function storeSession(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { memStore[key] = value; }
}

export function getSession(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return memStore[key] ?? null; }
}
