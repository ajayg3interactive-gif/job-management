# 08 Database Schema (MySQL 8, via Prisma)

## Tables

### users (admins, login only)
| Column | Type | Notes |
|---|---|---|
| id | INT PK auto | |
| name | VARCHAR(100) | |
| email | VARCHAR(191) | unique |
| password_hash | VARCHAR(255) | bcrypt |
| is_active | BOOLEAN | default true |
| created_at | DATETIME | default now |
| updated_at | DATETIME | auto update |

### employees (assignable people, no login)
| Column | Type | Notes |
|---|---|---|
| id | INT PK auto | |
| name | VARCHAR(100) | |
| email | VARCHAR(191) | unique |
| phone | VARCHAR(20) | nullable |
| is_active | BOOLEAN | default true |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### jobs
| Column | Type | Notes |
|---|---|---|
| id | INT PK auto | |
| job_no | VARCHAR(20) | unique, `JOB-001` |
| customer_name | VARCHAR(150) | |
| product | VARCHAR(150) | |
| quantity | INT | greater than 0 |
| priority | ENUM(LOW, NORMAL, HIGH, URGENT) | |
| status | ENUM(PENDING, IN_PRODUCTION, READY_FOR_DISPATCH, COMPLETED, CANCELLED) | default PENDING |
| assigned_employee_id | INT NULL | FK employees.id, ON DELETE SET NULL |
| start_date | DATE NULL | |
| due_date | DATE | |
| notes | TEXT NULL | |
| created_by | INT | FK users.id |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### job_status_history
| Column | Type | Notes |
|---|---|---|
| id | INT PK auto | |
| job_id | INT | FK jobs.id, ON DELETE CASCADE |
| old_status | ENUM(same as jobs.status) NULL | null on creation |
| new_status | ENUM(same as jobs.status) | |
| changed_by | INT | FK users.id |
| created_at | DATETIME | |

### job_counters (for job number generation)
| Column | Type | Notes |
|---|---|---|
| id | INT PK | single row, id = 1 |
| last_number | INT | incremented inside the create-job transaction |

The counter row is incremented with a locking read or atomic update inside `prisma.$transaction`, then `job_no` is built from the new value. Do not use `MAX(id) + 1`.

## Indexes
- `jobs`: `status`, `priority`, `assigned_employee_id`, `due_date`, `created_at`, `customer_name`, unique `job_no`
- `job_status_history`: `(job_id, created_at)`
- `employees`: `is_active`, unique `email`
- `users`: unique `email`

## Rules
- Dates are stored in UTC.
- Employees and users are never hard deleted.
- Prisma enums must match the status and priority constants used in code.
- All schema changes go through Prisma migrations, never manual edits.

## Seed
- 1 admin user (`admin@example.com`).
- 5 employees (one inactive, to test the dropdown filter).
- About 12 jobs covering all statuses, priorities and some due soon or overdue, each with matching history rows.
