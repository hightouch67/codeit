import { v4 as uuidv4 } from 'uuid';
import type { Job, JobStatusType, JobRequest } from '../types/index.js';

type JobUpdateCallback = (job: Job) => void;

/**
 * Simple in-memory job queue.
 * Replace with Redis/BullMQ for production scale.
 */
class JobQueue {
  private jobs = new Map<string, Job>();
  private queue: string[] = [];
  private processing = false;
  private onUpdate: JobUpdateCallback | null = null;
  private processor: ((job: Job) => Promise<void>) | null = null;

  setProcessor(fn: (job: Job) => Promise<void>): void {
    this.processor = fn;
  }

  setOnUpdate(fn: JobUpdateCallback): void {
    this.onUpdate = fn;
  }

  enqueue(request: JobRequest): Job {
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
    console.log(`[Queue] Job ${job.id} enqueued. Queue size: ${this.queue.length}`);

    // Start processing if not already
    this.processNext();

    return job;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, updates: Partial<Job>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    Object.assign(job, updates, { updatedAt: Date.now() });
    this.onUpdate?.(job);
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
    // Process next job in queue
    this.processNext();
  }
}

// Singleton
export const jobQueue = new JobQueue();
