import { config } from '../utils/config';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API ${res.status}: ${errBody}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
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
