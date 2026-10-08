# 03 Jobs

## Job fields
| Field | Type | Required | Notes |
|---|---|---|---|
| Job No | auto | n/a | `JOB-001`, `JOB-002`, ... read only |
| Customer Name | text | Yes | max 150 chars |
| Product | text | Yes | max 150 chars |
| Quantity | integer | Yes | greater than 0 |
| Priority | enum | Yes | `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| Assigned Employee | dropdown | No | active employees only |
| Start Date | date | No | |
| Due Date | date | Yes | cannot be before Start Date |
| Notes | textarea | No | max 2000 chars |
| Status | enum | n/a | set by the system, new jobs start as `PENDING` |

## Job number generation
- Sequential and unique: `JOB-001`, `JOB-002`, ...
- Generated on the backend inside a `prisma.$transaction` so two simultaneous creates never get the same number.
- Zero padded to 3 digits, grows naturally after `JOB-999` (`JOB-1000`).
- Clients can never supply the job number.

## Create
- New jobs always start with status `PENDING`.
- Creating a job also writes the first history row (see `05-status-history.md`), in the same transaction.
- `created_by` is the logged-in admin.

## Edit
- Admin can edit all fields above except Job No and Status.
- Status changes only happen through the status workflow endpoint, never through edit.
- **Completed and Cancelled jobs are locked.** Editing them returns `422`, enforced on the backend. The UI hides or disables the Edit button.

## List page
Columns: Job No, Customer, Assigned To, Priority, Status. Row click opens the details page.

- **Search:** by job number or customer name (partial, case-insensitive match).
- **Filters:** Status, Priority, Assigned Employee. Filters combine with search using AND.
- **Pagination:** server side, default 10 per page. Default sort: newest first.
- Empty state when nothing matches. Loading and error states required.
- Search and filters reflect in the URL query string so the page is shareable and survives refresh.

## Details page
Shows: Job No, Customer, Product, Quantity, Priority, Assigned To, Status, Start Date, Due Date, Notes, plus the Status History timeline.

Actions:
- **Edit Job** (hidden or disabled when locked)
- **Change Status** (only offers valid next statuses, hidden when none)
- **Cancel Job** (only shown when status is `PENDING`)

Date display format: `08 Oct 2026`.

## Acceptance checks
- Create, edit, view a job end to end.
- Job numbers are sequential and unique.
- Editing a completed or cancelled job returns 422.
- Search and each filter work alone and combined.
- Assigned To shows a dash when unassigned.
