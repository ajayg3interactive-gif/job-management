# 09 API Contract

Base path: `/api`. JSON in and out. All routes except `POST /api/auth/login` require authentication.

## Error shape

```json
{ "error": { "code": "STRING_CODE", "message": "Human readable", "details": [] } }
```

| HTTP | Meaning | Example code |
|---|---|---|
| 400 | Validation failed | `VALIDATION_ERROR` |
| 401 | Not authenticated or bad login | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 404 | Not found | `NOT_FOUND` |
| 409 | Conflict or invalid transition | `DUPLICATE_EMAIL`, `INVALID_TRANSITION` |
| 422 | Job is locked | `JOB_LOCKED` |
| 429 | Rate limited | `TOO_MANY_REQUESTS` |

## Auth
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password, rememberMe? }` | 200 `{ user }` and sets cookie |
| POST | `/auth/logout` | none | 204, clears cookie |
| GET | `/auth/me` | none | 200 `{ user }` |

`user` is `{ id, name, email }`. Never include the hash.

## Employees
| Method | Path | Notes |
|---|---|---|
| GET | `/employees` | query: `search`, `status` (`active`/`inactive`), `page`, `pageSize` |
| GET | `/employees?active=true` | dropdown use, returns active only, no pagination, plain array of `{ id, name }` |
| GET | `/employees?all=true` | job list filter use, returns every employee including inactive, no pagination, plain array of `{ id, name, isActive }`. Cannot be combined with `active` |
| POST | `/employees` | `{ name, email, phone? }`, 201 |
| GET | `/employees/:id` | |
| PUT | `/employees/:id` | `{ name, email, phone? }` |
| PATCH | `/employees/:id/status` | `{ isActive: boolean }` |

## Jobs
| Method | Path | Notes |
|---|---|---|
| GET | `/jobs` | query: `search`, `status`, `priority`, `employeeId`, `page`, `pageSize`. Returns `{ data, page, pageSize, total }` |
| POST | `/jobs` | create body below, returns 201 with job |
| GET | `/jobs/:id` | job with assigned employee object |
| PUT | `/jobs/:id` | same body as create, 422 `JOB_LOCKED` if Completed or Cancelled. Saving without changing the assignee works even if they are now inactive; a newly chosen inactive or missing employee is 400 on `assignedEmployeeId` |
| POST | `/jobs/:id/status` | `{ status }`, 409 invalid transition, 422 locked |
| GET | `/jobs/:id/history` | `[ { id, oldStatus, newStatus, changedBy: { id, name }, createdAt } ]` oldest first |

Job response shape (create, get, edit and each item of the list):

```json
{
  "id": 1,
  "jobNo": "JOB-001",
  "customerName": "ABC Timber",
  "product": "Standard Pallet",
  "quantity": 120,
  "priority": "HIGH",
  "status": "PENDING",
  "assignedEmployee": { "id": 3, "name": "Ann Lee", "isActive": true },
  "startDate": "2026-10-08",
  "dueDate": "2026-10-12",
  "notes": "Customer requested urgent delivery.",
  "createdAt": "2026-10-08T06:00:00.000Z",
  "updatedAt": "2026-10-08T06:00:00.000Z"
}
```

`assignedEmployee` is `null` when unassigned. `isActive` lets the UI mark an assignee who was deactivated later.

Create and edit body:

```json
{
  "customerName": "ABC Timber",
  "product": "Standard Pallet",
  "quantity": 120,
  "priority": "HIGH",
  "assignedEmployeeId": 3,
  "startDate": "2026-10-08",
  "dueDate": "2026-10-12",
  "notes": "Customer requested urgent delivery."
}
```

## Dashboard
| Method | Path | Response |
|---|---|---|
| GET | `/dashboard` | `{ counts: { total, pending, inProduction, readyForDispatch, completed, cancelled }, recentJobs: [...5], dueSoon: [...] }` |

## Conventions
- Field names are camelCase in JSON, snake_case in the database (Prisma maps them).
- Dates are ISO strings (`YYYY-MM-DD` for date fields, full ISO for timestamps).
- Every request body, query and params object is validated with Zod before the controller logic runs.
- Add security middleware: `helmet`, CORS restricted to the client origin with `credentials: true`, JSON body size limit.
