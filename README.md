# Recouvra+

Invoice debt collection management: clients, invoices, payments, collection actions, dashboard and audit log.
Project for the Software Quality and Test Automation module (ISO/IEC 25010).

- **Backend**: Node.js, Express, MongoDB (Mongoose), JWT, Joi validation, Swagger docs
- **Frontend**: React + Vite (`frontend/`)
- **Functional scope and business rules**: [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md)
- **Team plan** (who tests what): [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md)

## Prerequisites

- Node.js 20+ and npm
- MongoDB 6+ running locally (or any `MONGODB_URI`)

## Installation

```bash
npm install                 # backend
npm run frontend:install    # frontend
cp .env.example .env        # then set JWT_SECRET to a long random value
npm run seed                # resets the database and loads demo data
```

`npm run seed` deletes everything in the database named in `MONGODB_URI`, then creates 5 users, 150 clients, 2,000 invoices and about 1,400 collection actions. The data is the same on every run.

## Run in development

Two terminals:

```bash
npm run dev              # API on http://localhost:3000  (Swagger: /api-docs)
npm run frontend:dev     # UI on  http://localhost:5173  (proxies /api to :3000)
```

## Run as a single server

```bash
npm run frontend:build   # builds frontend/dist
npm start                # API + UI on http://localhost:3000
```

## Tests

```bash
npm test                                      # all tests
npm run test:coverage                         # same, plus a report in coverage/ (open coverage/index.html)
npm test -- tests/integration/setup.test.js   # one file
npm test -- -t "transactions"                 # only tests whose name matches
```

Tests run against an in-memory MongoDB, so they need no `.env` and never touch your real database. The first run downloads a MongoDB binary (about 100 MB, once). The `ExperimentalWarning: VM Modules` line is expected: Jest needs that Node flag for ES modules.

### Writing a test

- Put the file in the folder of its layer (`tests/unit/`, `tests/integration/`, `tests/reliability/`, `tests/security/`) with a name ending in `.test.js`. Start by copying `tests/integration/setup.test.js`.
- Import the app from `src/app.js`, never from `src/server.js`, which connects to the real database and opens a port.
- Call `useTestDB()` once at the top of any file that needs the database. The file gets its own empty database, cleared after every test, so test files can run in parallel. Unit tests of pure functions (for example `src/workflows/`) don't need it.
- Import `describe`, `it`, `expect` and the hooks from `@jest/globals`.
- To mock a module, use `jest.unstable_mockModule` followed by `await import(...)`. `jest.mock` does not work with ES modules.

| Helper | File | Returns |
|---|---|---|
| `createUserWithToken(role, overrides)` | `tests/helpers/auth.js` | `{ user, token }`, logged in through the real login endpoint |
| `createUsersForAllRoles()` | `tests/helpers/auth.js` | `{ admin, manager, agent }`, each `{ user, token }` |
| `createUser(role, overrides)` / `loginAs(user)` | `tests/helpers/auth.js` | the user only / a token only |
| `authHeader(token)` | `tests/helpers/auth.js` | the header for `request(app).get(url).set(authHeader(token))` |
| `createClient(owner, overrides)` | `tests/helpers/factories.js` | a saved client (pass `assignedAgents` for the N-N relation) |
| `createInvoice(client, creator, overrides)` | `tests/helpers/factories.js` | a saved unpaid invoice of 1000, due in 30 days |
| `createCollectionAction(invoice, performer, overrides)` | `tests/helpers/factories.js` | a saved planned action |
| `useTestDB()` | `tests/helpers/db.js` | registers the connect / clear / disconnect hooks |

The test environment variables (JWT secret, fast password hashing) are set in `tests/helpers/env.js`.

## Demo accounts

Password for all accounts: `Password123!`

| Role | Email | Can do |
|---|---|---|
| Admin | admin@recouvra.tn | Everything, including users and the audit log |
| Manager | manager@recouvra.tn | All clients, assign agents, cancel actions, list users |
| Agent | agent1@recouvra.tn, agent2@…, agent3@… | Only their own portfolio (clients they created or are assigned to) |

## Project structure

```
src/
  app.js             Express app (routes, Swagger, static frontend), no DB connection: import it in tests
  server.js          connects to MongoDB and starts listening
  models/            User, Client, Invoice (+ payments), CollectionAction, AuditLog
  controllers/       one per resource
  routes/            /api/auth, users, clients, invoices, collections, stats, audit
  workflows/         collection action status workflow (transition rules)
  middleware/        JWT protection, role authorization, error handler
  utils/             validation (Joi), access scope, audit writer
scripts/seed.js      demo data
frontend/src/
  pages/             one page per screen
  components/        shared UI, forms, workflow control, agent assignment
  api.js             fetch wrapper + useApi hook
docs/                functional scope and business rules
```

## Main endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | Returns a JWT |
| GET | `/api/clients?search&agent&page&limit` | Full-text search, filter by assigned agent |
| PUT | `/api/clients/:id/agents` | N-N assignment, manager/admin |
| GET | `/api/invoices?search&status&client&fromDate&toDate&page&limit` | Search by invoice number prefix |
| POST | `/api/invoices/:id/payments` | Add a payment |
| PATCH | `/api/collections/:id/status` | Workflow transition |
| GET | `/api/stats?from&to&agent&client` | Dashboard with filters |
| GET | `/api/audit?action&entity&user&from&to` | Audit log, admin only |

Full contract: http://localhost:3000/api-docs
