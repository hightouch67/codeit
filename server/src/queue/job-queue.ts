import { v4 as uuidv4 } from 'uuid';
import type { Job, JobStatusType, JobRequest } from '../types/index.js';
import { insertJob, updateJobStatus } from '../db/index.js';

type JobUpdateCallback = (job: Job) => void;

const JOB_TTL = 60 * 60 * 1000; // 1 hour

class JobQueue {
  private jobs = new Map<string, Job>();
  private queue: string[] = [];
  private processing = false;
  private onUpdate: JobUpdateCallback | null = null;
  private processor: ((job: Job) => Promise<void>) | null = null;

  constructor() {
    setInterval(() => this.purgeExpired(), 10 * 60 * 1000).unref();
  }

  setProcessor(fn: (job: Job) => Promise<void>): void {
    this.processor = fn;
  }

  setOnUpdate(fn: JobUpdateCallback): void {
    this.onUpdate = fn;
  }

  async enqueue(request: JobRequest): Promise<Job> {
    const job: Job = {
      id: uuidv4(),
      userId: request.userId,
      prompt: request.prompt,
      repoName: request.repoName,
      branch: request.branch ?? `ai/${Date.now()}`,
      status: 'queued',
      retries: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.jobs.set(job.id, job);
    this.queue.push(job.id);

    await insertJob({
      id: job.id,
      userId: job.userId,
      prompt: job.prompt,
      repoName: job.repoName,
      branch: job.branch,
    }).catch((err) => console.error('[Queue] DB insert failed:', err));

    console.log(`[Queue] Job ${job.id} enqueued. Queue size: ${this.queue.length}`);
    this.processNext();
    return job;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  getJobsByUser(userId: string): Job[] {
    const result: Job[] = [];
    for (const job of this.jobs.values()) {
      if (job.userId === userId) result.push(job);
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  updateJob(id: string, updates: Partial<Job>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    Object.assign(job, updates, { updatedAt: Date.now() });
    this.onUpdate?.(job);

    updateJobStatus(id, job.status, {
      message: job.message,
      error: job.error,
      commitSha: job.commitSha,
      operationsJson: job.operations ? JSON.stringify(job.operations) : undefined,
    }).catch((err) => console.error('[Queue] DB update failed:', err));

    return job;
  }

  updateStatus(id: string, status: JobStatusType, extra?: Partial<Job>): Job | undefined {
    return this.updateJob(id, { status, ...extra });
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0 || !this.processor) return;

    this.processing = true;
    const jobId = this.queue.shift()!;
    const job = this.jobs.get(jobId);

    if (job) {
      try {
        await this.processor(job);
      } catch (err) {
        console.error(`[Queue] Job ${job.id} processor error:`, err);
        this.updateStatus(job.id, 'failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.processing = false;
    this.processNext();
  }

  stats(): { total: number; queued: number; processing: number; completed: number; failed: number } {
    let queued = 0, processing = 0, completed = 0, failed = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'queued') queued++;
      else if (job.status === 'failed') failed++;
      else if (job.status === 'completed') completed++;
      else processing++;
    }
    return { total: this.jobs.size, queued, processing, completed, failed };
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if ((job.status === 'completed' || job.status === 'failed') && now - job.updatedAt > JOB_TTL) {
        this.jobs.delete(id);
      }
    }
  }
}

export const jobQueue = new JobQueue();
