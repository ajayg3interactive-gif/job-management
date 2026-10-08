import { prisma } from '../../src/utils/prisma.js';

// Clears every table in foreign key order. Call in beforeAll/beforeEach of DB tests.
export async function resetDb() {
  await prisma.jobStatusHistory.deleteMany();
  await prisma.job.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.jobCounter.deleteMany();
}

export { prisma };
