# Job Management System

Internal admin-only web app for managing production jobs. See `CLAUDE.md` and `docs/business-rules/`.

## Setup

Requires Node 20+ and a local MySQL 8.

```bash
# Server
cd server
cp .env.example .env      # then fill in DATABASE_URL, JWT_SECRET
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

Tests: `npm test` in `server/` and `client/`. Server tests must use a separate test database.
