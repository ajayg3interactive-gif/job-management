import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../../config/constants.js';
import * as dashboardService from './dashboard.service.js';

export async function get(_req: Request, res: Response) {
  res.status(HTTP_STATUS.OK).json(await dashboardService.getDashboard());
}
