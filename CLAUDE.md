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

## Implementation plan (local file, not in git)

The phase-by-phase plan lives in `IMPLEMENTATION_PLAN.local.md` at the repo root. It is git-ignored (`*.local.md`), so never commit it or move it into a tracked folder.

When the user asks to implement a phase or "the next phase":
1. Open `IMPLEMENTATION_PLAN.local.md` and read that phase's section (and the progress checklist at the top).
2. Open only the business-rule docs that phase names (see the table below).
3. Implement the steps in order: backend, then frontend, then tests. Do not skip a step or pull in work from a later phase.
4. Before starting, check the working tree for work already done for that phase and say what is partly done instead of redoing it.
5. When the phase is finished and tests pass, tick it in the progress checklist of the plan file.

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
- Every route except `POST /auth/login` and `POST /auth/logout` goes through `requireAuth`.
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
- **Theme (use it for every component).** All colors, the font family and the font weights are CSS variables defined once in `client/src/index.css` and exposed to Tailwind through `@theme`.
  - Colors: `bg-background`, `bg-surface`, `border-border`, `text-text`, `text-text-muted`, `bg-primary`, `text-on-primary`, `secondary`, `accent`, `danger` (errors), `success` and `warning` (status/priority badges), `overlay` (backdrop behind drawers and modals). Dark mode is the `.dark` block in the same file, switched by the sidebar toggle (saved in localStorage).
  - Font: family is `--font-family`, weights are `--fw-normal|medium|semibold|bold`. Use `font-normal`, `font-medium`, `font-semibold`, `font-bold`. The default font is Inter.
  - **Never hardcode** hex values, Tailwind palette colors (`gray-*`, `red-*`, `white`, ...), or a font family in a component. To change the look, edit only `index.css` (for a new font, also swap the font `@import` at its top).
  - If a needed color or weight has no token, add the token in `index.css` first, then use it.
- **Responsive design (every page and component).** The app must work from phone width (about 390px) up to desktop.
  - Build mobile-first with Tailwind breakpoints (`sm:`, `md:`, `lg:`): write the phone layout first, then add larger-screen changes.
  - The layout shell already handles navigation: the sidebar is always visible from `md` (768px) up and becomes a slide-in drawer below it (hamburger button in a slim top bar). Pages render inside it and must not add their own navigation.
  - No horizontal scrolling of the page. Wide tables go in an `overflow-x-auto` wrapper; forms, filters and toolbars stack on small screens (`flex-col sm:flex-row`); modals stay within the screen (`max-w-md w-full` with side padding).
  - Touch targets are at least 44px (`min-h-11` / `min-w-11`) on small screens. Text stays readable without zooming (no smaller than 12px).
  - Before calling a UI feature done, check it at about 390px and at desktop width (browser dev tools or Playwright), in both light and dark themes.

### Testing
- Write backend tests alongside each feature, not at the end.
- Business rules (transitions, locked jobs, validation, auth) must have tests before a module is considered done.
- Use a separate test database. Never run tests against the dev database.

## Definition of done (per feature)
1. Business rule file in `docs/business-rules/` is satisfied.
2. Backend validation and permissions in place.
3. Frontend UI with loading/error/empty states, using the theme tokens and responsive from phone to desktop.
4. Tests written and passing.
5. README/setup notes updated if setup changed.
