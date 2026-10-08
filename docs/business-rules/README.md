# Business Rules Index

This folder is the source of truth for how the Job Management System behaves.
If code and these files disagree, fix the code or update the file deliberately.

## Product summary

An admin-only internal system to manage production jobs. The admin logs in, manages employees, creates and edits jobs, assigns employees, moves jobs through a status workflow, and reviews job history.

## Decisions already made

| Topic | Decision |
|---|---|
| Who can log in | Admin users only. Employees do not log in. |
| Employees | Records only, used for job assignment. |
| Password hashing | bcrypt |
| Cancel rule | Only `PENDING` jobs can be cancelled. |
| Locked jobs | `COMPLETED` and `CANCELLED` jobs cannot be edited or have status changed. |
| Job number | Auto-generated, sequential: `JOB-001`, `JOB-002`, ... |
| Deactivated employee | Hidden from the assignment dropdown. Existing assignments stay. |
| Admin accounts | Seeded only (no admin management screen). |
| Status history "changed by" | The logged-in admin user. |

## Files

1. `01-authentication.md`: login, sessions, logout, route protection
2. `02-employees.md`: employee management
3. `03-jobs.md`: job fields, list, search, filters, details, editing
4. `04-status-workflow.md`: allowed statuses and transitions
5. `05-status-history.md`: history recording and display
6. `06-dashboard.md`: dashboard widgets
7. `07-validation.md`: validation rules (frontend and backend)
8. `08-database-schema.md`: tables, columns, indexes
9. `09-api-contract.md`: endpoints
10. `10-testing-checklist.md`: what must be tested

## Open items

- None blocking. Update this section if new questions come up.
