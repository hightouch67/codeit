import { Router, Request, Response } from 'express';
import { jobQueue } from '../queue/index.js';
import { jobRequestSchema } from '../validators/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = jobRequestSchema.safeParse({
      ...req.body,
      userId: req.auth!.userId,
    });

    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.flatten(),
      });
      return;
    }

    const job = await jobQueue.enqueue({
      ...parsed.data,
      userId: req.auth!.userId,
    });

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

router.get('/', (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const jobs = jobQueue.getJobsByUser(userId);
  res.json(
    jobs.map((j) => ({
      jobId: j.id,
      status: j.status,
      message: j.message,
      error: j.error,
      prompt: j.prompt.substring(0, 100),
      commitSha: j.commitSha,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    })),
  );
});

router.get('/:id', (req: Request, res: Response) => {
  const job = jobQueue.getJob(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  if (job.userId !== req.auth!.userId) {
    res.status(403).json({ error: 'Forbidden' });
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
