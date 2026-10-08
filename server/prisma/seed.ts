import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Demo credentials only (documented in the README). Change them in real use.
const ADMIN = {
  name: 'Admin',
  email: 'admin@example.com',
  password: 'Admin@123',
};

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN.password, 10);

  await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { name: ADMIN.name, passwordHash, isActive: true },
    create: { name: ADMIN.name, email: ADMIN.email, passwordHash },
  });

  // Single counter row used for job number generation.
  await prisma.jobCounter.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, lastNumber: 0 },
  });

  console.log(`Seeded admin ${ADMIN.email} and job counter.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
