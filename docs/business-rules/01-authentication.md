# 01 Authentication

## Scope
Admin-only login. Employees never log in.

## Login page
Fields: Email, Password, Remember Me checkbox, Login button.

## Rules
- Only authenticated users can access any page except `/login`.
- Passwords are hashed with **bcrypt** (cost factor 10 or higher). Never store or log plain text passwords.
- Invalid login always returns the same generic message: `Invalid email or password`. Never reveal whether the email exists.
- Inactive admin users cannot log in (same generic message).
- Auth is a **JWT stored in an httpOnly cookie** (`SameSite=Lax`, `Secure` in production).
  - Remember Me **on**: persistent cookie, 30 days.
  - Remember Me **off**: session cookie (expires when the browser closes), JWT lifetime 1 day.
- Logout clears the cookie.
- Login endpoint is rate limited (for example 10 attempts per 15 minutes per IP).

## Protection
- **Backend:** every route except `POST /auth/login` requires a valid JWT via `requireAuth`. Missing or invalid token returns `401`.
- **Frontend:** `ProtectedRoute` redirects unauthenticated users to `/login`. This is UX only, never the real protection.
- On app load, the client calls `GET /auth/me` to restore the session.
- On any `401` response, the client clears its auth state and redirects to `/login`.

## Seed data
- One admin: `admin@example.com` / `Admin@123` (demo only, document in README, change in real use).

## Acceptance checks
- Wrong password returns 401 with the generic message.
- Unknown email returns the identical 401 response.
- Calling any protected endpoint without a cookie returns 401.
- Responses never contain `password_hash`.
- Logout invalidates access in the browser (cookie cleared).
