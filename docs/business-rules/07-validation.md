# 07 Validation

## Principle
Validation exists on **both** frontend and backend. Backend validation is mandatory and is the real check. Use Zod on both sides, and keep the rules identical.

## Job (create and edit)
| Field | Rule |
|---|---|
| customerName | required, trimmed, 1 to 150 chars |
| product | required, trimmed, 1 to 150 chars |
| quantity | required, integer, greater than 0 (upper bound 1,000,000) |
| priority | required, one of `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| assignedEmployeeId | optional or null, must reference an existing **active** employee |
| startDate | optional, valid date |
| dueDate | required, valid date, **not before startDate** when startDate is given |
| notes | optional, max 2000 chars |

Extra backend rules:
- Unknown fields are stripped or rejected (`status`, `jobNo`, `createdBy` can never be set from the request body).
- Due date equal to start date is allowed.

## Status change
- `status` must be one of the five enum values, then pass the transition rules in `04-status-workflow.md`.

## Employee
| Field | Rule |
|---|---|
| name | required, trimmed, 1 to 100 chars |
| email | required, valid email, lower-cased, unique |
| phone | optional, 7 to 20 chars, digits, spaces, `+ - ( )` only |
| isActive | boolean |

## Login
| Field | Rule |
|---|---|
| email | required, valid email format |
| password | required, non-empty |
| rememberMe | optional boolean |

Do not enforce password complexity on login, only on creation if a create flow is ever added.

## Query params (job list)
- `page` integer at least 1, `pageSize` integer 1 to 100.
- `status` and `priority` must be valid enum values.
- `employeeId` must be a positive integer.
- `search` string, trimmed, max 100 chars.

## Error format
Validation failures return `400`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "quantity", "message": "Quantity must be greater than 0" }]
  }
}
```

The frontend maps `details[].field` back onto form fields so server errors show next to the right input.

## Acceptance checks
- Each rule above has a backend test that bypasses the UI.
- Each rule shows a field-level message in the form.
- Due date before start date is rejected on both sides.
- Priority outside the enum is rejected by the backend.
