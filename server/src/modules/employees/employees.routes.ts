import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { idParamsSchema } from '../../utils/idParams.js';
import * as employeesController from './employees.controller.js';
import {
  employeeBodySchema,
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
  validate({ params: idParamsSchema }),
  asyncHandler(employeesController.getById),
);

employeesRouter.put(
  '/:id',
  validate({ params: idParamsSchema, body: employeeBodySchema }),
  asyncHandler(employeesController.update),
);

employeesRouter.patch(
  '/:id/status',
  validate({ params: idParamsSchema, body: employeeStatusBodySchema }),
  asyncHandler(employeesController.setStatus),
);
