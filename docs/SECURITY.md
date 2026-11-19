# Security notes

## Configuration (environment variables)

| Variable | Purpose |
|---|---|
| `CORS_ORIGIN` | Allowed browser origins, comma-separated (e.g. `https://app.example.com,https://admin.example.com`). Defaults to `http://localhost:5173`. `*` is ignored. Requests without an `Origin` header (same-origin, curl, k6) are unaffected. |
| `TRUST_PROXY` | Number of reverse-proxy hops in front of the API (e.g. `1`). Needed so the login rate limiter sees the real client IP instead of the proxy IP. Leave unset when there is no proxy. |
| `RATE_LIMIT_DISABLED` | `true` disables the login rate limiter **only** when `NODE_ENV` is `test` or `loadtest` (k6 load tests). It is ignored in production and in any other environment. |

## Controls in place

- **Registration**: `POST /api/auth/register` ignores any `role` in the body and creates an `agent`. Only an authenticated admin (the "New user" form) may choose the role. Unknown properties are rejected by Joi.
- **Portfolio isolation**: agents only reach clients they created or are assigned to (`src/utils/access.js`); invoices, payments and actions are checked through their client. Managers and admins see everything.
- **Sorting**: `sortBy` / `order` go through a whitelist (`src/utils/sort.js`); anything else answers 400.
- **Headers**: Helmet defaults (CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, ...).
- **Brute force**: 10 login attempts per IP per 15 minutes, then HTTP 429.
- **Passwords**: at least 10 characters, with an uppercase letter, a digit and a special character (Joi, `validateRegister`). Existing hashes are untouched.

## Known risk: JWT stored in `localStorage`

The token is stored under the key `recouvra_token` (`frontend/src/api.js`: `getToken` / `setToken`; used by `frontend/src/auth.jsx` and sent as `Authorization: Bearer ...`).
Any XSS flaw would let a script read it. Existing mitigations: React escapes rendered values, no `dangerouslySetInnerHTML`, a Helmet Content-Security-Policy restricting scripts to the same origin, strict input validation (Joi), and a limited token lifetime (`JWT_EXPIRE`).

Possible evolution (not implemented, to be studied first): an `HttpOnly; Secure; SameSite=Strict|Lax` cookie, which scripts cannot read. It requires: CSRF protection (token or `SameSite` + origin checks), `credentials: true` with an explicit CORS origin list, a logout/revocation endpoint, and changes to the frontend and to `protect` in `src/middleware/auth.js`. Until then the Bearer-header mechanism is unchanged.
