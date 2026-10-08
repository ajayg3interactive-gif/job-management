import { Prisma } from '@prisma/client';
import { AppError } from '../../utils/AppError.js';
import { escapeLike } from '../../utils/escapeLike.js';
import { prisma } from '../../utils/prisma.js';
import type { EmployeeBody, EmployeeListQuery } from './employees.schema.js';

const employeeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

// Maps database errors to the API errors: unique email -> 409, missing row -> 404.
function translateError(error: unknown): never {
  if (isPrismaError(error, 'P2002')) throw AppError.duplicateEmail();
  if (isPrismaError(error, 'P2025')) throw AppError.notFound('Employee not found');
  throw error;
}

export async function list({ search, status, page, pageSize }: EmployeeListQuery) {
  // MySQL's default collation makes `contains` case-insensitive, so no `mode` is needed.
  const term = search ? escapeLike(search) : undefined;
  const where: Prisma.EmployeeWhereInput = {
    ...(term ? { OR: [{ name: { contains: term } }, { email: { contains: term } }] } : {}),
    ...(status ? { isActive: status === 'active' } : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      select: employeeSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return { data, page, pageSize, total };
}

// For the job assignment dropdown: active employees only, no pagination.
export function listActiveOptions() {
  return prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
}

export async function getById(id: number) {
  const employee = await prisma.employee.findUnique({ where: { id }, select: employeeSelect });
  if (!employee) throw AppError.notFound('Employee not found');
  return employee;
}

export async function create(input: EmployeeBody) {
  try {
    return await prisma.employee.create({ data: input, select: employeeSelect });
  } catch (error) {
    return translateError(error);
  }
}

export async function update(id: number, input: EmployeeBody) {
  try {
    return await prisma.employee.update({ where: { id }, data: input, select: employeeSelect });
  } catch (error) {
    return translateError(error);
  }
}

// Employees are never hard deleted. Existing job assignments are untouched.
export async function setStatus(id: number, isActive: boolean) {
  try {
    return await prisma.employee.update({
      where: { id },
      data: { isActive },
      select: employeeSelect,
    });
  } catch (error) {
    return translateError(error);
  }
}
