import { Router, Request, Response } from 'express';
import { jobQueue } from '../queue/index.js';
import { jobRequestSchema } from '../validators/index.js';

const router = Router();

/**
 * POST /api/jobs — Create a new AI job
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const parsed = jobRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.flatten(),
      });
      return;
    }

    const job = jobQueue.enqueue(parsed.data);

    res.status(201).json({
      jobId: job.id,
      status: job.status,
      branch: job.branch,
    });
  } catch (err) {
    console.error('[API] Error creating job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/jobs/:id — Get job status
 */
router.get('/:id', (req: Request, res: Response) => {
  const job = jobQueue.getJob(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    jobId: job.id,
    status: job.status,
    message: job.message,
    error: job.error,
    commitSha: job.commitSha,
    operations: job.operations,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

export { router as jobsRouter };
