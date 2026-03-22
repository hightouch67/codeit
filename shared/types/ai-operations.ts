// Shared AI operation types used by both server and client

export type OperationType = 'create_file' | 'update_file' | 'delete_file';

export interface FileOperation {
  type: OperationType;
  path: string;
  content?: string; // Full content for create_file
  diff?: string;    // Unified diff for update_file
}

export interface AIResponse {
  operations: FileOperation[];
  summary: string;
  reasoning?: string;
}

export interface JobRequest {
  userId: string;
  prompt: string;
  repoName: string;
  branch?: string;
}

export interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'ai_calling' | 'validating' | 'applying' | 'committing' | 'completed' | 'failed';
  message?: string;
  operations?: FileOperation[];
  commitSha?: string;
  error?: string;
  prompt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  jobId?: string;
  status?: JobStatus['status'];
}

export interface WSMessage {
  type: 'job_update' | 'chat_message' | 'log' | 'error';
  payload: JobStatus | ChatMessage | string;
}

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
