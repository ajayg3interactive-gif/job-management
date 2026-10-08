import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as employeesController from './employees.controller.js';
import {
  employeeBodySchema,
  employeeIdParamsSchema,
  employeeListQuerySchema,
  employeeStatusBodySchema,
} from './employees.schema.js';

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get(
  '/',
  validate({ query: employeeListQuerySchema }),
  asyncHandler(employeesController.list),
);

employeesRouter.post(
  '/',
  validate({ body: employeeBodySchema }),
  asyncHandler(employeesController.create),
);

employeesRouter.get(
  '/:id',
  validate({ params: employeeIdParamsSchema }),
  asyncHandler(employeesController.getById),
);

employeesRouter.put(
  '/:id',
  validate({ params: employeeIdParamsSchema, body: employeeBodySchema }),
  asyncHandler(employeesController.update),
);

employeesRouter.patch(
  '/:id/status',
  validate({ params: employeeIdParamsSchema, body: employeeStatusBodySchema }),
  asyncHandler(employeesController.setStatus),
);
