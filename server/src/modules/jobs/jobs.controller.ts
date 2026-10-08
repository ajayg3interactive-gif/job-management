import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../../config/constants.js';
import { AppError } from '../../utils/AppError.js';
import type { IdParams } from '../../utils/idParams.js';
import type { JobBody, JobListQuery, JobStatusBody } from './jobs.schema.js';
import * as jobsService from './jobs.service.js';

// req.query, req.params and req.body were validated and coerced by the validate middleware.
const idOf = (req: Request) => (req.params as unknown as IdParams).id;

export async function list(req: Request, res: Response) {
  const result = await jobsService.list(req.query as unknown as JobListQuery);
  res.status(HTTP_STATUS.OK).json(result);
}

export async function getById(req: Request, res: Response) {
  res.status(HTTP_STATUS.OK).json(await jobsService.getById(idOf(req)));
}

export async function create(req: Request, res: Response) {
  // requireAuth always sets req.user before this runs.
  if (!req.user) throw AppError.unauthenticated();
  const job = await jobsService.create(req.body as JobBody, req.user.id);
  res.status(HTTP_STATUS.CREATED).json(job);
}

export async function changeStatus(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthenticated();
  const { status } = req.body as JobStatusBody;
  res.status(HTTP_STATUS.OK).json(await jobsService.changeStatus(idOf(req), status, req.user.id));
}

export async function getHistory(req: Request, res: Response) {
  res.status(HTTP_STATUS.OK).json(await jobsService.getHistory(idOf(req)));
}

export async function update(req: Request, res: Response) {
  const job = await jobsService.update(idOf(req), req.body as JobBody);
  res.status(HTTP_STATUS.OK).json(job);
}
