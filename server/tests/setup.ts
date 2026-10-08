import 'dotenv/config';

// Tests must never touch the dev database. Point Prisma at the test database
// before anything imports the Prisma client or the env config.
const devUrl = process.env.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error('TEST_DATABASE_URL is not set. Add it to server/.env before running tests.');
}

if (testUrl === devUrl) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL. Refusing to run tests.');
}

const databaseName = new URL(testUrl).pathname.replace('/', '');
if (!databaseName.toLowerCase().includes('test')) {
  throw new Error(`Test database name "${databaseName}" must contain "test". Refusing to run tests.`);
}

process.env.DATABASE_URL = testUrl;

// Test-only fallbacks so tests do not depend on a developer's local values.
process.env.JWT_SECRET ??= 'test-secret-not-for-production';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';
