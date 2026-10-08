# 04 Status Workflow

## Statuses
`PENDING`, `IN_PRODUCTION`, `READY_FOR_DISPATCH`, `COMPLETED`, `CANCELLED`

Display labels: Pending, In Production, Ready for Dispatch, Completed, Cancelled.

## Allowed transitions

```
PENDING            -> IN_PRODUCTION | CANCELLED
IN_PRODUCTION      -> READY_FOR_DISPATCH
READY_FOR_DISPATCH -> COMPLETED
COMPLETED          -> (none, terminal)
CANCELLED          -> (none, terminal)
```

Anything else is invalid. Examples of forbidden moves:
- `COMPLETED -> IN_PRODUCTION`
- `PENDING -> COMPLETED` (cannot skip steps)
- `IN_PRODUCTION -> CANCELLED` (cancel is Pending only)
- `READY_FOR_DISPATCH -> IN_PRODUCTION` (no going backwards)
- Same status to same status (no-op)

## Rules
- **The backend enforces transitions.** The frontend only uses the same map to decide which options to show.
- The transition map lives in one file: `server/src/modules/jobs/transitions.ts`. No transitions are hardcoded elsewhere.
- Status changes go through `POST /jobs/:id/status` with body `{ "status": "IN_PRODUCTION" }`. The edit endpoint ignores or rejects a status field.
- **Cancel** is the same endpoint with `status: CANCELLED`, allowed only from `PENDING`.
- A status change, the job update and the history row are written in **one `prisma.$transaction`**. If the history insert fails, the status does not change.
- Lock the job row (or use a conditional update on the old status) so two simultaneous changes cannot both succeed.

## Error responses
| Case | HTTP | Code |
|---|---|---|
| Job not found | 404 | `NOT_FOUND` |
| Invalid status value | 400 | `VALIDATION_ERROR` |
| Job is Completed or Cancelled | 422 | `JOB_LOCKED` |
| Transition not in the map | 409 | `INVALID_TRANSITION` |

Error message for an invalid transition should name both statuses, for example: `Cannot change status from Completed to In Production`.

## UI
- The Change Status dialog lists only the valid next statuses for the current status.
- For `PENDING` the dialog offers In Production, and Cancel Job is a separate action with a confirmation.
- No status actions are shown for Completed or Cancelled jobs.

## Acceptance checks
- Every valid transition succeeds and writes one history row.
- Every invalid pair returns 409 and writes no history row.
- Locked jobs return 422.
- Concurrent changes do not create duplicate or inconsistent history.
