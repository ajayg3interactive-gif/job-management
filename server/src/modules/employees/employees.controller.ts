import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../../config/constants.js';
import type {
  EmployeeBody,
  EmployeeListQuery,
  EmployeeStatusBody,
} from './employees.schema.js';
import * as employeesService from './employees.service.js';

// req.query and req.params were validated and coerced by the validate middleware.
const idOf = (req: Request) => (req.params as unknown as { id: number }).id;

export async function list(req: Request, res: Response) {
  const query = req.query as unknown as EmployeeListQuery;
  const result = query.active
    ? await employeesService.listActiveOptions()
    : await employeesService.list(query);
  res.status(HTTP_STATUS.OK).json(result);
}

export async function getById(req: Request, res: Response) {
  res.status(HTTP_STATUS.OK).json(await employeesService.getById(idOf(req)));
}

export async function create(req: Request, res: Response) {
  const employee = await employeesService.create(req.body as EmployeeBody);
  res.status(HTTP_STATUS.CREATED).json(employee);
}

export async function update(req: Request, res: Response) {
  const employee = await employeesService.update(idOf(req), req.body as EmployeeBody);
  res.status(HTTP_STATUS.OK).json(employee);
}

export async function setStatus(req: Request, res: Response) {
  const { isActive } = req.body as EmployeeStatusBody;
  res.status(HTTP_STATUS.OK).json(await employeesService.setStatus(idOf(req), isActive));
}
