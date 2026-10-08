import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { idParamsSchema } from '../../utils/idParams.js';
import * as jobsController from './jobs.controller.js';
import { jobBodySchema, jobListQuerySchema, jobStatusBodySchema } from './jobs.schema.js';

export const jobsRouter = Router();

jobsRouter.use(requireAuth);

jobsRouter.get('/', validate({ query: jobListQuerySchema }), asyncHandler(jobsController.list));

jobsRouter.post('/', validate({ body: jobBodySchema }), asyncHandler(jobsController.create));

jobsRouter.get('/:id', validate({ params: idParamsSchema }), asyncHandler(jobsController.getById));

jobsRouter.post(
  '/:id/status',
  validate({ params: idParamsSchema, body: jobStatusBodySchema }),
  asyncHandler(jobsController.changeStatus),
);

jobsRouter.get(
  '/:id/history',
  validate({ params: idParamsSchema }),
  asyncHandler(jobsController.getHistory),
);

jobsRouter.put(
  '/:id',
  validate({ params: idParamsSchema, body: jobBodySchema }),
  asyncHandler(jobsController.update),
);
