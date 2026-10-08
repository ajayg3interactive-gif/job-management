# Job Management System

Internal admin-only web app for managing production jobs. See `CLAUDE.md` and `docs/business-rules/`.

## Setup

Requires Node 20+ and a local MySQL 8.

```bash
# Server
cd server
cp .env.example .env      # then fill in DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Client
cd client
cp .env.example .env
npm install
npm run dev
```

Create two empty MySQL databases first (for example `job_management` and `job_management_test`).

Tests: `npm test` in `server/` and `client/`. Server tests run against `TEST_DATABASE_URL`
(the database name must contain "test"; the run is refused if it equals `DATABASE_URL`).
To prepare the test database once: `DATABASE_URL=<your test url> npx prisma migrate deploy`.

Demo admin (from the seed, change in real use): `admin@example.com` / `Admin@123`.
