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
    throw new Error(`API ${res.status}: ${errBody}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) => request<T>(path, { headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>(path, { method: 'PUT', body, headers }),
  del: <T>(path: string, headers?: Record<string, string>) => request<T>(path, { method: 'DELETE', headers }),
  baseUrl: config.apiUrl,
};

export interface SendPromptPayload {
  userId: string;
  prompt: string;
  repoName: string;
}

export interface SendPromptResponse {
  jobId: string;
}

export function sendPrompt(payload: SendPromptPayload): Promise<SendPromptResponse> {
  return api.post('/api/jobs', payload);
}

export function getJobStatus(jobId: string) {
  return api.get(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export function getJobHistory(userId: string) {
  return api.get<Array<{ jobId: string; status: string; message?: string; createdAt: number }>>(`/api/jobs?userId=${encodeURIComponent(userId)}`);
}
