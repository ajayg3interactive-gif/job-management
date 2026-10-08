# 10 Testing Checklist

Write backend tests alongside each feature. Use a **separate test database** (`DATABASE_URL_TEST`), reset between test files. Never run tests against the dev database.

## Backend (Vitest + Supertest)

### Authentication
- [ ] Valid login returns 200, sets httpOnly cookie, no `password_hash` in response
- [ ] Wrong password returns 401 with the generic message
- [ ] Unknown email returns the identical 401 response
- [ ] Inactive admin cannot log in
- [ ] Remember Me sets a persistent cookie, otherwise a session cookie
- [ ] Every protected route returns 401 without a cookie (loop over all routes)
- [ ] Logout clears the cookie
- [ ] Passwords are stored as bcrypt hashes

### Employees
- [ ] Create, edit, list, search
- [ ] Duplicate email returns 409
- [ ] Deactivate and reactivate
- [ ] `GET /employees?active=true` excludes inactive employees
- [ ] Deactivating an assigned employee keeps the job assignment

### Jobs
- [ ] Create sets status `PENDING`, generates a job number, writes one history row
- [ ] Job numbers are sequential, and concurrent creates produce no duplicates
- [ ] Validation: missing customer, missing product, quantity 0, negative, non-integer
- [ ] Validation: due date before start date rejected, equal dates accepted
- [ ] Validation: invalid priority rejected
- [ ] Assigning an inactive or non-existent employee is rejected
- [ ] Request body cannot set `status`, `jobNo` or `createdBy`
- [ ] Search by job number and by customer name
- [ ] Filters by status, priority, employee, and combinations
- [ ] Pagination returns correct `total` and page slices
- [ ] Editing a Completed or Cancelled job returns 422

### Status workflow
- [ ] Each valid transition succeeds and writes exactly one history row
- [ ] Each invalid transition returns 409 and writes no history row (test the full matrix of statuses against each other)
- [ ] `COMPLETED -> IN_PRODUCTION` is rejected
- [ ] Cancel works from `PENDING` only
- [ ] Locked jobs return 422 on status change
- [ ] History row has correct old status, new status and changed_by
- [ ] If the history insert fails, the status change is rolled back

### Dashboard
- [ ] Counts match the data, and total equals the sum of statuses
- [ ] Recent jobs limited to 5, newest first
- [ ] Due soon excludes Completed, Cancelled and out of range jobs

## Frontend (React Testing Library)
- [ ] Login form shows field errors and the server error message
- [ ] Protected route redirects to login when unauthenticated
- [ ] Job form shows validation errors (required, quantity, date order)
- [ ] Status dialog only lists valid next statuses
- [ ] Job details hides Edit, Change Status and Cancel for locked jobs

## Manual walkthrough
1. Log in, refresh the page (session persists), log out, confirm protected pages redirect.
2. Add an employee, deactivate another, confirm the dropdown excludes the inactive one.
3. Create a job, confirm it appears in the list with `JOB-00X` and Pending.
4. Move it Pending -> In Production -> Ready for Dispatch -> Completed, confirm the history timeline.
5. Confirm a Completed job cannot be edited or changed.
6. Create another job and cancel it, confirm it is locked.
7. Try invalid API calls with curl or a REST client (bad transition, bad body, no cookie).
8. Check the dashboard counts against the list.
