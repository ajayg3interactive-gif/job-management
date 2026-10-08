# 06 Dashboard

## Widgets

### Status counts
- Total Jobs
- Pending
- In Production
- Ready for Dispatch
- Completed
- Cancelled (shown as an extra card since it is a valid status, so the numbers add up to Total)

Total equals the sum of all statuses.

### Recent Jobs
- Latest 5 jobs by `created_at` descending.
- Columns: Job No, Customer, Status, Due Date. Row click opens details.

### Jobs Due Soon (optional, build last)
- Jobs due within the next 7 days (today included) whose status is `PENDING`, `IN_PRODUCTION` or `READY_FOR_DISPATCH`.
- Completed and Cancelled jobs are excluded.
- Sorted by due date ascending. Overdue open jobs appear first and are marked "Overdue".

## Rules
- All numbers come from `GET /dashboard`, computed in the database (use `groupBy`, not loading every job).
- Loading, error and empty states are required.
- Clicking a status card navigates to the job list filtered by that status.

## Acceptance checks
- Counts match the job list for each status.
- Total equals the sum of the status counts.
- Recent Jobs are in the correct order and limited to 5.
- Due Soon excludes locked jobs and jobs outside the window.
