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
    let msg = `API ${res.status}`;
    try { msg = JSON.parse(errBody).error ?? msg; } catch { msg = errBody || msg; }
    throw new Error(msg);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) => request<T>(path, { headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>(path, { method: 'POST', body, headers }),
  baseUrl: config.apiUrl,
};

export interface SendPromptPayload {
  prompt: string;
  repoName: string;
}

export interface SendPromptResponse {
  jobId: string;
}

export function sendPrompt(payload: SendPromptPayload, token: string): Promise<SendPromptResponse> {
  return api.post('/api/jobs', payload, { Authorization: `Bearer ${token}` });
}
