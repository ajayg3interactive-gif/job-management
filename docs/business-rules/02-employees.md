# 02 Employees

## Scope
Employees are records used for job assignment. They do not log in.

## Fields
| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text | Yes | max 100 chars |
| Email | email | Yes | unique |
| Phone | text | No | digits, spaces, `+`, `-`, `()` allowed, 7 to 20 chars |
| Status | Active / Inactive | Yes | defaults to Active |

## Admin can
- View employees (list with search by name or email, optional status filter).
- Add employee.
- Edit employee.
- Activate / deactivate employee.

## Rules
- Email must be unique (case-insensitive). Duplicate returns `409`.
- Employees are never hard deleted. Use deactivate instead.
- **Inactive employees do not appear in the job assignment dropdown** (`GET /employees?active=true`).
- Deactivating an employee who is assigned to existing jobs is allowed. The existing assignments stay and still display the employee name on those jobs.
- A job cannot be **newly assigned** to an inactive employee. The backend rejects it with `400`.
- When editing a job that is already assigned to an inactive employee, saving without changing the assignee must still work.

## Acceptance checks
- Create, edit, deactivate, reactivate employee.
- Duplicate email rejected.
- Dropdown endpoint returns only active employees.
- Assigning a job to an inactive employee is rejected by the backend.
- Existing job assignments survive deactivation.
