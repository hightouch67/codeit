import { config } from '../utils/config';

let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const allHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Auto-attach auth token if available
  if (_authToken && !allHeaders['Authorization']) {
    allHeaders['Authorization'] = `Bearer ${_authToken}`;
  }

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: allHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `API ${res.status}`;
    try { msg = JSON.parse(errBody).error ?? msg; } catch { msg = errBody || msg; }
    throw new Error(msg);
  }

  return res.json();
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) => request<T>(path, { headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>(path, { method: 'PUT', body, headers }),
  del: <T>(path: string, headers?: Record<string, string>) => request<T>(path, { method: 'DELETE', headers }),
  baseUrl: config.apiUrl,
  authHeader,
};

export interface SendPromptPayload {
  prompt: string;
  repoName: string;
}

export interface SendPromptResponse {
  jobId: string;
}

export function sendPrompt(payload: SendPromptPayload, token: string): Promise<SendPromptResponse> {
  return api.post('/api/jobs', payload, authHeader(token));
}

export function getJobStatus(jobId: string, token: string) {
  return api.get(`/api/jobs/${encodeURIComponent(jobId)}`, authHeader(token));
}

export function getJobHistory(userId: string) {
  return api.get<Array<{ jobId: string; status: string; message?: string; createdAt: number }>>(`/api/jobs?userId=${encodeURIComponent(userId)}`);
}
