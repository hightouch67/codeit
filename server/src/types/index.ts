export type OperationType = 'create_file' | 'update_file' | 'delete_file';

export interface FileOperation {
  type: OperationType;
  path: string;
  content?: string;
  diff?: string;
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

export type JobStatusType =
  | 'queued'
  | 'processing'
  | 'ai_calling'
  | 'validating'
  | 'applying'
  | 'committing'
  | 'completed'
  | 'failed';

export interface Job {
  id: string;
  userId: string;
  prompt: string;
  repoName: string;
  branch: string;
  status: JobStatusType;
  message?: string;
  operations?: FileOperation[];
  commitSha?: string;
  error?: string;
  retries: number;
  createdAt: number;
  updatedAt: number;
}

export interface WSMessage {
  type: 'job_update' | 'chat_message' | 'log' | 'error';
  payload: unknown;
}
