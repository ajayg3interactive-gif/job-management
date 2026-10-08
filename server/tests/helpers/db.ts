import { prisma } from '../../src/utils/prisma.js';

// Clears every table in foreign key order and restores the single job counter row
// (the seed normally creates it). Call in beforeAll/beforeEach of DB tests.
export async function resetDb() {
  await prisma.jobStatusHistory.deleteMany();
  await prisma.job.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.jobCounter.deleteMany();
  await prisma.jobCounter.create({ data: { id: 1, lastNumber: 0 } });
}

export { prisma };
