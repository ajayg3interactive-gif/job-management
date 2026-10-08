# 05 Status History

## What is recorded
Every status change is recorded, including the initial `PENDING` status when a job is created.

## Table: `job_status_history`
| Column | Notes |
|---|---|
| id | primary key |
| job_id | FK to jobs, cascade rules documented in `08-database-schema.md` |
| old_status | nullable, `NULL` for the creation row |
| new_status | required |
| changed_by | FK to users (the admin who made the change) |
| created_at | server timestamp |

## Rules
- A row is written when a job is created (`old_status = NULL`, `new_status = PENDING`).
- A row is written for every successful status change, in the same transaction as the change.
- No row is written for failed or rejected changes.
- History is **append only**. No update or delete endpoints exist.
- Edits to other job fields (customer, quantity, and so on) do not create history rows.
- `GET /jobs/:id/history` returns rows oldest first, each with the admin name via a join.

## Display (job details page)

```
Status History
Pending            08 Oct 2026 - 09:10 AM   Created by Admin
   |
In Production      08 Oct 2026 - 11:45 AM   Changed by Admin
   |
Ready for Dispatch 09 Oct 2026 - 03:20 PM   Changed by Admin
```

- First row says "Created by", later rows say "Changed by".
- Time format is `09:10 AM`, shown in the user's local timezone. Store UTC.
- Empty state is not expected since every job has at least one row.

## Acceptance checks
- Creating a job produces exactly one history row.
- A valid status change produces exactly one row with correct old and new status and changed_by.
- An invalid change produces no row.
- History order is chronological.
- No endpoint can modify or delete history.
