# 3.3 Access-control tests (Jest + Supertest): evidence

Date: 2026-11-17. Tools already in the project: Jest 29, Supertest 6, mongodb-memory-server (in-memory replica set, no real database touched, no real secret: `tests/helpers/env.js`).

Run: `npm run test:security` (or `npm test`).

## Results

| Test file | Before fixes (passed / failed) | After fixes (passed / failed) |
|---|---|---|
| `tests/security/auth-token.test.js` | 19 / 0 | 19 / 0 |
| `tests/security/role-matrix.test.js` | 74 / 6 | 80 / 0 |
| `tests/security/portfolio-isolation.test.js` | 14 / 9 | 23 / 0 |
| `tests/security/register.test.js` | 4 / 7 | 11 / 0 |
| **Total** | **111 / 22 (133 tests)** | **133 / 0 (133 tests)** |

Raw output: `access-control-tests-before-fixes-2026-11-17.{txt,json}` and `access-control-tests-after-fixes-2026-11-17.{txt,json}`.
Full suite after fixes (`npm test`, including `tests/integration/setup.test.js`): 5 suites, 139 tests, all passed.

## Vulnerabilities found and fixed

| # | Vulnerability | Cause | Fix |
|---|---|---|---|
| 1 | **Privilege escalation**: `POST /api/auth/register` is public and created the user with the `role` sent in the body, so anyone could create an admin | `auth.controller.js` trusted `req.body.role` | Public sign-up always creates an `agent`; any other role answers 403 unless the caller presents a valid **admin** token (the admin "New user" form uses this endpoint, so it keeps working). New `optionalProtect` middleware (`middleware/auth.js`, used in `auth.routes.js`): no header = anonymous, an invalid token = 401 |
| 2 | **Broken access control (BR-14)**: an agent could read any client and the invoices of any client | `getClient`, `getClientInvoices` had no portfolio check | `canAccessClient` check, 403 |
| 3 | An agent could **read, edit, cancel and add payments** to an invoice of another agent | `updateInvoice`, `addPayment`, `getInvoicePayments` had no portfolio check | `canAccessClientId` check (new, `utils/access.js`), 403 |
| 4 | An agent could read the **collection actions** of another portfolio | `getCollectionAction`, `getInvoiceActions`, `getClientActions` had no portfolio check | Same check, 403 |

Existing protections confirmed by the tests (no change needed): JWT checks (missing, malformed, `alg: none`, expired, wrong key, deactivated or deleted user all give 401), role guards on delete / assign agents / users / audit, cancel action reserved to manager and admin, portfolio filtering on the lists, `getInvoice`, `createInvoice`, `createCollectionAction`, `updateClient`.

## Files

Created: `tests/security/{auth-token,role-matrix,portfolio-isolation,register}.test.js`, `tests/helpers/portfolios.js`, this report and the before/after evidence files.
Modified: `package.json` (script `test:security`), `src/controllers/{auth,client,invoice,collection}.controller.js`, `src/middleware/auth.js`, `src/routes/auth.routes.js`, `src/utils/access.js`.

## Remaining points (not changed)

- `register` is still reachable without a token for agents (open sign-up is the application's policy); restrict it further if the business does not want self-registration.
- No rate limiting on `/api/auth/login` (brute force): out of the scope of this step.
