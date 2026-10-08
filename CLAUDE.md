# Job Management System

Internal admin-only web app for managing production jobs.
Business rules live in `docs/business-rules/`. Read the relevant file before implementing a feature.

## Stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, React Router, Redux Toolkit + RTK Query, React Hook Form + Zod
- **Backend:** Node.js + Express + TypeScript, Zod, Prisma ORM
- **Database:** MySQL 8
- **Auth:** JWT in httpOnly cookie, bcrypt password hashing
- **Testing:** Vitest + Supertest (API), React Testing Library (UI)

## Project structure

```
/
├── CLAUDE.md
├── docs/business-rules/      # Business logic (source of truth)
├── server/
│   ├── prisma/               # schema.prisma, migrations, seed.ts
│   └── src/
│       ├── config/           # env, constants
│       ├── middleware/       # auth, validate, errorHandler, rateLimit
│       ├── modules/
│       │   ├── auth/
│       │   ├── employees/
│       │   ├── jobs/         # routes, controller, service, schema, transitions
│       │   └── dashboard/
│       ├── utils/
│       └── app.ts / server.ts
└── client/
    └── src/
        ├── app/              # Redux store, typed hooks
        ├── api/              # RTK Query base API (createApi) + injected endpoints per module
        ├── components/       # shared UI
        ├── features/         # auth, employees, jobs, dashboard
        ├── hooks/
        ├── routes/           # router + ProtectedRoute
        ├── schemas/          # Zod schemas for forms
        └── types/
```

## Commands

```bash
# Database: local MySQL 8 must be running. Set DATABASE_URL in server/.env

# Server (from /server)
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
npm test

# Client (from /client)
npm install
npm run dev
npm test
```

## Business rules (read only when needed)

Do not read these files up front. Open only the file(s) relevant to the task you are working on.
Start with `docs/business-rules/README.md` only if you need the list of decisions already made.

| Working on | Read |
|---|---|
| Login, logout, route protection | `docs/business-rules/01-authentication.md` |
| Employees | `docs/business-rules/02-employees.md` |
| Job fields, list, search, filters, details, edit | `docs/business-rules/03-jobs.md` |
| Status changes, cancel, transitions | `docs/business-rules/04-status-workflow.md` |
| Status history | `docs/business-rules/05-status-history.md` |
| Dashboard | `docs/business-rules/06-dashboard.md` |
| Any form or request validation | `docs/business-rules/07-validation.md` |
| Prisma schema, indexes, seed | `docs/business-rules/08-database-schema.md` |
| Adding or calling an endpoint | `docs/business-rules/09-api-contract.md` |
| Writing or reviewing tests | `docs/business-rules/10-testing-checklist.md` |

## Coding rules

### General
- TypeScript strict mode in both apps. No `any` unless commented with a reason.
- Follow the backend layering: **route → controller → service → Prisma**. Controllers only parse the request and send the response. Business rules live in services.
- Keep status transition logic in one file (`jobs/transitions.ts`). Never hardcode transitions elsewhere.
- Use enums/constants for statuses and priorities. No magic strings.
- Small, focused commits. One feature per commit.

### Backend
- **Backend validation is mandatory.** Validate every request body, query and params with Zod before the service runs, even if the frontend validates too.
- Every route except `POST /auth/login` goes through `requireAuth`.
- Never return `password_hash`. Use explicit `select`/DTOs for user data.
- Multi-step writes (create job + history row, status change + history row, job number generation) must use `prisma.$transaction`.
- Use a consistent error shape: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
  Status codes: 400 validation, 401 unauthenticated, 404 not found, 409 conflict/invalid transition, 422 locked job.
- Never reveal whether an email exists on login failure. Always return a generic invalid credentials message.
- Config via environment variables only. Never commit `.env`. Keep `.env.example` up to date.

### Frontend
- Frontend route protection is for UX only. The backend is the real protection.
- Use RTK Query (`createApi` + `injectEndpoints`) for all API calls and server state. No manual `useEffect` fetching, no axios or raw `fetch` in components.
- Set `credentials: 'include'` in the RTK Query `fetchBaseQuery` so the httpOnly auth cookie is sent.
- Use tags (`providesTags` / `invalidatesTags`) so lists, details, history and dashboard refresh after mutations (for example, a status change invalidates the job, its history and the dashboard).
- Keep the Redux store small: RTK Query cache plus an auth slice. Do not copy server data into other slices.
- Handle a `401` in a base query wrapper: clear auth state and redirect to `/login`.
- Forms use React Hook Form with a Zod resolver. Show field-level errors from both frontend validation and backend responses.
- Show loading, error and empty states on every list and detail page.
- Only offer valid next statuses in the status-change UI (derive from the same rules as the backend, but the backend still enforces them).
- Dates: store/send ISO strings, display as `08 Oct 2026` and times as `09:10 AM`.
- Tailwind only. No inline style objects unless unavoidable.

### Testing
- Write backend tests alongside each feature, not at the end.
- Business rules (transitions, locked jobs, validation, auth) must have tests before a module is considered done.
- Use a separate test database. Never run tests against the dev database.

## Definition of done (per feature)
1. Business rule file in `docs/business-rules/` is satisfied.
2. Backend validation and permissions in place.
3. Frontend UI with loading/error/empty states.
4. Tests written and passing.
5. README/setup notes updated if setup changed.
